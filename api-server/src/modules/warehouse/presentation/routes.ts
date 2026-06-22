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
  CreateAssignmentInput,
  CreateAssignmentUseCase,
  GetAssignmentUseCase,
  ListAssignmentsUseCase,
  ReturnAssignmentUseCase,
} from '../application/useCases/AssignmentUseCases.js';
import type {
  ApplyInventoryCountUseCase,
  CreateInventoryCountInput,
  CreateInventoryCountUseCase,
  GetInventoryCountUseCase,
  ListInventoryCountsUseCase,
  UpdateInventoryCountInput,
  UpdateInventoryCountUseCase,
} from '../application/useCases/InventoryCountUseCases.js';
import type {
  CreateMaterialGroupInput,
  CreateMaterialGroupUseCase,
  DeleteMaterialGroupUseCase,
  GetMaterialGroupUseCase,
  ListMaterialGroupsUseCase,
  UpdateMaterialGroupInput,
  UpdateMaterialGroupUseCase,
} from '../application/useCases/MaterialGroupUseCases.js';
import type {
  ApproveMaterialRequestUseCase,
  CreateMaterialRequestInput,
  CreateMaterialRequestUseCase,
  FulfillMaterialRequestUseCase,
  GetMaterialRequestUseCase,
  ListMaterialRequestsUseCase,
  RejectMaterialRequestUseCase,
  UpdateMaterialRequestInput,
  UpdateMaterialRequestUseCase,
} from '../application/useCases/MaterialRequestUseCases.js';
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
  CreateUnitUseCase,
  DeleteUnitUseCase,
  GetUnitUseCase,
  ListUnitsUseCase,
  UpdateUnitInput,
  UpdateUnitUseCase,
} from '../application/useCases/UnitUseCases.js';
import type {
  CreateVariantInput,
  CreateVariantUseCase,
  DeleteVariantUseCase,
  GetVariantUseCase,
  ListVariantsUseCase,
  UpdateVariantInput,
  UpdateVariantUseCase,
} from '../application/useCases/VariantUseCases.js';
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
  // Malzeme grubu
  createMaterialGroup: CreateMaterialGroupUseCase;
  updateMaterialGroup: UpdateMaterialGroupUseCase;
  deleteMaterialGroup: DeleteMaterialGroupUseCase;
  listMaterialGroups: ListMaterialGroupsUseCase;
  getMaterialGroup: GetMaterialGroupUseCase;
  // Birim
  createUnit: CreateUnitUseCase;
  updateUnit: UpdateUnitUseCase;
  deleteUnit: DeleteUnitUseCase;
  listUnits: ListUnitsUseCase;
  getUnit: GetUnitUseCase;
  // Varyant
  createVariant: CreateVariantUseCase;
  updateVariant: UpdateVariantUseCase;
  deleteVariant: DeleteVariantUseCase;
  listVariants: ListVariantsUseCase;
  getVariant: GetVariantUseCase;
  // Malzeme talep
  createMaterialRequest: CreateMaterialRequestUseCase;
  updateMaterialRequest: UpdateMaterialRequestUseCase;
  approveMaterialRequest: ApproveMaterialRequestUseCase;
  rejectMaterialRequest: RejectMaterialRequestUseCase;
  fulfillMaterialRequest: FulfillMaterialRequestUseCase;
  listMaterialRequests: ListMaterialRequestsUseCase;
  getMaterialRequest: GetMaterialRequestUseCase;
  // Envanter sayım
  createInventoryCount: CreateInventoryCountUseCase;
  updateInventoryCount: UpdateInventoryCountUseCase;
  applyInventoryCount: ApplyInventoryCountUseCase;
  listInventoryCounts: ListInventoryCountsUseCase;
  getInventoryCount: GetInventoryCountUseCase;
  // Zimmet
  createAssignment: CreateAssignmentUseCase;
  returnAssignment: ReturnAssignmentUseCase;
  listAssignments: ListAssignmentsUseCase;
  getAssignment: GetAssignmentUseCase;
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
  purchasePrice: z.number().nullable().optional(),
  salePrice: z.number().nullable().optional(),
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

// --- Aux statuses ---------------------------------------------------------
const groupStatus = z.enum(['active', 'passive']);
const variantStatus = z.enum(['active', 'passive']);
const materialRequestStatus = z.enum(['pending', 'approved', 'rejected', 'fulfilled']);
const inventoryCountStatus = z.enum(['open', 'applied']);
const assignmentStatus = z.enum(['open', 'returned']);

