/**
 * Production (Üretim & MRP) modülü — Public API + DI composition root.
 *
 * registerProductionModule(pool) tüm Pg* repository + use-case'leri wire eder
 * ve Hono router döndürür. api-server/src/index.ts bunu `/v1/production` altına
 * mount eder. (Finance modülü ile aynı desen.)
 */
import type { Pool } from 'pg';

import { SystemClock } from './application/ports/Clock.js';
import {
  CreateBomUseCase,
  DeleteBomUseCase,
  ExplodeBomUseCase,
  GetBomUseCase,
  ListBomsUseCase,
  RollupBomCostUseCase,
  UpdateBomUseCase,
} from './application/useCases/BomUseCases.js';
import { ListMrpRunsUseCase } from './application/useCases/MrpRunUseCases.js';
import {
  CompleteProductionOrderUseCase,
  CreateProductionOrderUseCase,
  GetProductionOrderUseCase,
  ListProductionOrdersUseCase,
  UpdateProductionOrderStatusUseCase,
} from './application/useCases/ProductionOrderUseCases.js';
import { RunMrpUseCase } from './application/useCases/RunMrpUseCase.js';
import {
  ArchiveWorkCenterUseCase,
  CreateWorkCenterUseCase,
  ListWorkCentersUseCase,
  UpdateWorkCenterUseCase,
} from './application/useCases/WorkCenterUseCases.js';
import { PgBomRepository } from './infrastructure/persistence/PgBomRepository.js';
import { PgMrpRunRepository } from './infrastructure/persistence/PgMrpRunRepository.js';
import { PgProductionOrderRepository } from './infrastructure/persistence/PgProductionOrderRepository.js';
import { PgWorkCenterRepository } from './infrastructure/persistence/PgWorkCenterRepository.js';
import { createProductionRouter, type ProductionRouterDeps } from './presentation/routes.js';

export function registerProductionModule(pool: Pool): ReturnType<typeof createProductionRouter> {
  const clock = SystemClock;

  // Repository'ler
  const boms = new PgBomRepository(pool);
  const workCenters = new PgWorkCenterRepository(pool);
  const orders = new PgProductionOrderRepository(pool);
  const mrpRuns = new PgMrpRunRepository(pool);

  const deps: ProductionRouterDeps = {
    // BOM
    createBom: new CreateBomUseCase(boms, workCenters),
    updateBom: new UpdateBomUseCase(boms, workCenters, clock),
    listBoms: new ListBomsUseCase(boms),
    getBom: new GetBomUseCase(boms),
    deleteBom: new DeleteBomUseCase(boms),
    explodeBom: new ExplodeBomUseCase(boms),
    rollupBomCost: new RollupBomCostUseCase(boms, workCenters),
    // Work center
    createWorkCenter: new CreateWorkCenterUseCase(workCenters),
    updateWorkCenter: new UpdateWorkCenterUseCase(workCenters, clock),
    listWorkCenters: new ListWorkCentersUseCase(workCenters),
    archiveWorkCenter: new ArchiveWorkCenterUseCase(workCenters, clock),
    // Production order
    createOrder: new CreateProductionOrderUseCase(orders, boms),
    listOrders: new ListProductionOrdersUseCase(orders),
    getOrder: new GetProductionOrderUseCase(orders),
    updateOrderStatus: new UpdateProductionOrderStatusUseCase(orders, clock),
    completeOrder: new CompleteProductionOrderUseCase(orders, clock),
    // MRP
    runMrp: new RunMrpUseCase(mrpRuns, clock),
    listMrpRuns: new ListMrpRunsUseCase(mrpRuns),
  };

  return createProductionRouter(deps);
}
