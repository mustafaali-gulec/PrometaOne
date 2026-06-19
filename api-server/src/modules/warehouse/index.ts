/**
 * Warehouse (Depo/Stok/Malzeme — WMS) modülü — Public API + DI composition root.
 *
 * registerWarehouseModule(pool) tüm Pg* repository + use-case'leri wire eder
 * ve Hono router döndürür. api-server/src/index.ts bunu `/v1/warehouse` altına
 * mount eder. (finance/production modülü ile aynı desen.)
 */
import type { Pool } from 'pg';

import { SystemClock } from './application/ports/Clock.js';
import {
  CreateAssignmentUseCase,
  GetAssignmentUseCase,
  ListAssignmentsUseCase,
  ReturnAssignmentUseCase,
} from './application/useCases/AssignmentUseCases.js';
import {
  ApplyInventoryCountUseCase,
  CreateInventoryCountUseCase,
  GetInventoryCountUseCase,
  ListInventoryCountsUseCase,
  UpdateInventoryCountUseCase,
} from './application/useCases/InventoryCountUseCases.js';
import {
  CreateMaterialGroupUseCase,
  DeleteMaterialGroupUseCase,
  GetMaterialGroupUseCase,
  ListMaterialGroupsUseCase,
  UpdateMaterialGroupUseCase,
} from './application/useCases/MaterialGroupUseCases.js';
import {
  ApproveMaterialRequestUseCase,
  CreateMaterialRequestUseCase,
  FulfillMaterialRequestUseCase,
  GetMaterialRequestUseCase,
  ListMaterialRequestsUseCase,
  RejectMaterialRequestUseCase,
  UpdateMaterialRequestUseCase,
} from './application/useCases/MaterialRequestUseCases.js';
import {
  CreateMaterialUseCase,
  DeleteMaterialUseCase,
  GetMaterialUseCase,
  ListMaterialsUseCase,
  UpdateMaterialUseCase,
} from './application/useCases/MaterialUseCases.js';
import {
  GetMaterialLedgerUseCase,
  GetMovementsUseCase,
  GetStockLevelsUseCase,
  RecordMovementUseCase,
} from './application/useCases/StockUseCases.js';
import {
  CreateUnitUseCase,
  DeleteUnitUseCase,
  GetUnitUseCase,
  ListUnitsUseCase,
  UpdateUnitUseCase,
} from './application/useCases/UnitUseCases.js';
import {
  CreateVariantUseCase,
  DeleteVariantUseCase,
  GetVariantUseCase,
  ListVariantsUseCase,
  UpdateVariantUseCase,
} from './application/useCases/VariantUseCases.js';
import {
  CreateWarehouseUseCase,
  DeleteWarehouseUseCase,
  GetWarehouseUseCase,
  ListWarehousesUseCase,
  UpdateWarehouseUseCase,
} from './application/useCases/WarehouseUseCases.js';
import { PgAssignmentRepository } from './infrastructure/persistence/PgAssignmentRepository.js';
import { PgInventoryCountRepository } from './infrastructure/persistence/PgInventoryCountRepository.js';
import { PgMaterialGroupRepository } from './infrastructure/persistence/PgMaterialGroupRepository.js';
import { PgMaterialRepository } from './infrastructure/persistence/PgMaterialRepository.js';
import { PgMaterialRequestRepository } from './infrastructure/persistence/PgMaterialRequestRepository.js';
import { PgStockMovementRepository } from './infrastructure/persistence/PgStockMovementRepository.js';
import { PgUnitRepository } from './infrastructure/persistence/PgUnitRepository.js';
import { PgVariantRepository } from './infrastructure/persistence/PgVariantRepository.js';
import { PgWarehouseRepository } from './infrastructure/persistence/PgWarehouseRepository.js';
import { createWarehouseRouter, type WarehouseRouterDeps } from './presentation/routes.js';