// --- MaterialGroup schemas ------------------------------------------------
const createGroupSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  status: groupStatus.optional(),
});
const updateGroupSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(200).optional(),
  status: groupStatus.optional(),
});

// --- Unit schemas ---------------------------------------------------------
const createUnitSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
});
const updateUnitSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(200).optional(),
});

// --- Variant schemas ------------------------------------------------------
const variantOptionSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
});
const createVariantSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  status: variantStatus.optional(),
  options: z.array(variantOptionSchema).optional(),
});
const updateVariantSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(200).optional(),
  status: variantStatus.optional(),
  options: z.array(variantOptionSchema).optional(),
});

// --- MaterialRequest schemas ----------------------------------------------
const requestItemSchema = z.object({
  materialId: z.number().int().positive(),
  qty: z.number().positive(),
  unit: z.string().min(1).max(40).nullable().optional(),
});
const createRequestSchema = z.object({
  companyId: z.number().int().positive(),
  date: dateStr,
  requesterUnit: z.string().max(200).nullable().optional(),
  requester: z.string().max(200).nullable().optional(),
  requestedWarehouseId: z.number().int().positive().nullable().optional(),
  validityDays: z.number().int().nonnegative().nullable().optional(),
  items: z.array(requestItemSchema).min(1),
  note: z.string().nullable().optional(),
});
const updateRequestSchema = z.object({
  companyId: z.number().int().positive(),
  date: dateStr.optional(),
  requesterUnit: z.string().max(200).nullable().optional(),
  requester: z.string().max(200).nullable().optional(),
  requestedWarehouseId: z.number().int().positive().nullable().optional(),
  validityDays: z.number().int().nonnegative().nullable().optional(),
  items: z.array(requestItemSchema).min(1).optional(),
  note: z.string().nullable().optional(),
});
const rejectRequestSchema = z.object({
  companyId: z.number().int().positive(),
  reason: z.string().min(1),
});
const requestActionSchema = z.object({ companyId: z.number().int().positive() });

// --- InventoryCount schemas -----------------------------------------------
const countItemSchema = z.object({
  materialId: z.number().int().positive(),
  systemQty: z.number(),
  countedQty: z.number(),
});
const createCountSchema = z.object({
  companyId: z.number().int().positive(),
  date: dateStr,
  warehouseId: z.number().int().positive(),
  period: z.string().max(60).nullable().optional(),
  items: z.array(countItemSchema).min(1),
});
const updateCountSchema = z.object({
  companyId: z.number().int().positive(),
  date: dateStr.optional(),
  warehouseId: z.number().int().positive().optional(),
  period: z.string().max(60).nullable().optional(),
  items: z.array(countItemSchema).min(1).optional(),
});
const countActionSchema = z.object({ companyId: z.number().int().positive() });

