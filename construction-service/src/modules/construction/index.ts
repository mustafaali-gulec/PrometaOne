/**
 * Construction (Şantiye Yönetim) modülü — Public API + DI.
 *
 * registerConstructionModule(pool) Pg* repository + use-case'leri wire eder ve
 * Hono router döndürür. src/index.ts bunu `/v1/construction` altına mount eder.
 *
 * Faz SF-1 kapsamı: Projeler (özel/ihaleli) + Sözleşmeler (işveren/taşeron + ihale
 * bilgisi). Faz SF-2: Poz katalog + Keşif (BoQ) + pursantaj. Sonraki fazlar:
 * hakediş (SF-3), harcama (SF-4), malzeme/depo (SF-5), işgücü/makine (SF-6).
 */
import type { Pool } from 'pg';

import { SystemClock } from './application/ports/Clock.js';
import type { EventPublisher } from './application/ports/EventPublisher.js';
import { GetBoqUseCase, SaveBoqLinesUseCase } from './application/useCases/BoqUseCases.js';
import {
  CreateContractUseCase,
  ListContractsUseCase,
  UpdateContractUseCase,
} from './application/useCases/ContractUseCases.js';
import {
  CreateAdvanceUseCase,
  CreateCashMovementUseCase,
  CreateExpenseUseCase,
  CreateManualPaymentUseCase,
  DeleteAdvanceUseCase,
  DeleteCashMovementUseCase,
  DeleteExpenseUseCase,
  DeleteManualPaymentUseCase,
  GetProjectCostSummaryUseCase,
  ListAdvancesUseCase,
  ListCashMovementsUseCase,
  ListExpensesUseCase,
  ListPaymentListUseCase,
  UpdateAdvanceUseCase,
  UpdateExpenseUseCase,
  UpdateManualPaymentUseCase,
} from './application/useCases/FinanceUseCases.js';
import {
  CreateMachineLogUseCase,
  CreateMachineUseCase,
  CreatePersonnelUseCase,
  DeactivatePersonnelUseCase,
  DeleteMachineLogUseCase,
  DeleteTimesheetUseCase,
  GetLaborCostSummaryUseCase,
  ListMachineLogsUseCase,
  ListMachinesUseCase,
  ListPersonnelUseCase,
  ListTimesheetsUseCase,
  SaveTimesheetUseCase,
  UpdateMachineUseCase,
  UpdatePersonnelUseCase,
} from './application/useCases/LaborUseCases.js';
import {
  ChangeMaterialRequestStatusUseCase,
  CreateMaterialRequestUseCase,
  CreateMaterialUseCase,
  CreateWarehouseUseCase,
  DeactivateMaterialUseCase,
  GetMaterialRequestUseCase,
  ListMaterialRequestsUseCase,
  ListMaterialsUseCase,
  ListMovementsUseCase,
  ListStockUseCase,
  ListWarehousesUseCase,
  RecordStockMovementUseCase,
  SaveMaterialRequestLinesUseCase,
  UpdateMaterialUseCase,
} from './application/useCases/MaterialUseCases.js';
import {
  CreatePozUseCase,
  DeactivatePozUseCase,
  ListPozUseCase,
  UpdatePozUseCase,
} from './application/useCases/PozUseCases.js';
import {
  ChangeProgressStatusUseCase,
  CreateProgressPaymentUseCase,
  GetProgressPaymentUseCase,
  ListProgressPaymentsUseCase,
  SaveDeductionsUseCase,
  SaveProgressLinesUseCase,
} from './application/useCases/ProgressUseCases.js';
import {
  ChangeProjectStatusUseCase,
  CreateProjectUseCase,
  DeactivateProjectUseCase,
  ListProjectsUseCase,
  UpdateProjectUseCase,
} from './application/useCases/ProjectUseCases.js';
import {
  GetProgressCurveUseCase,
  GetProjectDashboardUseCase,
} from './application/useCases/ReportUseCases.js';
import { PgBoqRepository } from './infrastructure/persistence/PgBoqRepository.js';
import { PgContractRepository } from './infrastructure/persistence/PgContractRepository.js';
import {
  PgAdvanceRepository,
  PgCashMovementRepository,
  PgExpenseRepository,
  PgPaymentRepository,
} from './infrastructure/persistence/PgFinanceRepositories.js';
import {
  PgLaborCostRepository,
  PgMachineLogRepository,
  PgMachineRepository,
  PgPersonnelRepository,
  PgTimesheetRepository,
} from './infrastructure/persistence/PgLaborRepositories.js';
import {
  PgMaterialRepository,
  PgMaterialRequestRepository,
  PgStockRepository,
  PgWarehouseRepository,
} from './infrastructure/persistence/PgMaterialRepositories.js';
import { PgPozCatalogRepository } from './infrastructure/persistence/PgPozCatalogRepository.js';
import { PgProgressPaymentRepository } from './infrastructure/persistence/PgProgressPaymentRepository.js';
import { PgProjectRepository } from './infrastructure/persistence/PgProjectRepository.js';
import { createConstructionRouter, type ConstructionRouterDeps } from './presentation/routes.js';

