/**
 * Production (Üretim & MRP) HTTP route'ları.
 *
 * Tüm endpoint'ler authMiddleware ile korunur; yazma işlemleri 'cfo' rolü ister
 * (finance modülü ile aynı politika). companyId body/query'den alınır;
 * multi-tenant izolasyon repo'larda. Bu dosya use-case'leri çağırır, iş kuralı
 * yazmaz; hata mapping errorMapping.ts'de.
 *
 * Yollar (index.ts /v1/production altına mount eder):
 *   GET/POST/PUT/DELETE /boms, GET /boms/:id, POST /boms/:id/explode, GET /boms/:id/cost
 *   GET/POST/PUT /work-centers, DELETE (arşiv) /work-centers/:id
 *   GET/POST /orders, GET /orders/:id, PATCH /orders/:id/status, POST /orders/:id/complete
 *   POST /mrp/run, GET /mrp/runs
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard, requireRole } from '../../../middleware/auth.js';
import type {
  CreateBomInput,
  CreateBomUseCase,
  DeleteBomUseCase,
  ExplodeBomUseCase,
  GetBomUseCase,
  ListBomsUseCase,
  RollupBomCostUseCase,
  UpdateBomInput,
  UpdateBomUseCase,
} from '../application/useCases/BomUseCases.js';
import type { ListMrpRunsUseCase } from '../application/useCases/MrpRunUseCases.js';
import type {
  CompleteProductionOrderUseCase,
  CreateProductionOrderInput,
  CreateProductionOrderUseCase,
  GetProductionOrderUseCase,
  ListProductionOrdersUseCase,
  UpdateProductionOrderStatusUseCase,
} from '../application/useCases/ProductionOrderUseCases.js';
import type { RunMrpUseCase } from '../application/useCases/RunMrpUseCase.js';
import type {
  CreateWorkCenterInput,
  CreateWorkCenterUseCase,
  ArchiveWorkCenterUseCase,
  ListWorkCentersUseCase,
  UpdateWorkCenterInput,
  UpdateWorkCenterUseCase,
} from '../application/useCases/WorkCenterUseCases.js';

import { mapProductionError } from './errorMapping.js';

export interface ProductionRouterDeps {
  // BOM
  createBom: CreateBomUseCase;
  updateBom: UpdateBomUseCase;
  listBoms: ListBomsUseCase;
  getBom: GetBomUseCase;
  deleteBom: DeleteBomUseCase;
  explodeBom: ExplodeBomUseCase;
  rollupBomCost: RollupBomCostUseCase;
  // Work center
  createWorkCenter: CreateWorkCenterUseCase;
  updateWorkCenter: UpdateWorkCenterUseCase;
  listWorkCenters: ListWorkCentersUseCase;
  archiveWorkCenter: ArchiveWorkCenterUseCase;
  // Production order
  createOrder: CreateProductionOrderUseCase;
  listOrders: ListProductionOrdersUseCase;
  getOrder: GetProductionOrderUseCase;
  updateOrderStatus: UpdateProductionOrderStatusUseCase;
  completeOrder: CompleteProductionOrderUseCase;
  // MRP
  runMrp: RunMrpUseCase;
  listMrpRuns: ListMrpRunsUseCase;
}

// --- Schema fragmanları ---------------------------------------------------
const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const bomStatus = z.enum(['active', 'draft', 'passive']);
const wcStatus = z.enum(['active', 'passive']);
const orderStatus = z.enum(['planned', 'released', 'in_progress', 'completed', 'cancelled']);
const orderPriority = z.enum(['low', 'normal', 'high']);
const orderSource = z.enum(['manual', 'mrp']);

const bomComponentSchema = z.object({
  materialRef: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().nullable().optional(),
  scrapPct: z.number().min(0).optional(),
  isSemi: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const bomOperationSchema = z.object({
  workCenterId: z.number().int().positive().nullable().optional(),
  name: z.string().min(1),
  setupMin: z.number().min(0).optional(),
  runMinPerUnit: z.number().min(0).optional(),
  seq: z.number().int().optional(),
});

const createBomSchema = z.object({
  companyId: z.number().int().positive(),
  no: z.string().min(1).max(60),
  productMaterialRef: z.string().min(1),
  name: z.string().min(1).max(200),
  outputQty: z.number().positive().optional(),
  outputUnit: z.string().max(20).nullable().optional(),
  version: z.string().max(40).nullable().optional(),
  status: bomStatus.optional(),
  notes: z.string().nullable().optional(),
  components: z.array(bomComponentSchema).optional(),
  operations: z.array(bomOperationSchema).optional(),
});

const updateBomSchema = z.object({
  companyId: z.number().int().positive(),
  no: z.string().min(1).max(60).optional(),
  productMaterialRef: z.string().min(1).optional(),
  name: z.string().min(1).max(200).optional(),
  outputQty: z.number().positive().optional(),
  outputUnit: z.string().max(20).nullable().optional(),
  version: z.string().max(40).nullable().optional(),
  status: bomStatus.optional(),
  notes: z.string().nullable().optional(),
  components: z.array(bomComponentSchema).optional(),
  operations: z.array(bomOperationSchema).optional(),
});

const createWorkCenterSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  dailyHours: z.number().min(0).optional(),
  costPerHour: z.number().min(0).optional(),
  status: wcStatus.optional(),
});

const updateWorkCenterSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(40).optional(),
  name: z.string().min(1).max(200).optional(),
  dailyHours: z.number().min(0).optional(),
  costPerHour: z.number().min(0).optional(),
  status: wcStatus.optional(),
});

const createOrderSchema = z
  .object({
    companyId: z.number().int().positive(),
    no: z.string().min(1).max(60),
    bomId: z.number().int().positive().nullable().optional(),
    productMaterialRef: z.string().min(1).optional(),
    qty: z.number().positive(),
    unit: z.string().max(20).nullable().optional(),
    plannedStart: dateStr.nullable().optional(),
    plannedEnd: dateStr.nullable().optional(),
    warehouseRef: z.string().nullable().optional(),
    priority: orderPriority.optional(),
    source: orderSource.optional(),
  })
  .refine((b) => b.bomId != null || (b.productMaterialRef?.trim().length ?? 0) > 0, {
    message: 'bomId veya productMaterialRef zorunlu',
  });

const costSnapshotSchema = z.object({
  materialCost: z.number(),
  laborCost: z.number(),
  overheadCost: z.number(),
  totalCost: z.number(),
  unitCost: z.number(),
});

// MRP wire kontratı
const mrpRunSchema = z.object({
  companyId: z.number().int().positive(),
  params: z.object({
    horizonDays: z.number().int().positive(),
    useSafetyStock: z.boolean(),
    includeInTransit: z.boolean(),
    overheadPct: z.number().min(0).optional(),
  }),
  materials: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      code: z.string(),
      unit: z.string(),
      purchasePrice: z.number().optional(),
      leadTimeDays: z.number().optional(),
      isManufactured: z.boolean(),
    }),
  ),
  inventory: z.array(
    z.object({
      materialRef: z.string().min(1),
      onHand: z.number(),
      safetyStock: z.number(),
      inTransit: z.number(),
    }),
  ),
  boms: z.array(
    z.object({
      id: z.string().min(1),
      productMaterialRef: z.string().min(1),
      outputQty: z.number().positive(),
      components: z.array(
        z.object({
          materialRef: z.string().min(1),
          qty: z.number(),
          scrapPct: z.number(),
          isSemi: z.boolean(),
        }),
      ),
      operations: z.array(
        z.object({
          workCenterId: z.string().nullable(),
          setupMin: z.number(),
          runMinPerUnit: z.number(),
        }),
      ),
    }),
  ),
  workCenters: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      dailyHours: z.number(),
      costPerHour: z.number(),
    }),
  ),
  demand: z.array(
    z.object({
      materialRef: z.string().min(1),
      qty: z.number(),
      dueDate: z.string().optional(),
      type: z.enum(['order', 'forecast']),
    }),
  ),
});

export function createProductionRouter(deps: ProductionRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', companyScopeGuard);
  const requireWrite = requireRole('cfo');

  // ===== BOM (Ürün Ağacı / Reçete) ========================================
  app.get(
    '/boms',
    zValidator(
      'query',
      companyIdQ.extend({ status: bomStatus.optional(), search: z.string().optional() }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const boms = await deps.listBoms.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
        });
        return c.json({ boms });
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  app.get('/boms/:id', zValidator('param', idParam), zValidator('query', companyIdQ), async (c) => {
    const { id } = c.req.valid('param');
    const q = c.req.valid('query');
    try {
      return c.json(await deps.getBom.execute({ companyId: q.companyId, bomId: id }));
    } catch (err) {
      mapProductionError(err);
    }
  });

  app.post('/boms', requireWrite, zValidator('json', createBomSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.createBom.execute(b as CreateBomInput), 201);
    } catch (err) {
      mapProductionError(err);
    }
  });

  app.put(
    '/boms/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', updateBomSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(await deps.updateBom.execute({ ...b, bomId: id } as UpdateBomInput));
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  app.delete(
    '/boms/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.deleteBom.execute({ companyId: q.companyId, bomId: id }));
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  app.post(
    '/boms/:id/explode',
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({ companyId: z.number().int().positive(), qty: z.number().positive() }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.explodeBom.execute({ companyId: b.companyId, bomId: id, qty: b.qty }),
        );
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  app.post(
    '/boms/:id/cost',
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        materialPrices: z.record(z.string(), z.number()).optional(),
        overheadPct: z.number().min(0).optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.rollupBomCost.execute({
            companyId: b.companyId,
            bomId: id,
            ...(b.materialPrices !== undefined ? { materialPrices: b.materialPrices } : {}),
            ...(b.overheadPct !== undefined ? { overheadPct: b.overheadPct } : {}),
          }),
        );
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  // GET /boms/:id/cost — fiyat/overhead query'den (kolay önizleme)
  app.get(
    '/boms/:id/cost',
    zValidator('param', idParam),
    zValidator('query', companyIdQ.extend({ overheadPct: z.coerce.number().min(0).optional() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.rollupBomCost.execute({
            companyId: q.companyId,
            bomId: id,
            ...(q.overheadPct !== undefined ? { overheadPct: q.overheadPct } : {}),
          }),
        );
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  // ===== WORK CENTER (İş Merkezi) ==========================================
  app.get(
    '/work-centers',
    zValidator('query', companyIdQ.extend({ includeArchived: z.coerce.boolean().optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const workCenters = await deps.listWorkCenters.execute({
          companyId: q.companyId,
          ...(q.includeArchived !== undefined ? { includeArchived: q.includeArchived } : {}),
        });
        return c.json({ workCenters });
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  app.post('/work-centers', requireWrite, zValidator('json', createWorkCenterSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.createWorkCenter.execute(b as CreateWorkCenterInput), 201);
    } catch (err) {
      mapProductionError(err);
    }
  });

  app.put(
    '/work-centers/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', updateWorkCenterSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.updateWorkCenter.execute({ ...b, workCenterId: id } as UpdateWorkCenterInput),
        );
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  app.delete(
    '/work-centers/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.archiveWorkCenter.execute({ companyId: q.companyId, workCenterId: id }),
        );
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  // ===== PRODUCTION ORDER (Üretim Emri) ====================================
  app.get(
    '/orders',
    zValidator('query', companyIdQ.extend({ status: orderStatus.optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const orders = await deps.listOrders.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
        });
        return c.json({ orders });
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  app.get(
    '/orders/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.getOrder.execute({ companyId: q.companyId, orderId: id }));
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  app.post('/orders', requireWrite, zValidator('json', createOrderSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.createOrder.execute(b as CreateProductionOrderInput), 201);
    } catch (err) {
      mapProductionError(err);
    }
  });

  app.patch(
    '/orders/:id/status',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: z.number().int().positive(), status: orderStatus })),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.updateOrderStatus.execute({
            companyId: b.companyId,
            orderId: id,
            status: b.status,
          }),
        );
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  app.post(
    '/orders/:id/complete',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        producedQty: z.number().min(0),
        scrapQty: z.number().min(0).optional(),
        costSnapshot: costSnapshotSchema.nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.completeOrder.execute({
            companyId: b.companyId,
            orderId: id,
            producedQty: b.producedQty,
            ...(b.scrapQty !== undefined ? { scrapQty: b.scrapQty } : {}),
            ...(b.costSnapshot !== undefined ? { costSnapshot: b.costSnapshot } : {}),
          }),
        );
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  // ===== MRP ===============================================================
  app.post('/mrp/run', requireWrite, zValidator('json', mrpRunSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.runMrp.execute(b));
    } catch (err) {
      mapProductionError(err);
    }
  });

  app.get(
    '/mrp/runs',
    zValidator(
      'query',
      companyIdQ.extend({ limit: z.coerce.number().int().positive().optional() }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const runs = await deps.listMrpRuns.execute({
          companyId: q.companyId,
          ...(q.limit !== undefined ? { limit: q.limit } : {}),
        });
        return c.json({ runs });
      } catch (err) {
        mapProductionError(err);
      }
    },
  );

  return app;
}
