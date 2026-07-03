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

import { authMiddleware, requireRole } from '../../../middleware/auth.js';
import type { GetBoqUseCase, SaveBoqLinesUseCase } from '../application/useCases/BoqUseCases.js';
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
  CreateContractUseCase,
  ListContractsUseCase,
  UpdateContractUseCase,
} from '../application/useCases/ContractUseCases.js';
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

  return app;
}
