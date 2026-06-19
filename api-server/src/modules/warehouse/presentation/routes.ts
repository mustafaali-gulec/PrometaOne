/**
 * Warehouse (Depo/Stok/Malzeme — WMS) HTTP route'ları.
 *
 * Tüm endpoint'ler authMiddleware ile korunur; yazma işlemleri 'cfo' rolü ister
 * (finance/production modülü ile aynı politika). companyId body/query'den alınır;
 * multi-tenant izolasyon repo'larda. Bu dosya use-case'leri çağırır, iş kuralı
 * yazmaz; hata mapping errorMapping.ts'de.
 *
 * Yollar (index.ts /v1/warehouse altına mount eder):
 *   GET/POST /warehouses, GET/PUT/DELETE /warehouses/:id
 *   GET/POST /materials, GET/PUT/DELETE /materials/:id, GET /materials/:id/ledger
 *   POST /movements, GET /movements, GET /stock-levels
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../../middleware/auth.js';
import type {
  CreateMaterialInput,
  CreateMaterialUseCase,
  DeleteMaterialUseCase,
  GetMaterialUseCase,
  ListMaterialsUseCase,
  UpdateMaterialInput,
  UpdateMaterialUseCase,
} from '../application/useCases/MaterialUseCases.js';
import type {
  GetMaterialLedgerUseCase,
  GetMovementsUseCase,
  GetStockLevelsUseCase,
  RecordMovementInput,
  RecordMovementUseCase,
} from '../application/useCases/StockUseCases.js';
import type {
  CreateWarehouseInput,
  CreateWarehouseUseCase,
  DeleteWarehouseUseCase,
  GetWarehouseUseCase,
  ListWarehousesUseCase,
  UpdateWarehouseInput,
  UpdateWarehouseUseCase,
} from '../application/useCases/WarehouseUseCases.js';

import { mapWarehouseError } from './errorMapping.js';

export interface WarehouseRouterDeps {
  // Depo
  createWarehouse: CreateWarehouseUseCase;
  updateWarehouse: UpdateWarehouseUseCase;
  deleteWarehouse: DeleteWarehouseUseCase;
  listWarehouses: ListWarehousesUseCase;
  getWarehouse: GetWarehouseUseCase;
  // Malzeme
  createMaterial: CreateMaterialUseCase;
  updateMaterial: UpdateMaterialUseCase;
  deleteMaterial: DeleteMaterialUseCase;
  listMaterials: ListMaterialsUseCase;
  getMaterial: GetMaterialUseCase;
  // Stok
  recordMovement: RecordMovementUseCase;
  getMovements: GetMovementsUseCase;
  getStockLevels: GetStockLevelsUseCase;
  getMaterialLedger: GetMaterialLedgerUseCase;
}

// --- Schema fragmanları ---------------------------------------------------
const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const warehouseStatus = z.enum(['active', 'passive']);
const locationStatus = z.enum(['active', 'passive', 'blocked']);
const materialStatus = z.enum(['active', 'passive']);
const trackMethod = z.enum(['none', 'lot', 'serial', 'serialGroup']);
const costMethod = z.enum(['avg', 'fifo', 'lifo', 'actual']);
const negativeControl = z.enum(['block', 'allow']);
const abcClass = z.enum(['A', 'B', 'C']);
const movementKind = z.enum(['in', 'out', 'transfer', 'count']);

const locationSchema = z.object({
  id: z.number().int().positive().nullable().optional().default(null),
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  room: z.string().max(80).nullable().optional().default(null),
  aisle: z.string().max(80).nullable().optional().default(null),
  shelf: z.string().max(80).nullable().optional().default(null),
  bin: z.string().max(80).nullable().optional().default(null),
  status: locationStatus.default('active'),
});

const altUnitSchema = z.object({
  unit: z.string().min(1).max(40),
  factor: z.number().positive(),
  barcode: z.string().max(120).nullable().optional().default(null),
});

const whParamSchema = z.object({
  warehouseId: z.number().int().positive(),
  minStock: z.number().nullable().optional().default(null),
  maxStock: z.number().nullable().optional().default(null),
  safetyStock: z.number().nullable().optional().default(null),
  locationId: z.number().int().positive().nullable().optional().default(null),
});

const lotSchema = z.object({
  no: z.string().min(1).max(120),
  qty: z.number().positive(),
  expiry: dateStr.nullable().optional().default(null),
});

// --- Warehouse schemas ----------------------------------------------------
const createWarehouseSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  unitName: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  district: z.string().max(100).nullable().optional(),
  address: z.string().nullable().optional(),
  manager: z.string().max(200).nullable().optional(),
  status: warehouseStatus.optional(),
  locations: z.array(locationSchema).optional(),
});

const updateWarehouseSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(200).optional(),
  unitName: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  district: z.string().max(100).nullable().optional(),
  address: z.string().nullable().optional(),
  manager: z.string().max(200).nullable().optional(),
  status: warehouseStatus.optional(),
  locations: z.array(locationSchema).optional(),
});

// --- Material schemas -----------------------------------------------------
const materialBody = {
  groupId: z.number().int().positive().nullable().optional(),
  type: z.string().max(60).nullable().optional(),
  altUnits: z.array(altUnitSchema).optional(),
  brand: z.string().max(120).nullable().optional(),
  barcode: z.string().max(120).nullable().optional(),
  producerCode: z.string().max(120).nullable().optional(),
  gtip: z.string().max(40).nullable().optional(),
  abc: abcClass.nullable().optional(),
  trackMethod: trackMethod.optional(),
  costMethod: costMethod.optional(),
  negativeControl: negativeControl.optional(),
  minStock: z.number().nullable().optional(),
  maxStock: z.number().nullable().optional(),
  safetyStock: z.number().nullable().optional(),
  shelfLifeMonths: z.number().int().nonnegative().nullable().optional(),
  perishable: z.boolean().optional(),
  fragile: z.boolean().optional(),
  kdvPurchase: z.number().nullable().optional(),
  kdvSale: z.number().nullable().optional(),
  tevkifatCode: z.string().max(40).nullable().optional(),
  extraTaxRate: z.number().nullable().optional(),
  whParams: z.array(whParamSchema).optional(),
  status: materialStatus.optional(),
} as const;

const createMaterialSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  baseUnit: z.string().min(1).max(40),
  ...materialBody,
});

const updateMaterialSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(200).optional(),
  baseUnit: z.string().min(1).max(40).optional(),
  ...materialBody,
});

// --- Movement schema ------------------------------------------------------
const recordMovementSchema = z.object({
  companyId: z.number().int().positive(),
  kind: movementKind,
  subType: z.string().max(60).nullable().optional(),
  date: dateStr,
  warehouseId: z.number().int().positive().nullable().optional(),
  fromWarehouseId: z.number().int().positive().nullable().optional(),
  toWarehouseId: z.number().int().positive().nullable().optional(),
  materialId: z.number().int().positive(),
  qty: z.number().positive(),
  unit: z.string().min(1).max(40).optional(),
  unitPrice: z.number().nullable().optional(),
  unitCostBase: z.number().nullable().optional(),
  lots: z.array(lotSchema).optional(),
  locationId: z.number().int().positive().nullable().optional(),
  partyId: z.number().int().positive().nullable().optional(),
  person: z.string().max(200).nullable().optional(),
  docNo: z.string().max(120).nullable().optional(),
  note: z.string().nullable().optional(),
});

export function createWarehouseRouter(deps: WarehouseRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  const requireWrite = requireRole('cfo');

  const actor = (c: { get: (k: string) => unknown }): number | null => {
    const auth = c.get('auth') as { userId?: number } | undefined;
    return auth?.userId ?? null;
  };

  // ===== WAREHOUSE (Depo) =================================================
  app.get(
    '/warehouses',
    zValidator('query', companyIdQ.extend({ status: warehouseStatus.optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const warehouses = await deps.listWarehouses.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
        });
        return c.json({ warehouses });
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.get(
    '/warehouses/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.getWarehouse.execute({ companyId: q.companyId, warehouseId: id }));
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post('/warehouses', requireWrite, zValidator('json', createWarehouseSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.createWarehouse.execute(b as CreateWarehouseInput), 201);
    } catch (err) {
      mapWarehouseError(err);
    }
  });

  app.put(
    '/warehouses/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', updateWarehouseSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.updateWarehouse.execute({ ...b, warehouseId: id } as UpdateWarehouseInput),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.delete(
    '/warehouses/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.deleteWarehouse.execute({ companyId: q.companyId, warehouseId: id }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  // ===== MATERIAL (Malzeme / Stok Kartı) ==================================
  app.get(
    '/materials',
    zValidator(
      'query',
      companyIdQ.extend({
        status: materialStatus.optional(),
        groupId: z.coerce.number().int().positive().optional(),
        search: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const materials = await deps.listMaterials.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
          ...(q.groupId !== undefined ? { groupId: q.groupId } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
        });
        return c.json({ materials });
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.get(
    '/materials/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.getMaterial.execute({ companyId: q.companyId, materialId: id }));
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post('/materials', requireWrite, zValidator('json', createMaterialSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.createMaterial.execute(b as CreateMaterialInput), 201);
    } catch (err) {
      mapWarehouseError(err);
    }
  });

  app.put(
    '/materials/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', updateMaterialSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.updateMaterial.execute({ ...b, materialId: id } as UpdateMaterialInput),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.delete(
    '/materials/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.deleteMaterial.execute({ companyId: q.companyId, materialId: id }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  // Malzeme yürüyen bakiye (running balance / kartex)
  app.get(
    '/materials/:id/ledger',
    zValidator('param', idParam),
    zValidator(
      'query',
      companyIdQ.extend({ warehouseId: z.coerce.number().int().positive().optional() }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getMaterialLedger.execute({
            companyId: q.companyId,
            materialId: id,
            ...(q.warehouseId !== undefined ? { warehouseId: q.warehouseId } : {}),
          }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  // ===== STOCK (Hareket & Seviye) =========================================
  app.post('/movements', requireWrite, zValidator('json', recordMovementSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(
        await deps.recordMovement.execute({
          ...b,
          actorUserId: actor(c),
        } as RecordMovementInput),
        201,
      );
    } catch (err) {
      mapWarehouseError(err);
    }
  });

  app.get(
    '/movements',
    zValidator(
      'query',
      companyIdQ.extend({
        materialId: z.coerce.number().int().positive().optional(),
        warehouseId: z.coerce.number().int().positive().optional(),
        kind: movementKind.optional(),
        dateFrom: dateStr.optional(),
        dateTo: dateStr.optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const movements = await deps.getMovements.execute({
          companyId: q.companyId,
          ...(q.materialId !== undefined ? { materialId: q.materialId } : {}),
          ...(q.warehouseId !== undefined ? { warehouseId: q.warehouseId } : {}),
          ...(q.kind !== undefined ? { kind: q.kind } : {}),
          ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
          ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
        });
        return c.json({ movements });
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.get(
    '/stock-levels',
    zValidator(
      'query',
      companyIdQ.extend({
        materialId: z.coerce.number().int().positive().optional(),
        warehouseId: z.coerce.number().int().positive().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const levels = await deps.getStockLevels.execute({
          companyId: q.companyId,
          ...(q.materialId !== undefined ? { materialId: q.materialId } : {}),
          ...(q.warehouseId !== undefined ? { warehouseId: q.warehouseId } : {}),
        });
        return c.json({ levels });
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  return app;
}