// --- Assignment schemas ---------------------------------------------------
const assignmentItemSchema = z.object({
  materialId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  qty: z.number().positive(),
});
const createAssignmentSchema = z.object({
  companyId: z.number().int().positive(),
  date: dateStr,
  person: z.string().max(200).nullable().optional(),
  birim: z.string().max(200).nullable().optional(),
  items: z.array(assignmentItemSchema).min(1),
  note: z.string().nullable().optional(),
});
const assignmentActionSchema = z.object({ companyId: z.number().int().positive() });

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

  // ===== MATERIAL GROUP (Malzeme Grubu) ===================================
  app.get(
    '/groups',
    zValidator('query', companyIdQ.extend({ status: groupStatus.optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const groups = await deps.listMaterialGroups.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
        });
        return c.json({ groups });
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.get(
    '/groups/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.getMaterialGroup.execute({ companyId: q.companyId, groupId: id }));
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post('/groups', requireWrite, zValidator('json', createGroupSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.createMaterialGroup.execute(b as CreateMaterialGroupInput), 201);
    } catch (err) {
      mapWarehouseError(err);
    }
  });

  app.put(
    '/groups/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', updateGroupSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.updateMaterialGroup.execute({ ...b, groupId: id } as UpdateMaterialGroupInput),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.delete(
    '/groups/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.deleteMaterialGroup.execute({ companyId: q.companyId, groupId: id }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  // ===== UNIT (Ölçü Birimi) ===============================================
  app.get('/units', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const units = await deps.listUnits.execute({ companyId: q.companyId });
      return c.json({ units });
    } catch (err) {
      mapWarehouseError(err);
    }
  });

  app.get(
    '/units/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.getUnit.execute({ companyId: q.companyId, unitId: id }));
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post('/units', requireWrite, zValidator('json', createUnitSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.createUnit.execute(b), 201);
    } catch (err) {
      mapWarehouseError(err);
    }
  });

  app.put(
    '/units/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', updateUnitSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(await deps.updateUnit.execute({ ...b, unitId: id } as UpdateUnitInput));
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.delete(
    '/units/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.deleteUnit.execute({ companyId: q.companyId, unitId: id }));
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  // ===== VARIANT (Varyant) ================================================
  app.get(
    '/variants',
    zValidator('query', companyIdQ.extend({ status: variantStatus.optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const variants = await deps.listVariants.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
        });
        return c.json({ variants });
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.get(
    '/variants/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.getVariant.execute({ companyId: q.companyId, variantId: id }));
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post('/variants', requireWrite, zValidator('json', createVariantSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.createVariant.execute(b as CreateVariantInput), 201);
    } catch (err) {
      mapWarehouseError(err);
    }
  });

  app.put(
    '/variants/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', updateVariantSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.updateVariant.execute({ ...b, variantId: id } as UpdateVariantInput),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.delete(
    '/variants/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.deleteVariant.execute({ companyId: q.companyId, variantId: id }));
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  // ===== MATERIAL REQUEST (Malzeme Talep) =================================
  app.get(
    '/requests',
    zValidator('query', companyIdQ.extend({ status: materialRequestStatus.optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const requests = await deps.listMaterialRequests.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
        });
        return c.json({ requests });
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.get(
    '/requests/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getMaterialRequest.execute({ companyId: q.companyId, requestId: id }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post('/requests', requireWrite, zValidator('json', createRequestSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.createMaterialRequest.execute(b as CreateMaterialRequestInput), 201);
    } catch (err) {
      mapWarehouseError(err);
    }
  });

  app.put(
    '/requests/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', updateRequestSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.updateMaterialRequest.execute({
            ...b,
            requestId: id,
          } as UpdateMaterialRequestInput),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post(
    '/requests/:id/approve',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', requestActionSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.approveMaterialRequest.execute({ companyId: b.companyId, requestId: id }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post(
    '/requests/:id/reject',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', rejectRequestSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.rejectMaterialRequest.execute({
            companyId: b.companyId,
            requestId: id,
            reason: b.reason,
          }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post(
    '/requests/:id/fulfill',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', requestActionSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.fulfillMaterialRequest.execute({
            companyId: b.companyId,
            requestId: id,
            actorUserId: actor(c),
          }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  // ===== INVENTORY COUNT (Envanter Sayım) =================================
  app.get(
    '/counts',
    zValidator(
      'query',
      companyIdQ.extend({
        status: inventoryCountStatus.optional(),
        warehouseId: z.coerce.number().int().positive().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const counts = await deps.listInventoryCounts.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
          ...(q.warehouseId !== undefined ? { warehouseId: q.warehouseId } : {}),
        });
        return c.json({ counts });
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.get(
    '/counts/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getInventoryCount.execute({ companyId: q.companyId, countId: id }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post('/counts', requireWrite, zValidator('json', createCountSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(await deps.createInventoryCount.execute(b as CreateInventoryCountInput), 201);
    } catch (err) {
      mapWarehouseError(err);
    }
  });

  app.put(
    '/counts/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', updateCountSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.updateInventoryCount.execute({
            ...b,
            countId: id,
          } as UpdateInventoryCountInput),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post(
    '/counts/:id/apply',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', countActionSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.applyInventoryCount.execute({
            companyId: b.companyId,
            countId: id,
            actorUserId: actor(c),
          }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  // ===== ASSIGNMENT (Zimmet) ==============================================
  app.get(
    '/assignments',
    zValidator('query', companyIdQ.extend({ status: assignmentStatus.optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const assignments = await deps.listAssignments.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
        });
        return c.json({ assignments });
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.get(
    '/assignments/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getAssignment.execute({ companyId: q.companyId, assignmentId: id }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  app.post('/assignments', requireWrite, zValidator('json', createAssignmentSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(
        await deps.createAssignment.execute({
          ...b,
          actorUserId: actor(c),
        } as CreateAssignmentInput),
        201,
      );
    } catch (err) {
      mapWarehouseError(err);
    }
  });

  app.post(
    '/assignments/:id/return',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', assignmentActionSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.returnAssignment.execute({
            companyId: b.companyId,
            assignmentId: id,
            actorUserId: actor(c),
          }),
        );
      } catch (err) {
        mapWarehouseError(err);
      }
    },
  );

  return app;
}