export function registerConstructionModule(
  pool: Pool,
  events: EventPublisher,
): ReturnType<typeof createConstructionRouter> {
  const clock = SystemClock;

  const projects = new PgProjectRepository(pool);
  const contracts = new PgContractRepository(pool);
  const pozs = new PgPozCatalogRepository(pool);
  const boq = new PgBoqRepository(pool);
  const progress = new PgProgressPaymentRepository(pool);
  const expenses = new PgExpenseRepository(pool);
  const advances = new PgAdvanceRepository(pool);
  const cash = new PgCashMovementRepository(pool);
  const payments = new PgPaymentRepository(pool);
  const materials = new PgMaterialRepository(pool);
  const warehouses = new PgWarehouseRepository(pool);
  const stock = new PgStockRepository(pool);
  const materialRequests = new PgMaterialRequestRepository(pool);
  const personnel = new PgPersonnelRepository(pool);
  const timesheets = new PgTimesheetRepository(pool);
  const machines = new PgMachineRepository(pool);
  const machineLogs = new PgMachineLogRepository(pool);
  const laborCost = new PgLaborCostRepository(pool);

  const deps: ConstructionRouterDeps = {
    createProject: new CreateProjectUseCase(projects),
    listProjects: new ListProjectsUseCase(projects),
    updateProject: new UpdateProjectUseCase(projects, clock),
    changeProjectStatus: new ChangeProjectStatusUseCase(projects, clock),
    deactivateProject: new DeactivateProjectUseCase(projects, clock),
    createContract: new CreateContractUseCase(contracts, projects, clock),
    listContracts: new ListContractsUseCase(contracts),
    updateContract: new UpdateContractUseCase(contracts, clock),
    createPoz: new CreatePozUseCase(pozs),
    listPoz: new ListPozUseCase(pozs),
    updatePoz: new UpdatePozUseCase(pozs, clock),
    deactivatePoz: new DeactivatePozUseCase(pozs, clock),
    getBoq: new GetBoqUseCase(boq, contracts),
    saveBoqLines: new SaveBoqLinesUseCase(boq, contracts),
    createProgress: new CreateProgressPaymentUseCase(progress, contracts, boq, clock),
    getProgress: new GetProgressPaymentUseCase(progress),
    listProgress: new ListProgressPaymentsUseCase(progress),
    saveProgressLines: new SaveProgressLinesUseCase(progress),
    saveDeductions: new SaveDeductionsUseCase(progress),
    changeProgressStatus: new ChangeProgressStatusUseCase(progress, clock, events),
    createExpense: new CreateExpenseUseCase(expenses, projects),
    listExpenses: new ListExpensesUseCase(expenses),
    updateExpense: new UpdateExpenseUseCase(expenses, clock),
    deleteExpense: new DeleteExpenseUseCase(expenses),
    getCostSummary: new GetProjectCostSummaryUseCase(expenses, projects),
    createAdvance: new CreateAdvanceUseCase(advances, projects),
    listAdvances: new ListAdvancesUseCase(advances),
    updateAdvance: new UpdateAdvanceUseCase(advances, clock),
    deleteAdvance: new DeleteAdvanceUseCase(advances),
    createCashMovement: new CreateCashMovementUseCase(cash, projects),
    listCashMovements: new ListCashMovementsUseCase(cash),
    deleteCashMovement: new DeleteCashMovementUseCase(cash),
    listPayments: new ListPaymentListUseCase(payments),
    createPayment: new CreateManualPaymentUseCase(payments),
    updatePayment: new UpdateManualPaymentUseCase(payments),
    deletePayment: new DeleteManualPaymentUseCase(payments),
    createMaterial: new CreateMaterialUseCase(materials),
    listMaterials: new ListMaterialsUseCase(materials),
    updateMaterial: new UpdateMaterialUseCase(materials, clock),
    deactivateMaterial: new DeactivateMaterialUseCase(materials, clock),
    createWarehouse: new CreateWarehouseUseCase(warehouses, projects),
    listWarehouses: new ListWarehousesUseCase(warehouses),
    recordStockMovement: new RecordStockMovementUseCase(stock, materials, warehouses, events),
    listStock: new ListStockUseCase(stock),
    listMovements: new ListMovementsUseCase(stock),
    createMaterialRequest: new CreateMaterialRequestUseCase(materialRequests, projects, clock),
    getMaterialRequest: new GetMaterialRequestUseCase(materialRequests),
    listMaterialRequests: new ListMaterialRequestsUseCase(materialRequests),
    saveMaterialRequestLines: new SaveMaterialRequestLinesUseCase(materialRequests),
    changeMaterialRequestStatus: new ChangeMaterialRequestStatusUseCase(materialRequests, clock),
    createPersonnel: new CreatePersonnelUseCase(personnel, projects),
    listPersonnel: new ListPersonnelUseCase(personnel),
    updatePersonnel: new UpdatePersonnelUseCase(personnel, clock),
    deactivatePersonnel: new DeactivatePersonnelUseCase(personnel, clock),
    saveTimesheet: new SaveTimesheetUseCase(timesheets, personnel),
    listTimesheets: new ListTimesheetsUseCase(timesheets),
    deleteTimesheet: new DeleteTimesheetUseCase(timesheets),
    createMachine: new CreateMachineUseCase(machines),
    listMachines: new ListMachinesUseCase(machines),
    updateMachine: new UpdateMachineUseCase(machines, clock),
    createMachineLog: new CreateMachineLogUseCase(machineLogs, machines, projects),
    listMachineLogs: new ListMachineLogsUseCase(machineLogs),
    deleteMachineLog: new DeleteMachineLogUseCase(machineLogs),
    getLaborCostSummary: new GetLaborCostSummaryUseCase(laborCost, projects),
    getProjectDashboard: new GetProjectDashboardUseCase(
      projects,
      contracts,
      boq,
      progress,
      expenses,
      laborCost,
    ),
    getProgressCurve: new GetProgressCurveUseCase(progress, contracts),
  };

  return createConstructionRouter(deps);
}
