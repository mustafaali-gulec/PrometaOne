/**
 * Construction (Şantiye) HTTP route'ları — Faz SF-1: Projeler & Sözleşmeler.
 *
 * Tüm endpoint'ler authMiddleware ile korunur; yazma işlemleri en az 'editor'
 * rolü ister. companyId body/query'den alınır; multi-tenant izolasyon repo'larda.
 * İş kuralı yazmaz; use-case'leri çağırır, hata mapping errorMapping.ts'de.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard, requireRole } from '../../../middleware/auth.js';
import { kindSpecDto } from '../application/dto/DailyLogDtos.js';
import type {
  CancelApprovalFlowUseCase,
  DecideApprovalStepUseCase,
  GetApprovalFlowUseCase,
  GetApprovalHistoryUseCase,
  GetApprovalSummariesForDocsUseCase,
  GetDocApprovalUseCase,
  GetMyApprovalsUseCase,
  ListApprovalFlowsUseCase,
  StartApprovalFlowUseCase,
} from '../application/useCases/ApprovalUseCases.js';
import type { GetBoqUseCase, SaveBoqLinesUseCase } from '../application/useCases/BoqUseCases.js';
import type {
  CreateContractUseCase,
  ListContractsUseCase,
  UpdateContractUseCase,
} from '../application/useCases/ContractUseCases.js';
import type {
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
} from '../application/useCases/DailyLogUseCases.js';
import type {
  CreateAdvanceUseCase,
  CreateCashMovementUseCase,
  CreateExpenseUseCase,
  DeleteAdvanceUseCase,
  DeleteCashMovementUseCase,
  CreateManualPaymentUseCase,
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
} from '../application/useCases/FinanceUseCases.js';
import type {
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
} from '../application/useCases/LaborUseCases.js';
import type {
  BulkGenerateLocationsUseCase,
  CreateLocationUseCase,
  DeleteLocationUseCase,
  GetLocationTreeUseCase,
  GetLocationUsageUseCase,
  ListLocationsUseCase,
  MoveLocationUseCase,
  UpdateLocationUseCase,
} from '../application/useCases/LocationUseCases.js';
import type {
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
} from '../application/useCases/MaterialUseCases.js';
import type {
  CreateAttachmentUseCase,
  CreateMeasurementUseCase,
  DeleteAttachmentUseCase,
  DeleteMeasurementUseCase,
  GetMeasurementSummaryUseCase,
  ListAttachmentsUseCase,
  ListMeasurementsUseCase,
  UpdateAttachmentUseCase,
  UpdateMeasurementUseCase,
} from '../application/useCases/MeasurementUseCases.js';
import type {
  GetContractPerformanceUseCase,
  GetProjectManhourSummariesUseCase,
  GetProjectPerformanceUseCase,
  SetUnitManhoursUseCase,
} from '../application/useCases/PerformanceUseCases.js';
import type {
  CreatePozUseCase,
  DeactivatePozUseCase,
  ListPozUseCase,
  UpdatePozUseCase,
} from '../application/useCases/PozUseCases.js';
import type {
  ChangeProgressStatusUseCase,
  CreateProgressPaymentUseCase,
  GetProgressPaymentUseCase,
  ListProgressPaymentsUseCase,
  SaveDeductionsUseCase,
  SaveProgressLinesUseCase,
} from '../application/useCases/ProgressUseCases.js';
import type {
  ChangeProjectStatusUseCase,
  CreateProjectUseCase,
  DeactivateProjectUseCase,
  ListProjectsUseCase,
  UpdateProjectUseCase,
} from '../application/useCases/ProjectUseCases.js';
import type {
  GetProgressCurveUseCase,
  GetProjectDashboardUseCase,
} from '../application/useCases/ReportUseCases.js';
import type {
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
} from '../application/useCases/TrackingUseCases.js';
import { LOG_ENTRY_KINDS } from '../domain/valueObjects/DailyLogKind.js';

import { mapConstructionError } from './errorMapping.js';

export interface ConstructionRouterDeps {
  createProject: CreateProjectUseCase;
  listProjects: ListProjectsUseCase;
  updateProject: UpdateProjectUseCase;
  changeProjectStatus: ChangeProjectStatusUseCase;
  deactivateProject: DeactivateProjectUseCase;
  createContract: CreateContractUseCase;
  listContracts: ListContractsUseCase;
  updateContract: UpdateContractUseCase;
  createPoz: CreatePozUseCase;
  listPoz: ListPozUseCase;
  updatePoz: UpdatePozUseCase;
  deactivatePoz: DeactivatePozUseCase;
  getBoq: GetBoqUseCase;
  saveBoqLines: SaveBoqLinesUseCase;
  createProgress: CreateProgressPaymentUseCase;
  getProgress: GetProgressPaymentUseCase;
  listProgress: ListProgressPaymentsUseCase;
  saveProgressLines: SaveProgressLinesUseCase;
  saveDeductions: SaveDeductionsUseCase;
  changeProgressStatus: ChangeProgressStatusUseCase;
  createExpense: CreateExpenseUseCase;
  listExpenses: ListExpensesUseCase;
  updateExpense: UpdateExpenseUseCase;
  deleteExpense: DeleteExpenseUseCase;
  getCostSummary: GetProjectCostSummaryUseCase;
  createAdvance: CreateAdvanceUseCase;
  listAdvances: ListAdvancesUseCase;
  updateAdvance: UpdateAdvanceUseCase;
  deleteAdvance: DeleteAdvanceUseCase;
  createCashMovement: CreateCashMovementUseCase;
  listCashMovements: ListCashMovementsUseCase;
  deleteCashMovement: DeleteCashMovementUseCase;
  listPayments: ListPaymentListUseCase;
  createPayment: CreateManualPaymentUseCase;
  updatePayment: UpdateManualPaymentUseCase;
  deletePayment: DeleteManualPaymentUseCase;
  createMaterial: CreateMaterialUseCase;
  listMaterials: ListMaterialsUseCase;
  updateMaterial: UpdateMaterialUseCase;
  deactivateMaterial: DeactivateMaterialUseCase;
  createWarehouse: CreateWarehouseUseCase;
  listWarehouses: ListWarehousesUseCase;
  recordStockMovement: RecordStockMovementUseCase;
  listStock: ListStockUseCase;
  listMovements: ListMovementsUseCase;
  createMaterialRequest: CreateMaterialRequestUseCase;
  getMaterialRequest: GetMaterialRequestUseCase;
  listMaterialRequests: ListMaterialRequestsUseCase;
  saveMaterialRequestLines: SaveMaterialRequestLinesUseCase;
  changeMaterialRequestStatus: ChangeMaterialRequestStatusUseCase;
  createPersonnel: CreatePersonnelUseCase;
  listPersonnel: ListPersonnelUseCase;
  updatePersonnel: UpdatePersonnelUseCase;
  deactivatePersonnel: DeactivatePersonnelUseCase;
  saveTimesheet: SaveTimesheetUseCase;
  listTimesheets: ListTimesheetsUseCase;
  deleteTimesheet: DeleteTimesheetUseCase;
  createMachine: CreateMachineUseCase;
  listMachines: ListMachinesUseCase;
  updateMachine: UpdateMachineUseCase;
  createMachineLog: CreateMachineLogUseCase;
  listMachineLogs: ListMachineLogsUseCase;
  deleteMachineLog: DeleteMachineLogUseCase;
  getLaborCostSummary: GetLaborCostSummaryUseCase;
  getProjectDashboard: GetProjectDashboardUseCase;
  getProgressCurve: GetProgressCurveUseCase;
  // Yeşil Defter (metraj) + Ataşman — SF-8
  createMeasurement: CreateMeasurementUseCase;
  listMeasurements: ListMeasurementsUseCase;
  updateMeasurement: UpdateMeasurementUseCase;
  deleteMeasurement: DeleteMeasurementUseCase;
  getMeasurementSummary: GetMeasurementSummaryUseCase;
  createAttachment: CreateAttachmentUseCase;
  listAttachments: ListAttachmentsUseCase;
  updateAttachment: UpdateAttachmentUseCase;
  deleteAttachment: DeleteAttachmentUseCase;
  // FAZ 1 — Mekân kırılımı
  createLocation: CreateLocationUseCase;
  updateLocation: UpdateLocationUseCase;
  moveLocation: MoveLocationUseCase;
  listLocations: ListLocationsUseCase;
  getLocationTree: GetLocationTreeUseCase;
  getLocationUsage: GetLocationUsageUseCase;
  deleteLocation: DeleteLocationUseCase;
  bulkGenerateLocations: BulkGenerateLocationsUseCase;
  // FAZ 2 — Fiziksel ilerleme takibi
  createProgressTemplate: CreateProgressTemplateUseCase;
  updateProgressTemplate: UpdateProgressTemplateUseCase;
  saveTemplateBody: SaveTemplateBodyUseCase;
  listProgressTemplates: ListProgressTemplatesUseCase;
  getProgressTemplate: GetProgressTemplateUseCase;
  deactivateProgressTemplate: DeactivateProgressTemplateUseCase;
  createTracking: CreateTrackingUseCase;
  updateTracking: UpdateTrackingUseCase;
  changeTrackingStatus: ChangeTrackingStatusUseCase;
  listTrackings: ListTrackingsUseCase;
  getTrackingBoard: GetTrackingBoardUseCase;
  setTrackingItemState: SetTrackingItemStateUseCase;
  getTrackingItemHistory: GetTrackingItemHistoryUseCase;
  addTrackingLocations: AddTrackingLocationsUseCase;
  removeTrackingLocation: RemoveTrackingLocationUseCase;
  syncTrackingWithTemplate: SyncTrackingWithTemplateUseCase;
  getProjectPhysicalProgress: GetProjectPhysicalProgressUseCase;
  // FAZ 3 — Şantiye günlüğü
  getDailyLogMonth: GetDailyLogMonthUseCase;
  getDailyLogDay: GetDailyLogDayUseCase;
  updateDailyLog: UpdateDailyLogUseCase;
  changeDailyLogStatus: ChangeDailyLogStatusUseCase;
  saveDailyLogEntry: SaveDailyLogEntryUseCase;
  deleteDailyLogEntry: DeleteDailyLogEntryUseCase;
  addDailyLogFile: AddDailyLogFileUseCase;
  deleteDailyLogFile: DeleteDailyLogFileUseCase;
  addDailyLogComment: AddDailyLogCommentUseCase;
  getManpowerReport: GetManpowerReportUseCase;
  getSafetySummary: GetSafetySummaryUseCase;
  getProductionActuals: GetProductionActualsUseCase;
  getMaterialConsumption: GetMaterialConsumptionUseCase;
  // FAZ 4 — Adam×saat & verimlilik
  getContractPerformance: GetContractPerformanceUseCase;
  getProjectPerformance: GetProjectPerformanceUseCase;
  getProjectManhourSummaries: GetProjectManhourSummariesUseCase;
  setUnitManhours: SetUnitManhoursUseCase;
  // FAZ 5 — Jenerik onay akışı
  startApprovalFlow: StartApprovalFlowUseCase;
  decideApprovalStep: DecideApprovalStepUseCase;
  cancelApprovalFlow: CancelApprovalFlowUseCase;
  getApprovalFlow: GetApprovalFlowUseCase;
  getDocApproval: GetDocApprovalUseCase;
  listApprovalFlows: ListApprovalFlowsUseCase;
  getApprovalSummariesForDocs: GetApprovalSummariesForDocsUseCase;
  getMyApprovals: GetMyApprovalsUseCase;
  getApprovalHistory: GetApprovalHistoryUseCase;
}

// --- Schema fragmanları ---------------------------------------------------
const currency = z.enum(['TRY', 'USD', 'EUR']);
const projectType = z.enum(['private', 'public_tender']);
const projectStatus = z.enum(['planning', 'active', 'suspended', 'completed', 'closed']);
const contractParty = z.enum(['employer', 'subcontractor']);
const progressKind = z.enum(['employer', 'subcontractor']);
const progressType = z.enum(['interim', 'final']);
const progressStatus = z.enum(['draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled']);
const deductionKind = z.enum([
  'retention',
  'advance_offset',
  'sgk',
  'income_tax',
  'stoppage',
  'penalty',
  'price_diff',
  'other',
]);
const stockMoveKind = z.enum(['in', 'out', 'transfer', 'adjust', 'waste']);
const machineKind = z.enum(['owned', 'rented', 'subcontractor']);
const mreqStatus = z.enum(['draft', 'submitted', 'approved', 'rejected', 'fulfilled', 'cancelled']);
const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// FAZ 1/2 fragmanları
const locationKind = z.enum(['site', 'block', 'floor', 'unit', 'zone']);
const trackScope = z.enum(['general', 'block', 'floor', 'unit']);
const trackingStatus = z.enum(['draft', 'active', 'completed', 'cancelled']);
const itemState = z.enum(['not_started', 'in_progress', 'has_defects', 'completed']);
// FAZ 3 fragmanları
const workState = z.enum(['working', 'not_working', 'partial']);
const logEntryKind = z.enum([
  'subcontractor',
  'personnel',
  'equipment',
  'note',
  'delivery',
  'accident',
  'material_used',
  'production',
  'fuel',
  'maintenance',
  'visitor',
]);
const accidentSeverity = z.enum(['near_miss', 'first_aid', 'medical', 'lost_time', 'fatal']);
// FAZ 5 fragmanları
const approvalDocKind = z.enum([
  'contract',
  'progress',
  'material_request',
  'expense',
  'advance',
  'daily_log',
  'tracking',
  'boq',
  'measurement',
  'payment',
]);
const approvalStatus = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
const pct = z.number().min(0).max(100);
const templateBodySchema = z.object({
  groups: z.array(
    z.object({
      code: z.string().min(1).max(40),
      name: z.string().min(1).max(300),
      weightPct: z.number().nonnegative(),
      sortOrder: z.number().int().nonnegative().optional(),
      items: z.array(
        z.object({
          code: z.string().min(1).max(40),
          name: z.string().min(1).max(300),
          weightPct: z.number().nonnegative(),
          sortOrder: z.number().int().nonnegative().optional(),
          pozId: z.number().int().positive().nullable().optional(),
        }),
      ),
    }),
  ),
});

/** Şablon gövdesindeki isteğe bağlı sortOrder'ları dizi sırasına göre doldurur. */
function normalizeTemplateBody(body: z.infer<typeof templateBodySchema>): {
  groups: ReadonlyArray<{
    code: string;
    name: string;
    weightPct: number;
    sortOrder: number;
    items: ReadonlyArray<{
      code: string;
      name: string;
      weightPct: number;
      sortOrder: number;
      pozId: number | null;
    }>;
  }>;
} {
  return {
    groups: body.groups.map((g, gi) => ({
      code: g.code,
      name: g.name,
      weightPct: g.weightPct,
      sortOrder: g.sortOrder ?? gi,
      items: g.items.map((i, ii) => ({
        code: i.code,
        name: i.name,
        weightPct: i.weightPct,
        sortOrder: i.sortOrder ?? ii,
        pozId: i.pozId ?? null,
      })),
    })),
  };
}