export function registerWarehouseModule(pool: Pool): ReturnType<typeof createWarehouseRouter> {
  const clock = SystemClock;

  // Repository'ler (pool ile)
  const warehouses = new PgWarehouseRepository(pool);
  const materials = new PgMaterialRepository(pool);
  const movements = new PgStockMovementRepository(pool);
  const groups = new PgMaterialGroupRepository(pool);
  const units = new PgUnitRepository(pool);
  const variants = new PgVariantRepository(pool);
  const requests = new PgMaterialRequestRepository(pool);
  const counts = new PgInventoryCountRepository(pool);
  const assignments = new PgAssignmentRepository(pool);

  const deps: WarehouseRouterDeps = {
    // Depo
    createWarehouse: new CreateWarehouseUseCase(warehouses),
    updateWarehouse: new UpdateWarehouseUseCase(warehouses, clock),
    deleteWarehouse: new DeleteWarehouseUseCase(warehouses, movements),
    listWarehouses: new ListWarehousesUseCase(warehouses),
    getWarehouse: new GetWarehouseUseCase(warehouses),
    // Malzeme
    createMaterial: new CreateMaterialUseCase(materials),
    updateMaterial: new UpdateMaterialUseCase(materials, clock),
    deleteMaterial: new DeleteMaterialUseCase(materials, movements),
    listMaterials: new ListMaterialsUseCase(materials),
    getMaterial: new GetMaterialUseCase(materials),
    // Stok
    recordMovement: new RecordMovementUseCase(movements, materials, warehouses, clock),
    getMovements: new GetMovementsUseCase(movements),
    getStockLevels: new GetStockLevelsUseCase(movements, materials),
    getMaterialLedger: new GetMaterialLedgerUseCase(movements, materials),
    // Malzeme grubu
    createMaterialGroup: new CreateMaterialGroupUseCase(groups),
    updateMaterialGroup: new UpdateMaterialGroupUseCase(groups, clock),
    deleteMaterialGroup: new DeleteMaterialGroupUseCase(groups),
    listMaterialGroups: new ListMaterialGroupsUseCase(groups),
    getMaterialGroup: new GetMaterialGroupUseCase(groups),
    // Birim
    createUnit: new CreateUnitUseCase(units),
    updateUnit: new UpdateUnitUseCase(units, clock),
    deleteUnit: new DeleteUnitUseCase(units),
    listUnits: new ListUnitsUseCase(units),
    getUnit: new GetUnitUseCase(units),
    // Varyant
    createVariant: new CreateVariantUseCase(variants),
    updateVariant: new UpdateVariantUseCase(variants, clock),
    deleteVariant: new DeleteVariantUseCase(variants),
    listVariants: new ListVariantsUseCase(variants),
    getVariant: new GetVariantUseCase(variants),
    // Malzeme talep
    createMaterialRequest: new CreateMaterialRequestUseCase(requests, clock),
    updateMaterialRequest: new UpdateMaterialRequestUseCase(requests, clock),
    approveMaterialRequest: new ApproveMaterialRequestUseCase(requests, clock),
    rejectMaterialRequest: new RejectMaterialRequestUseCase(requests, clock),
    fulfillMaterialRequest: new FulfillMaterialRequestUseCase(
      requests,
      materials,
      movements,
      warehouses,
      clock,
    ),
    listMaterialRequests: new ListMaterialRequestsUseCase(requests),
    getMaterialRequest: new GetMaterialRequestUseCase(requests),
    // Envanter sayım
    createInventoryCount: new CreateInventoryCountUseCase(counts, clock),
    updateInventoryCount: new UpdateInventoryCountUseCase(counts, clock),
    applyInventoryCount: new ApplyInventoryCountUseCase(
      counts,
      materials,
      movements,
      warehouses,
      clock,
    ),
    listInventoryCounts: new ListInventoryCountsUseCase(counts),
    getInventoryCount: new GetInventoryCountUseCase(counts),
    // Zimmet
    createAssignment: new CreateAssignmentUseCase(
      assignments,
      materials,
      movements,
      warehouses,
      clock,
    ),
    returnAssignment: new ReturnAssignmentUseCase(assignments, materials, movements, clock),
    listAssignments: new ListAssignmentsUseCase(assignments),
    getAssignment: new GetAssignmentUseCase(assignments),
  };

  return createWarehouseRouter(deps);
}
