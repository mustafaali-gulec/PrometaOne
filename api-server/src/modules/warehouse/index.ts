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
  CreateWarehouseUseCase,
  DeleteWarehouseUseCase,
  GetWarehouseUseCase,
  ListWarehousesUseCase,
  UpdateWarehouseUseCase,
} from './application/useCases/WarehouseUseCases.js';
import { PgMaterialRepository } from './infrastructure/persistence/PgMaterialRepository.js';
import { PgStockMovementRepository } from './infrastructure/persistence/PgStockMovementRepository.js';
import { PgWarehouseRepository } from './infrastructure/persistence/PgWarehouseRepository.js';
import { createWarehouseRouter, type WarehouseRouterDeps } from './presentation/routes.js';

export function registerWarehouseModule(pool: Pool): ReturnType<typeof createWarehouseRouter> {
  const clock = SystemClock;

  // Repository'ler (pool ile)
  const warehouses = new PgWarehouseRepository(pool);
  const materials = new PgMaterialRepository(pool);
  const movements = new PgStockMovementRepository(pool);

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
  };

  return createWarehouseRouter(deps);
}