const tenderSchema = z
  .object({
    ikn: z.string().max(40).nullable().optional(),
    procedure: z.string().max(60).nullable().optional(),
    approxCost: z.number().nonnegative().nullable().optional(),
    tenderDate: dateStr.nullable().optional(),
    workIncreasePct: z.number().nonnegative().optional(),
    perfBondPct: z.number().nonnegative().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .nullable();

export function createConstructionRouter(deps: ConstructionRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  // Çapraz-tenant koruması: companyId, kullanıcının erişebileceği şirketlerle
  // sınırlanır (access-token `companies` claim'i; admin sınırsız).
  app.use('*', companyScopeGuard);
  const requireWrite = requireRole('editor');

  const actorId = (c: { get: (k: string) => unknown }): number | null => {
    const auth = c.get('auth') as { userId?: number } | undefined;
    return auth?.userId ?? null;
  };
  const actorRole = (c: { get: (k: string) => unknown }): string => {
    const auth = c.get('auth') as { role?: string } | undefined;
    return auth?.role ?? 'viewer';
  };
  // Onay/ödeme görev ayrılığı: hakedişi onaylamak/ödemek yönetici (cfo) ya da
  // admin gerektirir (construction.progress.approve). Diğer geçişler editor.
  const canApprove = (role: string): boolean => role === 'cfo' || role === 'admin';

  // ===== PROJECTS (Projeler) ==============================================
  app.get(
    '/projects',
    zValidator(
      'query',
      companyIdQ.extend({
        includeInactive: z.coerce.boolean().optional(),
        status: projectStatus.optional(),
        projectType: projectType.optional(),
        search: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listProjects.execute({
          companyId: q.companyId,
          ...(q.includeInactive !== undefined ? { includeInactive: q.includeInactive } : {}),
          ...(q.status !== undefined ? { status: q.status } : {}),
          ...(q.projectType !== undefined ? { projectType: q.projectType } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
        });
        return c.json({ projects: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/projects',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300),
        code: z.string().max(40).optional(),
        projectType: projectType.optional(),
        orgUnitId: z.number().int().positive().nullable().optional(),
        managerUserId: z.number().int().positive().nullable().optional(),
        location: z.string().max(500).nullable().optional(),
        startDate: dateStr.nullable().optional(),
        plannedEnd: dateStr.nullable().optional(),
        budgetAmount: z.number().nonnegative().optional(),
        currency: currency.optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createProject.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/projects/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300).optional(),
        projectType: projectType.optional(),
        orgUnitId: z.number().int().positive().nullable().optional(),
        managerUserId: z.number().int().positive().nullable().optional(),
        location: z.string().max(500).nullable().optional(),
        startDate: dateStr.nullable().optional(),
        plannedEnd: dateStr.nullable().optional(),
        budgetAmount: z.number().nonnegative().optional(),
        currency: currency.optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateProject.execute({ projectId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/projects/:id/status',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: z.number().int().positive(), status: projectStatus })),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.changeProjectStatus.execute({
          projectId: id,
          companyId: b.companyId,
          status: b.status,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/projects/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.deactivateProject.execute({ projectId: id, companyId: q.companyId });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== CONTRACTS (Sözleşmeler + İhale) ==================================
  app.get(
    '/contracts',
    zValidator(
      'query',
      companyIdQ.extend({
        projectId: z.coerce.number().int().positive().optional(),
        partyKind: contractParty.optional(),
        search: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listContracts.execute({
          companyId: q.companyId,
          ...(q.projectId !== undefined ? { projectId: q.projectId } : {}),
          ...(q.partyKind !== undefined ? { partyKind: q.partyKind } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
        });
        return c.json({ contracts: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/contracts',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        partyKind: contractParty,
        vendorId: z.number().int().positive().nullable().optional(),
        contractNo: z.string().max(60).optional(),
        title: z.string().min(1).max(300),
        amount: z.number().nonnegative().optional(),
        currency: currency.optional(),
        signDate: dateStr.nullable().optional(),
        startDate: dateStr.nullable().optional(),
        endDate: dateStr.nullable().optional(),
        retentionPct: z.number().nonnegative().optional(),
        advancePct: z.number().nonnegative().optional(),
        priceDiffOn: z.boolean().optional(),
        tender: tenderSchema.optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createContract.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/contracts/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        title: z.string().min(1).max(300).optional(),
        vendorId: z.number().int().positive().nullable().optional(),
        amount: z.number().nonnegative().optional(),
        currency: currency.optional(),
        signDate: dateStr.nullable().optional(),
        startDate: dateStr.nullable().optional(),
        endDate: dateStr.nullable().optional(),
        retentionPct: z.number().nonnegative().optional(),
        advancePct: z.number().nonnegative().optional(),
        priceDiffOn: z.boolean().optional(),
        tender: tenderSchema.optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateContract.execute({ contractId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== POZ CATALOG (Birim fiyat / poz katalog) ==========================
  app.get(
    '/poz',
    zValidator(
      'query',
      companyIdQ.extend({
        includeInactive: z.coerce.boolean().optional(),
        search: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listPoz.execute({
          companyId: q.companyId,
          ...(q.includeInactive !== undefined ? { includeInactive: q.includeInactive } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
        });
        return c.json({ poz: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/poz',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        pozNo: z.string().min(1).max(40),
        name: z.string().min(1).max(500),
        unit: z.string().min(1).max(20),
        unitPrice: z.number().nonnegative().optional(),
        source: z.string().max(40).nullable().optional(),
        year: z.number().int().nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createPoz.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/poz/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(500).optional(),
        unit: z.string().min(1).max(20).optional(),
        unitPrice: z.number().nonnegative().optional(),
        source: z.string().max(40).nullable().optional(),
        year: z.number().int().nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updatePoz.execute({ pozId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/poz/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.deactivatePoz.execute({ pozId: id, companyId: q.companyId });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== KEŞİF (BoQ) — sözleşme bazında satırlar + pursantaj ==============
  app.get(
    '/contracts/:id/boq',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.getBoq.execute({ contractId: id, companyId: q.companyId });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.put(
    '/contracts/:id/boq',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        lines: z.array(
          z.object({
            groupId: z.number().int().positive().nullable().optional(),
            pozId: z.number().int().positive().nullable().optional(),
            pozNo: z.string().max(40).nullable().optional(),
            description: z.string().min(1).max(500),
            unit: z.string().max(20).optional(),
            quantity: z.number().nonnegative().optional(),
            unitPrice: z.number().nonnegative().optional(),
          }),
        ),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.saveBoqLines.execute({
          contractId: id,
          companyId: b.companyId,
          lines: b.lines,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== HAKEDİŞ (Progress payments) ======================================
  app.get(
    '/progress',
    zValidator(
      'query',
      companyIdQ.extend({
        contractId: z.coerce.number().int().positive(),
        kind: progressKind.optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listProgress.execute({
          companyId: q.companyId,
          contractId: q.contractId,
          ...(q.kind !== undefined ? { kind: q.kind } : {}),
        });
        return c.json({ progress: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.get(
    '/progress/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.getProgress.execute({ progressId: id, companyId: q.companyId });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/progress',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        contractId: z.number().int().positive(),
        kind: progressKind,
        ptype: progressType.optional(),
        periodStart: dateStr.nullable().optional(),
        periodEnd: dateStr.nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createProgress.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.put(
    '/progress/:id/lines',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        quantities: z.array(
          z.object({
            boqLineId: z.number().int().positive(),
            thisQty: z.number().nonnegative(),
          }),
        ),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.saveProgressLines.execute({
          progressId: id,
          companyId: b.companyId,
          quantities: b.quantities,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.put(
    '/progress/:id/deductions',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        priceDiff: z.number().optional(),
        deductions: z.array(
          z.object({
            kind: deductionKind,
            label: z.string().max(200).nullable().optional(),
            ratePct: z.number().nullable().optional(),
            amount: z.number().nonnegative(),
            sign: z.number().int().optional(),
          }),
        ),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.saveDeductions.execute({
          progressId: id,
          companyId: b.companyId,
          ...(b.priceDiff !== undefined ? { priceDiff: b.priceDiff } : {}),
          deductions: b.deductions,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/progress/:id/status',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        status: progressStatus,
        note: z.string().max(2000).nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      // Görev ayrılığı: onay/ödeme yönetici yetkisi ister.
      if ((b.status === 'approved' || b.status === 'paid') && !canApprove(actorRole(c))) {
        return c.json({ message: 'Hakediş onayı/ödemesi için yönetici yetkisi gerekir' }, 403);
      }
      try {
        const dto = await deps.changeProgressStatus.execute({
          progressId: id,
          companyId: b.companyId,
          status: b.status,
          ...(b.note !== undefined ? { note: b.note } : {}),
          actorUserId: actorId(c),
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== HARCAMA (Expenses) ===============================================
  const projectQ = companyIdQ.extend({ projectId: z.coerce.number().int().positive() });

  app.get('/expenses', zValidator('query', projectQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listExpenses.execute({
        companyId: q.companyId,
        projectId: q.projectId,
      });
      return c.json({ expenses: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.post(
    '/expenses',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        boqLineId: z.number().int().positive().nullable().optional(),
        vendorId: z.number().int().positive().nullable().optional(),
        invoiceId: z.number().int().positive().nullable().optional(),
        category: z.string().max(40).optional(),
        description: z.string().max(500).nullable().optional(),
        amount: z.number().nonnegative(),
        currency: currency.optional(),
        spentAt: dateStr,
        // DÖVİZ (004): dövizli gider — kullanılan kur kayda dondurulur.
        fxRate: z.number().positive().nullable().optional(),
        fxRateSource: z.enum(['manual', 'tcmb']).nullable().optional(),
        fxRateDate: dateStr.nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createExpense.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/expenses/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        boqLineId: z.number().int().positive().nullable().optional(),
        vendorId: z.number().int().positive().nullable().optional(),
        invoiceId: z.number().int().positive().nullable().optional(),
        category: z.string().max(40).optional(),
        description: z.string().max(500).nullable().optional(),
        amount: z.number().nonnegative().optional(),
        currency: currency.optional(),
        spentAt: dateStr.optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateExpense.execute({ expenseId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/expenses/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deleteExpense.execute({ expenseId: id, companyId: q.companyId });
        return c.body(null, 204);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.get(
    '/projects/:id/cost-summary',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.getCostSummary.execute({ projectId: id, companyId: q.companyId });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== YEŞİL DEFTER (Metraj) + ATAŞMAN — SF-8 ===========================
  const contractQ = companyIdQ.extend({ contractId: z.coerce.number().int().positive() });
  const measurementQ = companyIdQ.extend({ measurementId: z.coerce.number().int().positive() });
  const dim = z.number().nonnegative().nullable().optional();

  app.get('/measurements', zValidator('query', contractQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listMeasurements.execute({
        companyId: q.companyId,
        contractId: q.contractId,
      });
      return c.json({ measurements: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.get(
    '/contracts/:id/measurement-summary',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const lines = await deps.getMeasurementSummary.execute({
          companyId: q.companyId,
          contractId: id,
        });
        return c.json({ lines });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/measurements',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        contractId: z.number().int().positive(),
        boqLineId: z.number().int().positive(),
        progressId: z.number().int().positive().nullable().optional(),
        measuredQty: z.number().nonnegative().optional(),
        measuredAt: dateStr.nullable().optional(),
        note: z.string().max(4000).nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createMeasurement.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/measurements/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        progressId: z.number().int().positive().nullable().optional(),
        measuredQty: z.number().nonnegative().optional(),
        measuredAt: dateStr.nullable().optional(),
        note: z.string().max(4000).nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateMeasurement.execute({ measurementId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/measurements/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deleteMeasurement.execute({ measurementId: id, companyId: q.companyId });
        return c.body(null, 204);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.get('/attachments', zValidator('query', measurementQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listAttachments.execute({
        companyId: q.companyId,
        measurementId: q.measurementId,
      });
      return c.json({ attachments: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.post(
    '/attachments',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        measurementId: z.number().int().positive(),
        boqLineId: z.number().int().positive().nullable().optional(),
        formula: z.string().max(500).nullable().optional(),
        dimA: dim,
        dimB: dim,
        dimC: dim,
        countN: z.number().nonnegative().nullable().optional(),
        manualQty: z.number().nonnegative().nullable().optional(),
        fileUrl: z.string().max(1000).nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createAttachment.execute(b);
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/attachments/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        boqLineId: z.number().int().positive().nullable().optional(),
        formula: z.string().max(500).nullable().optional(),
        dimA: dim,
        dimB: dim,
        dimC: dim,
        countN: z.number().nonnegative().nullable().optional(),
        manualQty: z.number().nonnegative().nullable().optional(),
        fileUrl: z.string().max(1000).nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateAttachment.execute({ attachmentId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/attachments/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deleteAttachment.execute({ attachmentId: id, companyId: q.companyId });
        return c.body(null, 204);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== AVANSLAR (Advances) ==============================================
  app.get('/advances', zValidator('query', projectQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listAdvances.execute({
        companyId: q.companyId,
        projectId: q.projectId,
      });
      return c.json({ advances: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.post(
    '/advances',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        vendorId: z.number().int().positive().nullable().optional(),
        description: z.string().max(500).nullable().optional(),
        amount: z.number().nonnegative(),
        offsetAmount: z.number().nonnegative().optional(),
        currency: currency.optional(),
        givenAt: dateStr,
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createAdvance.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/advances/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        vendorId: z.number().int().positive().nullable().optional(),
        description: z.string().max(500).nullable().optional(),
        amount: z.number().nonnegative().optional(),
        offsetAmount: z.number().nonnegative().optional(),
        currency: currency.optional(),
        givenAt: dateStr.optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateAdvance.execute({ advanceId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/advances/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deleteAdvance.execute({ advanceId: id, companyId: q.companyId });
        return c.body(null, 204);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== KASA/BANKA (Cash movements) ======================================
  app.get('/cash', zValidator('query', projectQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listCashMovements.execute({
        companyId: q.companyId,
        projectId: q.projectId,
      });
      return c.json({ movements: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.post(
    '/cash',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        direction: z.union([z.literal(1), z.literal(-1)]),
        accountRef: z.string().max(60).nullable().optional(),
        description: z.string().max(500).nullable().optional(),
        amount: z.number().nonnegative(),
        currency: currency.optional(),
        movedAt: dateStr,
        relatedProgressId: z.number().int().positive().nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createCashMovement.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/cash/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deleteCashMovement.execute({ movementId: id, companyId: q.companyId });
        return c.body(null, 204);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== ÖDEME LİSTESİ (Payments) =========================================
  app.get(
    '/payments',
    zValidator(
      'query',
      companyIdQ.extend({ projectId: z.coerce.number().int().positive().optional() }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const items = await deps.listPayments.execute({
          companyId: q.companyId,
          projectId: q.projectId ?? null,
        });
        return c.json({ items });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/payments',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive().nullable().optional(),
        payee: z.string().max(300).nullable().optional(),
        description: z.string().max(500).nullable().optional(),
        amount: z.number().nonnegative(),
        currency: currency.optional(),
        dueDate: dateStr.nullable().optional(),
        status: z.enum(['planned', 'paid']).optional(),
        paidAt: dateStr.nullable().optional(),
        method: z.string().max(40).nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createPayment.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/payments/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive().nullable().optional(),
        payee: z.string().max(300).nullable().optional(),
        description: z.string().max(500).nullable().optional(),
        amount: z.number().nonnegative().optional(),
        currency: currency.optional(),
        dueDate: dateStr.nullable().optional(),
        status: z.enum(['planned', 'paid']).optional(),
        paidAt: dateStr.nullable().optional(),
        method: z.string().max(40).nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updatePayment.execute({ paymentId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/payments/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deletePayment.execute({ paymentId: id, companyId: q.companyId });
        return c.body(null, 204);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== MALZEME (Materials) ==============================================
  app.get(
    '/materials',
    zValidator('query', companyIdQ.extend({ includeInactive: z.coerce.boolean().optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listMaterials.execute({
          companyId: q.companyId,
          ...(q.includeInactive !== undefined ? { includeInactive: q.includeInactive } : {}),
        });
        return c.json({ materials: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/materials',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        code: z.string().min(1).max(40),
        name: z.string().min(1).max(300),
        unit: z.string().max(20).optional(),
        wastePct: z.number().nonnegative().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createMaterial.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/materials/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300).optional(),
        unit: z.string().max(20).optional(),
        wastePct: z.number().nonnegative().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateMaterial.execute({ materialId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
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
        const dto = await deps.deactivateMaterial.execute({
          materialId: id,
          companyId: q.companyId,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== DEPOLAR (Warehouses) =============================================
  app.get('/warehouses', zValidator('query', projectQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listWarehouses.execute({
        companyId: q.companyId,
        projectId: q.projectId,
      });
      return c.json({ warehouses: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.post(
    '/warehouses',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        code: z.string().min(1).max(40),
        name: z.string().min(1).max(200),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createWarehouse.execute(b);
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== STOK (Stock + Movements) =========================================
  app.get('/stock', zValidator('query', projectQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listStock.execute({ companyId: q.companyId, projectId: q.projectId });
      return c.json({ stock: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.get('/stock/movements', zValidator('query', projectQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listMovements.execute({
        companyId: q.companyId,
        projectId: q.projectId,
      });
      return c.json({ movements: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.post(
    '/stock/movements',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        materialId: z.number().int().positive(),
        kind: stockMoveKind,
        fromWarehouse: z.number().int().positive().nullable().optional(),
        toWarehouse: z.number().int().positive().nullable().optional(),
        qty: z.number().nonnegative(),
        unitCost: z.number().nonnegative().optional(),
        boqLineId: z.number().int().positive().nullable().optional(),
        description: z.string().max(500).nullable().optional(),
        movedAt: dateStr,
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.recordStockMovement.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== MALZEME TALEBİ (Material requests) ===============================
  const mreqLine = z.object({
    materialId: z.number().int().positive(),
    qty: z.number().nonnegative(),
    note: z.string().max(500).nullable().optional(),
  });

  app.get('/material-requests', zValidator('query', projectQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listMaterialRequests.execute({
        companyId: q.companyId,
        projectId: q.projectId,
      });
      return c.json({ requests: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.get(
    '/material-requests/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.getMaterialRequest.execute({
          requestId: id,
          companyId: q.companyId,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/material-requests',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        neededBy: dateStr.nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
        lines: z.array(mreqLine).min(1),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createMaterialRequest.execute({ ...b, requestedBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.put(
    '/material-requests/:id/lines',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({ companyId: z.number().int().positive(), lines: z.array(mreqLine) }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.saveMaterialRequestLines.execute({
          requestId: id,
          companyId: b.companyId,
          lines: b.lines,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/material-requests/:id/status',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: z.number().int().positive(), status: mreqStatus })),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      if (b.status === 'approved' && !canApprove(actorRole(c))) {
        return c.json({ message: 'Malzeme talebi onayı için yönetici yetkisi gerekir' }, 403);
      }
      try {
        const dto = await deps.changeMaterialRequestStatus.execute({
          requestId: id,
          companyId: b.companyId,
          status: b.status,
          actorUserId: actorId(c),
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== PERSONEL (Personnel) =============================================
  app.get('/personnel', zValidator('query', projectQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listPersonnel.execute({
        companyId: q.companyId,
        projectId: q.projectId,
      });
      return c.json({ personnel: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.post(
    '/personnel',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        fullName: z.string().min(1).max(200),
        employeeId: z.number().int().positive().nullable().optional(),
        vendorId: z.number().int().positive().nullable().optional(),
        trade: z.string().max(80).nullable().optional(),
        dailyCost: z.number().nonnegative().optional(),
        isSubcontractor: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createPersonnel.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/personnel/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        fullName: z.string().min(1).max(200).optional(),
        trade: z.string().max(80).nullable().optional(),
        dailyCost: z.number().nonnegative().optional(),
        vendorId: z.number().int().positive().nullable().optional(),
        isSubcontractor: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updatePersonnel.execute({ personnelId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/personnel/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.deactivatePersonnel.execute({
          personnelId: id,
          companyId: q.companyId,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== PUANTAJ (Timesheets) =============================================
  app.get(
    '/timesheets',
    zValidator(
      'query',
      projectQ.extend({ fromDate: dateStr.optional(), toDate: dateStr.optional() }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listTimesheets.execute({
          companyId: q.companyId,
          projectId: q.projectId,
          ...(q.fromDate !== undefined ? { fromDate: q.fromDate } : {}),
          ...(q.toDate !== undefined ? { toDate: q.toDate } : {}),
        });
        return c.json({ timesheets: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.put(
    '/timesheets',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        personnelId: z.number().int().positive(),
        workDate: dateStr,
        hours: z.number().nonnegative().optional(),
        overtime: z.number().nonnegative().optional(),
        statusCode: z.string().max(10).optional(),
        boqLineId: z.number().int().positive().nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.saveTimesheet.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/timesheets/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deleteTimesheet.execute({ timesheetId: id, companyId: q.companyId });
        return c.body(null, 204);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== MAKİNE (Machines) ================================================
  app.get(
    '/machines',
    zValidator('query', companyIdQ.extend({ includeInactive: z.coerce.boolean().optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listMachines.execute({
          companyId: q.companyId,
          ...(q.includeInactive !== undefined ? { includeInactive: q.includeInactive } : {}),
        });
        return c.json({ machines: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/machines',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        code: z.string().min(1).max(40),
        name: z.string().min(1).max(200),
        kind: machineKind.optional(),
        vendorId: z.number().int().positive().nullable().optional(),
        hourlyCost: z.number().nonnegative().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createMachine.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/machines/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(200).optional(),
        kind: machineKind.optional(),
        vendorId: z.number().int().positive().nullable().optional(),
        hourlyCost: z.number().nonnegative().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateMachine.execute({ machineId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== MAKİNE LOGLARI (Machine logs) ====================================
  app.get('/machine-logs', zValidator('query', projectQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listMachineLogs.execute({
        companyId: q.companyId,
        projectId: q.projectId,
      });
      return c.json({ logs: list });
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.post(
    '/machine-logs',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        machineId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        logDate: dateStr,
        workHours: z.number().nonnegative().optional(),
        fuelLiters: z.number().nonnegative().optional(),
        fuelCost: z.number().nonnegative().optional(),
        maintCost: z.number().nonnegative().optional(),
        boqLineId: z.number().int().positive().nullable().optional(),
        note: z.string().max(500).nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createMachineLog.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/machine-logs/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.deleteMachineLog.execute({ logId: id, companyId: q.companyId });
        return c.body(null, 204);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.get(
    '/projects/:id/labor-cost-summary',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.getLaborCostSummary.execute({
          projectId: id,
          companyId: q.companyId,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== RAPORLAR (Reports) ===============================================
  app.get(
    '/projects/:id/dashboard',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.getProjectDashboard.execute({
          projectId: id,
          companyId: q.companyId,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.get(
    '/contracts/:id/progress-curve',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.getProgressCurve.execute({ contractId: id, companyId: q.companyId });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== FAZ 1 — LOCATIONS (Mekân kırılımı) ================================

  app.get(
    '/projects/:id/locations',
    zValidator('param', idParam),
    zValidator(
      'query',
      companyIdQ.extend({
        includeInactive: z.coerce.boolean().optional(),
        kind: locationKind.optional(),
        subtreeOf: z.coerce.number().int().positive().optional(),
        search: z.string().optional(),
        /** 'tree' → iç içe ağaç + alt toplamlar, 'flat' → düz liste */
        shape: z.enum(['tree', 'flat']).optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      const opts = {
        companyId: q.companyId,
        projectId: id,
        ...(q.includeInactive !== undefined ? { includeInactive: q.includeInactive } : {}),
        ...(q.kind !== undefined ? { kind: q.kind } : {}),
        ...(q.subtreeOf !== undefined ? { subtreeOf: q.subtreeOf } : {}),
        ...(q.search !== undefined ? { search: q.search } : {}),
      };
      try {
        if (q.shape === 'flat') {
          return c.json({ locations: await deps.listLocations.execute(opts) });
        }
        return c.json({ tree: await deps.getLocationTree.execute(opts) });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/locations',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        parentId: z.number().int().positive().nullable().optional(),
        kind: locationKind,
        code: z.string().min(1).max(40),
        name: z.string().max(200).optional(),
        sortOrder: z.number().int().optional(),
        unitType: z.string().max(40).nullable().optional(),
        grossArea: z.number().nonnegative().nullable().optional(),
        netArea: z.number().nonnegative().nullable().optional(),
        landShare: z.number().nonnegative().nullable().optional(),
        facade: z.string().max(40).nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createLocation.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/locations/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        code: z.string().min(1).max(40).optional(),
        name: z.string().min(1).max(200).optional(),
        sortOrder: z.number().int().optional(),
        unitType: z.string().max(40).nullable().optional(),
        grossArea: z.number().nonnegative().nullable().optional(),
        netArea: z.number().nonnegative().nullable().optional(),
        landShare: z.number().nonnegative().nullable().optional(),
        facade: z.string().max(40).nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(await deps.updateLocation.execute({ locationId: id, ...b }));
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/locations/:id/move',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        newParentId: z.number().int().positive().nullable(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.moveLocation.execute({
            locationId: id,
            companyId: b.companyId,
            newParentId: b.newParentId,
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Silme öncesi "neye bağlı?" sorgusu — arayüz onay diyaloğunda gösterir. */
  app.get(
    '/locations/:id/usage',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getLocationUsage.execute({ locationId: id, companyId: q.companyId }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/locations/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ.extend({ deactivateOnly: z.coerce.boolean().optional() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.deleteLocation.execute({
            locationId: id,
            companyId: q.companyId,
            ...(q.deactivateOnly !== undefined ? { deactivateOnly: q.deactivateOnly } : {}),
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Toplu mekân üretimi: N blok × M kat × K daire iskeleti. */
  app.post(
    '/locations/bulk-generate',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        parentId: z.number().int().positive().nullable().optional(),
        blocks: z.array(z.string().min(1).max(40)).min(1).max(200),
        floors: z.array(z.string().min(1).max(40)).max(200).optional(),
        unitsPerFloor: z.number().int().min(0).max(200).optional(),
        unitNumbering: z.enum(['sequential', 'per_floor']).optional(),
        defaultUnitType: z.string().max(40).nullable().optional(),
        blockNameTemplate: z.string().max(100).optional(),
        floorNameTemplate: z.string().max(100).optional(),
        unitNameTemplate: z.string().max(100).optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.bulkGenerateLocations.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== FAZ 2 — PROGRESS TEMPLATES (Takip şablonları) ====================

  app.get(
    '/progress-templates',
    zValidator(
      'query',
      companyIdQ.extend({
        includeInactive: z.coerce.boolean().optional(),
        scope: trackScope.optional(),
        search: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listProgressTemplates.execute({
          companyId: q.companyId,
          ...(q.includeInactive !== undefined ? { includeInactive: q.includeInactive } : {}),
          ...(q.scope !== undefined ? { scope: q.scope } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
        });
        return c.json({ templates: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.get(
    '/progress-templates/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getProgressTemplate.execute({ templateId: id, companyId: q.companyId }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/progress-templates',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300),
        code: z.string().max(40).optional(),
        scope: trackScope.optional(),
        description: z.string().max(4000).nullable().optional(),
        pctInProgress: pct.optional(),
        pctHasDefects: pct.optional(),
        body: templateBodySchema.optional(),
      }),
    ),
    async (c) => {
      const { body, ...rest } = c.req.valid('json');
      try {
        const dto = await deps.createProgressTemplate.execute({
          ...rest,
          ...(body !== undefined ? { body: normalizeTemplateBody(body) } : {}),
          createdBy: actorId(c),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/progress-templates/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300).optional(),
        scope: trackScope.optional(),
        description: z.string().max(4000).nullable().optional(),
        pctInProgress: pct.optional(),
        pctHasDefects: pct.optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(await deps.updateProgressTemplate.execute({ templateId: id, ...b }));
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Gövde tam-değiştirme. Yanıtta kaç takibin etkilendiği döner. */
  app.put(
    '/progress-templates/:id/body',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({ companyId: z.number().int().positive() }).merge(templateBodySchema),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.saveTemplateBody.execute({
            templateId: id,
            companyId: b.companyId,
            body: normalizeTemplateBody({ groups: b.groups }),
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/progress-templates/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.deactivateProgressTemplate.execute({
            templateId: id,
            companyId: q.companyId,
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== FAZ 2 — TRACKINGS (Güncel durum takipleri) =======================

  app.get(
    '/trackings',
    zValidator(
      'query',
      companyIdQ.extend({
        projectId: z.coerce.number().int().positive().optional(),
        status: trackingStatus.optional(),
        includeCancelled: z.coerce.boolean().optional(),
        search: z.string().optional(),
        asOf: dateStr.optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listTrackings.execute({
          companyId: q.companyId,
          ...(q.projectId !== undefined ? { projectId: q.projectId } : {}),
          ...(q.status !== undefined ? { status: q.status } : {}),
          ...(q.includeCancelled !== undefined ? { includeCancelled: q.includeCancelled } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
          ...(q.asOf !== undefined ? { asOf: q.asOf } : {}),
        });
        return c.json({ trackings: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Saha ekranı: lokasyon sekmeleri + grup/iş matrisi + ilerleme/sapma. */
  app.get(
    '/trackings/:id/board',
    zValidator('param', idParam),
    zValidator('query', companyIdQ.extend({ asOf: dateStr.optional() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getTrackingBoard.execute({
            trackingId: id,
            companyId: q.companyId,
            ...(q.asOf !== undefined ? { asOf: q.asOf } : {}),
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/trackings',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        templateId: z.number().int().positive(),
        name: z.string().min(1).max(300),
        code: z.string().max(40).optional(),
        projectWeightPct: pct.optional(),
        plannedStart: dateStr.nullable().optional(),
        plannedEnd: dateStr.nullable().optional(),
        assignedUserId: z.number().int().positive().nullable().optional(),
        visibleAll: z.boolean().optional(),
        note: z.string().max(4000).nullable().optional(),
        locationIds: z.array(z.number().int().positive()).min(1).max(500),
        locationWeights: z.record(z.string(), z.number().nonnegative()).optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createTracking.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/trackings/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300).optional(),
        projectWeightPct: pct.optional(),
        plannedStart: dateStr.nullable().optional(),
        plannedEnd: dateStr.nullable().optional(),
        assignedUserId: z.number().int().positive().nullable().optional(),
        visibleAll: z.boolean().optional(),
        note: z.string().max(4000).nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(await deps.updateTracking.execute({ trackingId: id, ...b }));
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/trackings/:id/status',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({ companyId: z.number().int().positive(), status: trackingStatus }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.changeTrackingStatus.execute({
            trackingId: id,
            companyId: b.companyId,
            status: b.status,
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Saha durum girişi (toplu). Yalnız aktif takipte kabul edilir. */
  app.put(
    '/trackings/:id/items',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        updates: z
          .array(
            z.object({
              trackingItemId: z.number().int().positive(),
              state: itemState,
              overridePct: pct.nullable().optional(),
              inspectedBy: z.number().int().positive().nullable().optional(),
              inspectedAt: dateStr.nullable().optional(),
              note: z.string().max(1000).nullable().optional(),
            }),
          )
          .min(1)
          .max(1000),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const locations = await deps.setTrackingItemState.execute({
          trackingId: id,
          companyId: b.companyId,
          updates: b.updates,
          changedBy: actorId(c),
        });
        return c.json({ locations });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.get(
    '/tracking-items/:id/history',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const history = await deps.getTrackingItemHistory.execute({
          trackingItemId: id,
          companyId: q.companyId,
        });
        return c.json({ history });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/trackings/:id/locations',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        locationIds: z.array(z.number().int().positive()).min(1).max(500),
        locationWeights: z.record(z.string(), z.number().nonnegative()).optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const locations = await deps.addTrackingLocations.execute({ trackingId: id, ...b });
        return c.json({ locations }, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/trackings/:id/locations/:trackingLocationId',
    requireWrite,
    zValidator(
      'param',
      z.object({
        id: z.coerce.number().int().positive(),
        trackingLocationId: z.coerce.number().int().positive(),
      }),
    ),
    zValidator('query', companyIdQ),
    async (c) => {
      const p = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const locations = await deps.removeTrackingLocation.execute({
          trackingId: p.id,
          companyId: q.companyId,
          trackingLocationId: p.trackingLocationId,
        });
        return c.json({ locations });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Şablona sonradan eklenen işleri takibe yansıtır (mevcut tikler korunur). */
  app.post(
    '/trackings/:id/sync-template',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: z.number().int().positive() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.syncTrackingWithTemplate.execute({
            trackingId: id,
            companyId: b.companyId,
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Proje panelinin "Durum %" göstergesi + takip kırılımı. */
  app.get(
    '/projects/:id/physical-progress',
    zValidator('param', idParam),
    zValidator('query', companyIdQ.extend({ asOf: dateStr.optional() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getProjectPhysicalProgress.execute({
            projectId: id,
            companyId: q.companyId,
            ...(q.asOf !== undefined ? { asOf: q.asOf } : {}),
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== FAZ 3 — DAILY LOG (Şantiye Günlüğü) ===============================

  /** Ay takvimi: her günün toplamları (takvim hücresi göstergeleri). */
  app.get(
    '/projects/:id/daily-logs',
    zValidator('param', idParam),
    zValidator(
      'query',
      companyIdQ.extend({
        year: z.coerce.number().int().min(2000).max(2200),
        month: z.coerce.number().int().min(1).max(12),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getDailyLogMonth.execute({
            companyId: q.companyId,
            projectId: id,
            year: q.year,
            month: q.month,
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /**
   * Bir günün tam görünümü. create=true ise gün başlığı yoksa açılır — takvimde
   * bir güne tıklamak zaten kayıt girme niyetidir. Gün yoksa ve create=false ise
   * 204 döner (404 değil: "o gün henüz doldurulmadı" bir hata değil).
   */
  app.get(
    '/projects/:id/daily-logs/:logDate',
    zValidator('param', z.object({ id: z.coerce.number().int().positive(), logDate: dateStr })),
    zValidator('query', companyIdQ.extend({ create: z.coerce.boolean().optional() })),
    async (c) => {
      const p = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const day = await deps.getDailyLogDay.execute({
          companyId: q.companyId,
          projectId: p.id,
          logDate: p.logDate,
          ...(q.create !== undefined ? { create: q.create } : {}),
          createdBy: actorId(c),
        });
        if (day === null) return c.body(null, 204);
        return c.json(day);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/daily-logs/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        workState: workState.optional(),
        tempC: z.number().nullable().optional(),
        weatherNote: z.string().max(200).nullable().optional(),
        noWorkReason: z.string().max(200).nullable().optional(),
        summary: z.string().max(8000).nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(await deps.updateDailyLog.execute({ logId: id, ...b }));
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /**
   * Gün kilidi. KİLİTLEME editor'a açık (raporu kapatan saha ekibidir), KİLİT
   * AÇMA yönetici ister: kapanmış bir günü yeniden açmak raporun kanıt değerine
   * dokunur, bunu şantiye şefi tek başına yapmamalı.
   */
  app.post(
    '/daily-logs/:id/status',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        status: z.enum(['open', 'locked']),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      if (b.status === 'open' && !canApprove(actorRole(c))) {
        return c.json({ message: 'Kilit açmak için yönetici yetkisi gerekir' }, 403);
      }
      try {
        return c.json(
          await deps.changeDailyLogStatus.execute({
            logId: id,
            companyId: b.companyId,
            status: b.status,
            actorUserId: actorId(c),
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Kayıt tipi tarifleri — arayüz form alanlarını buna göre kurar. */
  app.get('/daily-log-kinds', (c) => {
    return c.json({ kinds: LOG_ENTRY_KINDS.map((k) => kindSpecDto(k)) });
  });

  /** Satır ekle/güncelle (entryId varsa güncelleme). */
  app.put(
    '/daily-logs/:id/entries',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        entryId: z.number().int().positive().optional(),
        kind: logEntryKind,
        locationId: z.number().int().positive().nullable().optional(),
        vendorId: z.number().int().positive().nullable().optional(),
        personnelId: z.number().int().positive().nullable().optional(),
        machineId: z.number().int().positive().nullable().optional(),
        materialId: z.number().int().positive().nullable().optional(),
        boqLineId: z.number().int().positive().nullable().optional(),
        trackingItemId: z.number().int().positive().nullable().optional(),
        crewName: z.string().max(100).nullable().optional(),
        personName: z.string().max(200).nullable().optional(),
        description: z.string().max(1000).nullable().optional(),
        headcount: z.number().int().nonnegative().nullable().optional(),
        hours: z.number().nonnegative().nullable().optional(),
        idleHours: z.number().nonnegative().nullable().optional(),
        qty: z.number().nonnegative().nullable().optional(),
        unit: z.string().max(20).nullable().optional(),
        amount: z.number().nonnegative().nullable().optional(),
        currency: currency.optional(),
        waybillNo: z.string().max(60).nullable().optional(),
        occurredAt: z
          .string()
          .regex(/^\d{2}:\d{2}(:\d{2})?$/)
          .nullable()
          .optional(),
        severity: accidentSeverity.nullable().optional(),
        lostDays: z.number().int().nonnegative().nullable().optional(),
        sortOrder: z.number().int().nonnegative().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.saveDailyLogEntry.execute({
          logId: id,
          ...b,
          createdBy: actorId(c),
        });
        return c.json(dto, b.entryId === undefined ? 201 : 200);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/daily-log-entries/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.deleteDailyLogEntry.execute({ entryId: id, companyId: q.companyId }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/daily-logs/:id/files',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z
        .object({
          companyId: z.number().int().positive(),
          entryId: z.number().int().positive().nullable().optional(),
          fileKind: z.enum(['photo', 'doc']).optional(),
          title: z.string().max(300).nullable().optional(),
          fileUrl: z.string().max(1000).nullable().optional(),
          contentBase64: z.string().nullable().optional(),
          mimeType: z.string().max(100).nullable().optional(),
        })
        // DB CHECK'i ile aynı kural, istemciye 400 olarak erken döner
        .refine((v) => (v.fileUrl ?? null) !== null || (v.contentBase64 ?? null) !== null, {
          message: 'fileUrl veya contentBase64 zorunlu',
        }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.addDailyLogFile.execute({
          companyId: b.companyId,
          logId: id,
          entryId: b.entryId ?? null,
          fileKind: b.fileKind ?? 'photo',
          title: b.title ?? null,
          fileUrl: b.fileUrl ?? null,
          contentBase64: b.contentBase64 ?? null,
          mimeType: b.mimeType ?? null,
          createdBy: actorId(c),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/daily-log-files/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.deleteDailyLogFile.execute({ fileId: id, companyId: q.companyId }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/daily-logs/:id/comments',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        entryId: z.number().int().positive().nullable().optional(),
        body: z.string().min(1).max(2000),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.addDailyLogComment.execute({
          companyId: b.companyId,
          logId: id,
          entryId: b.entryId ?? null,
          body: b.body,
          createdBy: actorId(c),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** İş gücü raporu — adam-gün eğrisi. */
  app.get(
    '/projects/:id/manpower',
    zValidator('param', idParam),
    zValidator('query', companyIdQ.extend({ fromDate: dateStr, toDate: dateStr })),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getManpowerReport.execute({
            companyId: q.companyId,
            projectId: id,
            fromDate: q.fromDate,
            toDate: q.toDate,
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** İSG özeti — kaza sıklık ve ağırlık oranları. */
  app.get(
    '/projects/:id/safety-summary',
    zValidator('param', idParam),
    zValidator('query', companyIdQ.extend({ fromDate: dateStr, toDate: dateStr })),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getSafetySummary.execute({
            companyId: q.companyId,
            projectId: id,
            fromDate: q.fromDate,
            toDate: q.toDate,
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Keşif satırı bazında günlükten gelen gerçekleşen imalat. */
  app.get(
    '/projects/:id/production-actuals',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const rows = await deps.getProductionActuals.execute({
          companyId: q.companyId,
          projectId: id,
        });
        return c.json({ rows });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Mekân × malzeme tüketimi (fire analizi girdisi). */
  app.get(
    '/projects/:id/material-consumption',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const rows = await deps.getMaterialConsumption.execute({
          companyId: q.companyId,
          projectId: id,
        });
        return c.json({ rows });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== FAZ 4 — PERFORMANCE (Adam×saat & verimlilik) ======================

  /** Sözleşme bazlı poz performans tablosu + ağırlıklı özet. */
  app.get(
    '/contracts/:id/performance',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getContractPerformance.execute({ contractId: id, companyId: q.companyId }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Proje geneli poz performansı (tüm sözleşmeler). */
  app.get(
    '/projects/:id/performance',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getProjectPerformance.execute({ projectId: id, companyId: q.companyId }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Sözleşme bazlı adam×saat özetleri (proje panelinde kart listesi). */
  app.get(
    '/projects/:id/manhour-summaries',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const summaries = await deps.getProjectManhourSummaries.execute({
          projectId: id,
          companyId: q.companyId,
        });
        return c.json({ summaries });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Birim adam×saat toplu girişi. Keşifteki diğer alanlara dokunmaz. */
  app.put(
    '/contracts/:id/unit-manhours',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        updates: z
          .array(
            z.object({
              boqLineId: z.number().int().positive(),
              unitManhours: z.number().nonnegative(),
            }),
          )
          .min(1)
          .max(2000),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.setUnitManhours.execute({
            contractId: id,
            companyId: b.companyId,
            updates: b.updates,
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== FAZ 5 — APPROVAL FLOW (Jenerik onay akışı) ========================

  /**
   * "Bana atanan onaylar" kutusu. Kullanıcı token'dan gelir — başkasının
   * onay kutusunu görmek anlamsız ve sızıntı olur.
   */
  app.get('/approvals/mine', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    const userId = actorId(c);
    if (userId === null) {
      return c.json({ message: 'Kullanıcı belirlenemedi' }, 401);
    }
    try {
      return c.json(await deps.getMyApprovals.execute({ companyId: q.companyId, userId }));
    } catch (err) {
      mapConstructionError(err);
    }
  });

  app.get(
    '/approvals',
    zValidator(
      'query',
      companyIdQ.extend({
        docKind: approvalDocKind.optional(),
        docId: z.coerce.number().int().positive().optional(),
        projectId: z.coerce.number().int().positive().optional(),
        status: approvalStatus.optional(),
        overdueOnly: z.coerce.boolean().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const flows = await deps.listApprovalFlows.execute({
          companyId: q.companyId,
          ...(q.docKind !== undefined ? { docKind: q.docKind } : {}),
          ...(q.docId !== undefined ? { docId: q.docId } : {}),
          ...(q.projectId !== undefined ? { projectId: q.projectId } : {}),
          ...(q.status !== undefined ? { status: q.status } : {}),
          ...(q.overdueOnly !== undefined ? { overdueOnly: q.overdueOnly } : {}),
        });
        return c.json({ flows });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Liste ekranları için toplu "N/M" özeti — belge başına ayrı istek atmasın. */
  app.post(
    '/approvals/summaries',
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        docKind: approvalDocKind,
        docIds: z.array(z.number().int().positive()).max(500),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const summaries = await deps.getApprovalSummariesForDocs.execute(b);
        return c.json({ summaries });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Belgenin AKTİF akışı; yoksa 204 (çoğu belgede akış yoktur, hata değil). */
  app.get(
    '/approvals/doc/:docKind/:docId',
    zValidator(
      'param',
      z.object({ docKind: approvalDocKind, docId: z.coerce.number().int().positive() }),
    ),
    zValidator('query', companyIdQ),
    async (c) => {
      const p = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const flow = await deps.getDocApproval.execute({
          companyId: q.companyId,
          docKind: p.docKind,
          docId: p.docId,
        });
        if (flow === null) return c.body(null, 204);
        return c.json(flow);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.get(
    '/approvals/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.getApprovalFlow.execute({ companyId: q.companyId, flowId: id }));
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.get(
    '/approvals/:id/history',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const history = await deps.getApprovalHistory.execute({
          companyId: q.companyId,
          flowId: id,
        });
        return c.json({ history });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/approvals',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        docKind: approvalDocKind,
        docId: z.number().int().positive(),
        projectId: z.number().int().positive().nullable().optional(),
        mode: z.enum(['ordered', 'unordered']).optional(),
        minApprovals: z.number().int().positive().nullable().optional(),
        title: z.string().max(300).nullable().optional(),
        note: z.string().max(4000).nullable().optional(),
        approvers: z
          .array(
            z.object({
              approverUserId: z.number().int().positive(),
              dueDate: dateStr.nullable().optional(),
            }),
          )
          .min(1)
          .max(50),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.startApprovalFlow.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /**
   * Adım kararı. Onaycı KENDİ adımına karar verebilir; başkasının adımına karar
   * vermek (vekâleten onay) yönetici yetkisi ister ve izde 'delegated' olarak
   * görünür — kimin bastığı gizlenmez.
   */
  app.post(
    '/approvals/:id/steps/:stepId/decide',
    requireWrite,
    zValidator(
      'param',
      z.object({
        id: z.coerce.number().int().positive(),
        stepId: z.coerce.number().int().positive(),
      }),
    ),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        approve: z.boolean(),
        comment: z.string().max(1000).nullable().optional(),
      }),
    ),
    async (c) => {
      const p = c.req.valid('param');
      const b = c.req.valid('json');
      const userId = actorId(c);
      if (userId === null) {
        return c.json({ message: 'Kullanıcı belirlenemedi' }, 401);
      }
      try {
        // Vekâleten onay denetimi: adım başkasınınsa yönetici olmalı.
        const flow = await deps.getApprovalFlow.execute({
          companyId: b.companyId,
          flowId: p.id,
        });
        const step = flow.steps.find((s) => s.id === p.stepId);
        if (step !== undefined && step.approverUserId !== userId && !canApprove(actorRole(c))) {
          return c.json(
            { message: 'Başkasının onay adımına karar vermek için yönetici yetkisi gerekir' },
            403,
          );
        }
        return c.json(
          await deps.decideApprovalStep.execute({
            companyId: b.companyId,
            flowId: p.id,
            stepId: p.stepId,
            approve: b.approve,
            actorUserId: userId,
            ...(b.comment !== undefined ? { comment: b.comment } : {}),
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  /** Akışı iptal et — yönetici yetkisi ister (başlatılmış onayı geri almak). */
  app.post(
    '/approvals/:id/cancel',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: z.number().int().positive() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      if (!canApprove(actorRole(c))) {
        return c.json({ message: 'Onay akışını iptal etmek için yönetici yetkisi gerekir' }, 403);
      }
      try {
        return c.json(
          await deps.cancelApprovalFlow.execute({
            companyId: b.companyId,
            flowId: id,
            actorUserId: actorId(c),
          }),
        );
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  return app;
}
