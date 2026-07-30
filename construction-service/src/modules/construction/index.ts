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
import {
  CancelApprovalFlowUseCase,
  DecideApprovalStepUseCase,
  GetApprovalFlowUseCase,
  GetApprovalHistoryUseCase,
  GetApprovalSummariesForDocsUseCase,
  GetDocApprovalUseCase,
  GetMyApprovalsUseCase,
  ListApprovalFlowsUseCase,
  StartApprovalFlowUseCase,
} from './application/useCases/ApprovalUseCases.js';
import { GetBoqUseCase, SaveBoqLinesUseCase } from './application/useCases/BoqUseCases.js';
import {
  CancelCommitmentUseCase,
  CloseCommitmentUseCase,
  CreateCommitmentUseCase,
  GetContractEvmUseCase,
  GetProjectEvmUseCase,
  ListCommitmentsUseCase,
  RecordCommitmentDeliveryUseCase,
  SyncCommitmentsUseCase,
  UpdateCommitmentUseCase,
} from './application/useCases/CommitmentUseCases.js';
import {
  CreateContractUseCase,
  ListContractsUseCase,
  UpdateContractUseCase,
} from './application/useCases/ContractUseCases.js';
import {
  AddDailyLogCommentUseCase,
  AddDailyLogFileUseCase,
  ChangeDailyLogStatusUseCase,
  DeleteDailyLogEntryUseCase,
  DeleteDailyLogFileUseCase,
  GetDailyLogDayUseCase,
  GetDailyLogMonthUseCase,
  GetManpowerReportUseCase,
  GetMaterialConsumptionUseCase,
  GetProductionActualsUseCase,
  GetSafetySummaryUseCase,
  SaveDailyLogEntryUseCase,
  UpdateDailyLogUseCase,
} from './application/useCases/DailyLogUseCases.js';
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
  BulkGenerateLocationsUseCase,
  CreateLocationUseCase,
  DeleteLocationUseCase,
  GetLocationTreeUseCase,
  GetLocationUsageUseCase,
  ListLocationsUseCase,
  MoveLocationUseCase,
  UpdateLocationUseCase,
} from './application/useCases/LocationUseCases.js';
import {
  AddMaintenanceRecordUseCase,
  CreateMaintenancePlanUseCase,
  DeactivateMaintenancePlanUseCase,
  GetMachineMaintenanceUseCase,
  ListMachineParkUseCase,
  RecordMeterReadingUseCase,
  UpdateMachineParkDetailsUseCase,
} from './application/useCases/MachineParkUseCases.js';
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
  CreateAttachmentUseCase,
  CreateMeasurementUseCase,
  DeleteAttachmentUseCase,
  DeleteMeasurementUseCase,
  GetMeasurementSummaryUseCase,
  ListAttachmentsUseCase,
  ListMeasurementsUseCase,
  UpdateAttachmentUseCase,
  UpdateMeasurementUseCase,
} from './application/useCases/MeasurementUseCases.js';
import {
  GetContractPerformanceUseCase,
  GetProjectManhourSummariesUseCase,
  GetProjectPerformanceUseCase,
  SetUnitManhoursUseCase,
} from './application/useCases/PerformanceUseCases.js';
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
  AddQualityFileUseCase,
  AnswerRfiUseCase,
  ChangeAssignmentStatusUseCase,
  ChangeDefectStatusUseCase,
  ChangeInspectionStatusUseCase,
  ChangeRfiStatusUseCase,
  CreateAssignmentUseCase,
  CreateDefectUseCase,
  CreateInspectionTemplateUseCase,
  CreateRfiUseCase,
  DeactivateInspectionTemplateUseCase,
  DeleteQualityFileUseCase,
  GetAssignmentSummaryUseCase,
  GetDefectSummaryUseCase,
  GetDefectUseCase,
  GetInspectionUseCase,
  GetRfiSummaryUseCase,
  GetVendorScorecardUseCase,
  ListAssignmentsUseCase,
  ListDefectsUseCase,
  ListInspectionTemplatesUseCase,
  ListInspectionsUseCase,
  ListQualityFilesUseCase,
  ListRfisUseCase,
  RaiseDefectFromAnswerUseCase,
  ReplaceInspectionTemplateItemsUseCase,
  SaveInspectionAnswersUseCase,
  StartInspectionUseCase,
  UpdateAssignmentUseCase,
  UpdateDefectUseCase,
  UpdateRfiUseCase,
} from './application/useCases/QualityUseCases.js';
import {
  GetProgressCurveUseCase,
  GetProjectDashboardUseCase,
} from './application/useCases/ReportUseCases.js';
import {
  CreateActivityUseCase,
  DeactivateActivityUseCase,
  GetActivityProgressLogUseCase,
  GetProjectScheduleCurveUseCase,
  GetProjectScheduleUseCase,
  RecordActivityProgressUseCase,
  UpdateActivityUseCase,
} from './application/useCases/ScheduleUseCases.js';
import {
  AddTrackingLocationsUseCase,
  ChangeTrackingStatusUseCase,
  CreateProgressTemplateUseCase,
  CreateTrackingUseCase,
  DeactivateProgressTemplateUseCase,
  GetProgressTemplateUseCase,
  GetProjectPhysicalProgressUseCase,
  GetTrackingBoardUseCase,
  GetTrackingItemHistoryUseCase,
  ListProgressTemplatesUseCase,
  ListTrackingsUseCase,
  RemoveTrackingLocationUseCase,
  SaveTemplateBodyUseCase,
  SetTrackingItemStateUseCase,
  SyncTrackingWithTemplateUseCase,
  UpdateProgressTemplateUseCase,
  UpdateTrackingUseCase,
} from './application/useCases/TrackingUseCases.js';
import { PgApprovalRepository } from './infrastructure/persistence/PgApprovalRepository.js';
import { PgBoqRepository } from './infrastructure/persistence/PgBoqRepository.js';
import { PgCommitmentRepository } from './infrastructure/persistence/PgCommitmentRepository.js';
import { PgContractRepository } from './infrastructure/persistence/PgContractRepository.js';
import { PgDailyLogRepository } from './infrastructure/persistence/PgDailyLogRepository.js';
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
import { PgLocationRepository } from './infrastructure/persistence/PgLocationRepository.js';
import { PgMachineParkRepository } from './infrastructure/persistence/PgMachineParkRepository.js';
import {
  PgMaterialRepository,
  PgMaterialRequestRepository,
  PgStockRepository,
  PgWarehouseRepository,
} from './infrastructure/persistence/PgMaterialRepositories.js';
import {
  PgAttachmentRepository,
  PgMeasurementBookRepository,
} from './infrastructure/persistence/PgMeasurementRepositories.js';
import { PgPerformanceRepository } from './infrastructure/persistence/PgPerformanceRepository.js';
import { PgPozCatalogRepository } from './infrastructure/persistence/PgPozCatalogRepository.js';
import { PgProgressPaymentRepository } from './infrastructure/persistence/PgProgressPaymentRepository.js';
import { PgProjectRepository } from './infrastructure/persistence/PgProjectRepository.js';
import {
  PgAssignmentRepository,
  PgDefectRepository,
  PgInspectionRepository,
  PgQualityFileRepository,
  PgRfiRepository,
} from './infrastructure/persistence/PgQualityRepositories.js';
import { PgScheduleRepository } from './infrastructure/persistence/PgScheduleRepository.js';
import {
  PgProgressTemplateRepository,
  PgTrackingRepository,
} from './infrastructure/persistence/PgTrackingRepositories.js';
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
  const measurements = new PgMeasurementBookRepository(pool);
  const attachments = new PgAttachmentRepository(pool);
  const locations = new PgLocationRepository(pool);
  const progressTemplates = new PgProgressTemplateRepository(pool);
  const trackings = new PgTrackingRepository(pool);
  const dailyLogs = new PgDailyLogRepository(pool);
  const performance = new PgPerformanceRepository(pool);
  const approvals = new PgApprovalRepository(pool);
  const defects = new PgDefectRepository(pool);
  const inspections = new PgInspectionRepository(pool);
  const rfis = new PgRfiRepository(pool);
  const assignments = new PgAssignmentRepository(pool);
  const qualityFiles = new PgQualityFileRepository(pool);
  const commitments = new PgCommitmentRepository(pool);
  const schedule = new PgScheduleRepository(pool);
  const machinePark = new PgMachineParkRepository(pool);

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
    createMeasurement: new CreateMeasurementUseCase(measurements, contracts, boq),
    listMeasurements: new ListMeasurementsUseCase(measurements),
    updateMeasurement: new UpdateMeasurementUseCase(measurements),
    deleteMeasurement: new DeleteMeasurementUseCase(measurements),
    getMeasurementSummary: new GetMeasurementSummaryUseCase(measurements, contracts),
    createAttachment: new CreateAttachmentUseCase(attachments, measurements),
    listAttachments: new ListAttachmentsUseCase(attachments),
    updateAttachment: new UpdateAttachmentUseCase(attachments, measurements),
    deleteAttachment: new DeleteAttachmentUseCase(attachments, measurements),

    // FAZ 1 — Mekân kırılımı (Proje > Blok > Kat > Bağımsız Bölüm)
    createLocation: new CreateLocationUseCase(locations, projects),
    updateLocation: new UpdateLocationUseCase(locations, clock),
    moveLocation: new MoveLocationUseCase(locations),
    listLocations: new ListLocationsUseCase(locations),
    getLocationTree: new GetLocationTreeUseCase(locations),
    getLocationUsage: new GetLocationUsageUseCase(locations),
    deleteLocation: new DeleteLocationUseCase(locations, clock),
    bulkGenerateLocations: new BulkGenerateLocationsUseCase(locations, projects),

    // FAZ 2 — Fiziksel ilerleme takibi (Güncel Durum)
    createProgressTemplate: new CreateProgressTemplateUseCase(progressTemplates),
    updateProgressTemplate: new UpdateProgressTemplateUseCase(progressTemplates, clock),
    saveTemplateBody: new SaveTemplateBodyUseCase(progressTemplates),
    listProgressTemplates: new ListProgressTemplatesUseCase(progressTemplates),
    getProgressTemplate: new GetProgressTemplateUseCase(progressTemplates),
    deactivateProgressTemplate: new DeactivateProgressTemplateUseCase(progressTemplates, clock),
    createTracking: new CreateTrackingUseCase(trackings, progressTemplates, projects, locations),
    updateTracking: new UpdateTrackingUseCase(trackings, clock),
    changeTrackingStatus: new ChangeTrackingStatusUseCase(trackings, clock),
    listTrackings: new ListTrackingsUseCase(trackings, clock),
    getTrackingBoard: new GetTrackingBoardUseCase(trackings, progressTemplates, clock),
    setTrackingItemState: new SetTrackingItemStateUseCase(trackings),
    getTrackingItemHistory: new GetTrackingItemHistoryUseCase(trackings),
    addTrackingLocations: new AddTrackingLocationsUseCase(trackings, progressTemplates, locations),
    removeTrackingLocation: new RemoveTrackingLocationUseCase(trackings),
    syncTrackingWithTemplate: new SyncTrackingWithTemplateUseCase(trackings),
    getProjectPhysicalProgress: new GetProjectPhysicalProgressUseCase(trackings, projects, clock),

    // FAZ 3 — Şantiye günlüğü. saveDailyLogEntry puantaj/makine köprülerini
    // kurduğu için timesheets ve machineLogs repo'larını da alır.
    getDailyLogMonth: new GetDailyLogMonthUseCase(dailyLogs),
    getDailyLogDay: new GetDailyLogDayUseCase(dailyLogs, projects),
    updateDailyLog: new UpdateDailyLogUseCase(dailyLogs, clock),
    changeDailyLogStatus: new ChangeDailyLogStatusUseCase(dailyLogs, clock),
    saveDailyLogEntry: new SaveDailyLogEntryUseCase(dailyLogs, timesheets, machineLogs),
    deleteDailyLogEntry: new DeleteDailyLogEntryUseCase(dailyLogs),
    addDailyLogFile: new AddDailyLogFileUseCase(dailyLogs),
    deleteDailyLogFile: new DeleteDailyLogFileUseCase(dailyLogs),
    addDailyLogComment: new AddDailyLogCommentUseCase(dailyLogs),
    getManpowerReport: new GetManpowerReportUseCase(dailyLogs),
    getSafetySummary: new GetSafetySummaryUseCase(dailyLogs),
    getProductionActuals: new GetProductionActualsUseCase(dailyLogs),
    getMaterialConsumption: new GetMaterialConsumptionUseCase(dailyLogs),

    // FAZ 4 — Adam×saat & verimlilik (poz bazlı işçilik performansı)
    getContractPerformance: new GetContractPerformanceUseCase(performance, contracts),
    getProjectPerformance: new GetProjectPerformanceUseCase(performance, projects),
    getProjectManhourSummaries: new GetProjectManhourSummariesUseCase(performance, projects),
    setUnitManhours: new SetUnitManhoursUseCase(performance, contracts),

    // FAZ 5 — Jenerik onay akışı. Akış kapandığında belgeyi ilerletme
    // sorumluluğu bu modülde DEĞİL: 'approval' konusuna olay yayınlanır,
    // belgenin kendi durum makinesi dinler (hakediş→muhasebe ile aynı seam).
    startApprovalFlow: new StartApprovalFlowUseCase(approvals),
    decideApprovalStep: new DecideApprovalStepUseCase(approvals, clock, events),
    cancelApprovalFlow: new CancelApprovalFlowUseCase(approvals, clock, events),
    getApprovalFlow: new GetApprovalFlowUseCase(approvals),
    getDocApproval: new GetDocApprovalUseCase(approvals),
    listApprovalFlows: new ListApprovalFlowsUseCase(approvals),
    getApprovalSummariesForDocs: new GetApprovalSummariesForDocsUseCase(approvals),
    getMyApprovals: new GetMyApprovalsUseCase(approvals, clock),
    getApprovalHistory: new GetApprovalHistoryUseCase(approvals),
    // FAZ 6 — Kalite & Güvenlik
    createDefect: new CreateDefectUseCase(defects, projects, clock),
    updateDefect: new UpdateDefectUseCase(defects, clock),
    changeDefectStatus: new ChangeDefectStatusUseCase(defects, clock),
    listDefects: new ListDefectsUseCase(defects),
    getDefect: new GetDefectUseCase(defects),
    getDefectSummary: new GetDefectSummaryUseCase(defects),
    createInspectionTemplate: new CreateInspectionTemplateUseCase(inspections),
    listInspectionTemplates: new ListInspectionTemplatesUseCase(inspections),
    replaceInspectionTemplateItems: new ReplaceInspectionTemplateItemsUseCase(inspections),
    deactivateInspectionTemplate: new DeactivateInspectionTemplateUseCase(inspections),
    startInspection: new StartInspectionUseCase(inspections, projects),
    saveInspectionAnswers: new SaveInspectionAnswersUseCase(inspections, clock),
    changeInspectionStatus: new ChangeInspectionStatusUseCase(inspections, clock),
    listInspections: new ListInspectionsUseCase(inspections),
    getInspection: new GetInspectionUseCase(inspections),
    // Denetim maddesinden hasar-eksiklik: kusur karnedeki taşerona yazılır
    raiseDefectFromAnswer: new RaiseDefectFromAnswerUseCase(
      inspections,
      new CreateDefectUseCase(defects, projects, clock),
    ),
    getVendorScorecard: new GetVendorScorecardUseCase(inspections),
    createRfi: new CreateRfiUseCase(rfis, projects),
    updateRfi: new UpdateRfiUseCase(rfis, clock),
    answerRfi: new AnswerRfiUseCase(rfis, clock),
    changeRfiStatus: new ChangeRfiStatusUseCase(rfis, clock),
    listRfis: new ListRfisUseCase(rfis),
    getRfiSummary: new GetRfiSummaryUseCase(rfis),
    createAssignment: new CreateAssignmentUseCase(assignments, projects),
    updateAssignment: new UpdateAssignmentUseCase(assignments, clock),
    changeAssignmentStatus: new ChangeAssignmentStatusUseCase(assignments, clock),
    listAssignments: new ListAssignmentsUseCase(assignments),
    getAssignmentSummary: new GetAssignmentSummaryUseCase(assignments),
    addQualityFile: new AddQualityFileUseCase(qualityFiles),
    listQualityFiles: new ListQualityFilesUseCase(qualityFiles),
    deleteQualityFile: new DeleteQualityFileUseCase(qualityFiles),
    // FAZ 7 — Taahhüt & EVM
    createCommitment: new CreateCommitmentUseCase(commitments, projects, clock),
    updateCommitment: new UpdateCommitmentUseCase(commitments, clock),
    recordCommitmentDelivery: new RecordCommitmentDeliveryUseCase(commitments, clock),
    closeCommitment: new CloseCommitmentUseCase(commitments, clock),
    cancelCommitment: new CancelCommitmentUseCase(commitments, clock),
    listCommitments: new ListCommitmentsUseCase(commitments),
    syncCommitments: new SyncCommitmentsUseCase(commitments, projects, clock),
    getContractEvm: new GetContractEvmUseCase(commitments),
    getProjectEvm: new GetProjectEvmUseCase(commitments),
    // FAZ 8 — İş programı
    createActivity: new CreateActivityUseCase(schedule, projects, clock),
    updateActivity: new UpdateActivityUseCase(schedule, clock),
    deactivateActivity: new DeactivateActivityUseCase(schedule),
    recordActivityProgress: new RecordActivityProgressUseCase(schedule, clock),
    getProjectSchedule: new GetProjectScheduleUseCase(schedule, projects, clock),
    getActivityProgressLog: new GetActivityProgressLogUseCase(schedule),
    getProjectScheduleCurve: new GetProjectScheduleCurveUseCase(schedule, projects, clock),
    // FAZ 9 — Makine parkı. Bakım kaydı sayaç kurallarını yeniden yazmasın
    // diye RecordMeterReadingUseCase'i kompoze eder.
    listMachinePark: new ListMachineParkUseCase(machinePark, clock),
    updateMachineParkDetails: new UpdateMachineParkDetailsUseCase(machinePark, clock),
    recordMeterReading: new RecordMeterReadingUseCase(machinePark, clock),
    createMaintenancePlan: new CreateMaintenancePlanUseCase(machinePark, clock),
    deactivateMaintenancePlan: new DeactivateMaintenancePlanUseCase(machinePark),
    addMaintenanceRecord: new AddMaintenanceRecordUseCase(
      machinePark,
      new RecordMeterReadingUseCase(machinePark, clock),
      clock,
    ),
    getMachineMaintenance: new GetMachineMaintenanceUseCase(machinePark, clock),
  };

  return createConstructionRouter(deps);
}
