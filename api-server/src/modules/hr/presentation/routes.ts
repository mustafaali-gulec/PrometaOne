/**
 * HR HTTP route'ları — Faz 4 / PR 4b.
 *
 * Tüm endpoint'ler:
 *   - authMiddleware ile korunur (Authorization: Bearer ... gerekli)
 *   - Yazma işlemleri en az 'hr_manager' rolü ister (ADR-0005)
 *   - companyId query/body'den alınır; multi-tenant izolasyon repo'larda
 *
 * Bu dosya use-case'leri yalnızca çağırır — iş kuralı YAZMAZ.
 * Hata mapping presentation/errorMapping.ts'de.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard, requireRole } from '../../../middleware/auth.js';
import type { ApproveLeaveRequestUseCase } from '../application/useCases/ApproveLeaveRequestUseCase.js';
import type { ArchiveDepartmentUseCase } from '../application/useCases/ArchiveDepartmentUseCase.js';
import type { ArchiveOrgUnitUseCase } from '../application/useCases/ArchiveOrgUnitUseCase.js';
import type { AssignAssetUseCase } from '../application/useCases/AssignAssetUseCase.js';
import type { AssignDepartmentManagerUseCase } from '../application/useCases/AssignDepartmentManagerUseCase.js';
import type { CancelLeaveRequestUseCase } from '../application/useCases/CancelLeaveRequestUseCase.js';
import type { ClosePositionUseCase } from '../application/useCases/ClosePositionUseCase.js';
import type { CreateAssetUseCase } from '../application/useCases/CreateAssetUseCase.js';
import type { CreateDepartmentUseCase } from '../application/useCases/CreateDepartmentUseCase.js';
import type { CreateOrgUnitUseCase } from '../application/useCases/CreateOrgUnitUseCase.js';
import type { CreatePayrollRunUseCase } from '../application/useCases/CreatePayrollRunUseCase.js';
import type { CreatePositionUseCase } from '../application/useCases/CreatePositionUseCase.js';
import type { DeleteCandidateUseCase } from '../application/useCases/DeleteCandidateUseCase.js';
import type { FinalizePayrollRunUseCase } from '../application/useCases/FinalizePayrollRunUseCase.js';
import type { GetAssetUseCase } from '../application/useCases/GetAssetUseCase.js';
import type { GetLeaveBalanceUseCase } from '../application/useCases/GetLeaveBalanceUseCase.js';
import type { GetPayrollRunUseCase } from '../application/useCases/GetPayrollRunUseCase.js';
import type { GetRecruitmentFunnelUseCase } from '../application/useCases/GetRecruitmentFunnelUseCase.js';
import type { HireEmployeeUseCase } from '../application/useCases/HireEmployeeUseCase.js';
import type { HireFromApplicationUseCase } from '../application/useCases/HireFromApplicationUseCase.js';
import type { LinkEmployeeToUserUseCase } from '../application/useCases/LinkEmployeeToUserUseCase.js';
import type { ListApplicationsForCandidateUseCase } from '../application/useCases/ListApplicationsForCandidateUseCase.js';
import type { ListApplicationsForPositionUseCase } from '../application/useCases/ListApplicationsForPositionUseCase.js';
import type { ListAssetsUseCase } from '../application/useCases/ListAssetsUseCase.js';
import type { ListCandidatesUseCase } from '../application/useCases/ListCandidatesUseCase.js';
import type { ListEmployeesUseCase } from '../application/useCases/ListEmployeesUseCase.js';
import type { ListLeaveRequestsUseCase } from '../application/useCases/ListLeaveRequestsUseCase.js';
import type { ListOrgTreeForCompanyUseCase } from '../application/useCases/ListOrgTreeForCompanyUseCase.js';
import type { ListPayrollRunsUseCase } from '../application/useCases/ListPayrollRunsUseCase.js';
import type { ListPositionsUseCase } from '../application/useCases/ListPositionsUseCase.js';
import type { MoveApplicationStageUseCase } from '../application/useCases/MoveApplicationStageUseCase.js';
import type { MoveOrgUnitUseCase } from '../application/useCases/MoveOrgUnitUseCase.js';
import type { RegisterCandidateUseCase } from '../application/useCases/RegisterCandidateUseCase.js';
import type { RejectApplicationUseCase } from '../application/useCases/RejectApplicationUseCase.js';
import type { RejectLeaveRequestUseCase } from '../application/useCases/RejectLeaveRequestUseCase.js';
import type { RequestLeaveUseCase } from '../application/useCases/RequestLeaveUseCase.js';
import type { ReturnAssetUseCase } from '../application/useCases/ReturnAssetUseCase.js';
import type { RunPayrollBatchUseCase } from '../application/useCases/RunPayrollBatchUseCase.js';
import type { SubmitApplicationUseCase } from '../application/useCases/SubmitApplicationUseCase.js';
import type { TerminateEmployeeUseCase } from '../application/useCases/TerminateEmployeeUseCase.js';
import type { TransferEmployeeUseCase } from '../application/useCases/TransferEmployeeUseCase.js';
import type { UnlinkEmployeeFromUserUseCase } from '../application/useCases/UnlinkEmployeeFromUserUseCase.js';
import type { UpdateAssetUseCase } from '../application/useCases/UpdateAssetUseCase.js';
import type { UpdateCandidateUseCase } from '../application/useCases/UpdateCandidateUseCase.js';
import type { UpdateDepartmentUseCase } from '../application/useCases/UpdateDepartmentUseCase.js';
import type { UpdateEmployeeProfileUseCase } from '../application/useCases/UpdateEmployeeProfileUseCase.js';
import type { UpdateOrgUnitUseCase } from '../application/useCases/UpdateOrgUnitUseCase.js';
import type { UpdatePositionUseCase } from '../application/useCases/UpdatePositionUseCase.js';
import type { WithdrawApplicationUseCase } from '../application/useCases/WithdrawApplicationUseCase.js';

import { mapHrError } from './errorMapping.js';

export interface HrRouterDeps {
  // OrgUnit (5)
  createOrgUnit: CreateOrgUnitUseCase;
  updateOrgUnit: UpdateOrgUnitUseCase;
  moveOrgUnit: MoveOrgUnitUseCase;
  archiveOrgUnit: ArchiveOrgUnitUseCase;
  listOrgTree: ListOrgTreeForCompanyUseCase;
  // Department (4)
  createDepartment: CreateDepartmentUseCase;
  updateDepartment: UpdateDepartmentUseCase;
  archiveDepartment: ArchiveDepartmentUseCase;
  assignDepartmentManager: AssignDepartmentManagerUseCase;
  // Position (4)
  createPosition: CreatePositionUseCase;
  updatePosition: UpdatePositionUseCase;
  closePosition: ClosePositionUseCase;
  listPositions: ListPositionsUseCase;
  // Employee (7)
  hireEmployee: HireEmployeeUseCase;
  updateEmployeeProfile: UpdateEmployeeProfileUseCase;
  transferEmployee: TransferEmployeeUseCase;
  terminateEmployee: TerminateEmployeeUseCase;
  linkEmployeeToUser: LinkEmployeeToUserUseCase;
  unlinkEmployeeFromUser: UnlinkEmployeeFromUserUseCase;
  listEmployees: ListEmployeesUseCase;
  // Candidate (4)
  registerCandidate: RegisterCandidateUseCase;
  updateCandidate: UpdateCandidateUseCase;
  deleteCandidate: DeleteCandidateUseCase;
  listCandidates: ListCandidatesUseCase;
  // Application (8)
  submitApplication: SubmitApplicationUseCase;
  moveApplicationStage: MoveApplicationStageUseCase;
  rejectApplication: RejectApplicationUseCase;
  withdrawApplication: WithdrawApplicationUseCase;
  hireFromApplication: HireFromApplicationUseCase;
  listApplicationsForPosition: ListApplicationsForPositionUseCase;
  listApplicationsForCandidate: ListApplicationsForCandidateUseCase;
  getRecruitmentFunnel: GetRecruitmentFunnelUseCase;
  // Leave (İzin Yönetimi — 6)
  requestLeave: RequestLeaveUseCase;
  approveLeaveRequest: ApproveLeaveRequestUseCase;
  rejectLeaveRequest: RejectLeaveRequestUseCase;
  cancelLeaveRequest: CancelLeaveRequestUseCase;
  listLeaveRequests: ListLeaveRequestsUseCase;
  getLeaveBalance: GetLeaveBalanceUseCase;
  // Payroll (Bordro Yönetimi — 5)
  createPayrollRun: CreatePayrollRunUseCase;
  runPayrollBatch: RunPayrollBatchUseCase;
  finalizePayrollRun: FinalizePayrollRunUseCase;
  listPayrollRuns: ListPayrollRunsUseCase;
  getPayrollRun: GetPayrollRunUseCase;
  // Asset (Zimmet / Varlık Yönetimi — 6)
  createAsset: CreateAssetUseCase;
  updateAsset: UpdateAssetUseCase;
  assignAsset: AssignAssetUseCase;
  returnAsset: ReturnAssetUseCase;
  listAssets: ListAssetsUseCase;
  getAsset: GetAssetUseCase;
}

// ===========================================================================
// Schema fragmanları (yeniden kullanılır)
// ===========================================================================
const companyIdQuery = z.object({
  companyId: z.coerce.number().int().positive(),
});

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

const positiveInt = z.number().int().positive();

const employmentTypeSchema = z.enum(['full_time', 'part_time', 'contract', 'intern']);
const employeeStatusSchema = z.enum(['probation', 'active', 'on_leave', 'terminated']);
const positionStatusSchema = z.enum(['draft', 'open', 'closed']);
const candidateSourceSchema = z.enum([
  'referral',
  'linkedin',
  'jobboard',
  'direct',
  'agency',
  'other',
]);
const recruitmentStageSchema = z.enum([
  'new',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
]);
const leaveTypeSchema = z.enum(['annual', 'sick', 'unpaid', 'maternity', 'other']);
const leaveStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
const payrollRunStatusSchema = z.enum(['draft', 'finalized']);
const assetTypeSchema = z.enum([
  'laptop',
  'desktop',
  'phone',
  'vehicle',
  'card',
  'monitor',
  'headset',
  'tablet',
  'printer',
  'furniture',
  'key_lock',
  'uniform',
  'ppe',
  'other',
]);
const assetStatusSchema = z.enum(['in_stock', 'assigned', 'maintenance', 'retired', 'lost']);

// ===========================================================================
// Router
// ===========================================================================
export function createHrRouter(deps: HrRouterDeps): Hono {
  const app = new Hono();

  // Tüm route'lar authentication gerektirir
  app.use('*', authMiddleware);
  app.use('*', companyScopeGuard);

  // Writer middleware shortcut (admin or hr_manager+)
  const requireHrWrite = requireRole('hr_manager');

  // -------------------------------------------------------------------------
  // ORG TREE
  // -------------------------------------------------------------------------
  app.get(
    '/org-tree',
    zValidator('query', companyIdQuery.extend({ includeInactive: z.coerce.boolean().optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const opts: { companyId: number; includeInactive?: boolean } = {
          companyId: q.companyId,
        };
        if (q.includeInactive !== undefined) opts.includeInactive = q.includeInactive;
        const tree = await deps.listOrgTree.execute(opts);
        return c.json({ tree });
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // ORG UNIT
  // -------------------------------------------------------------------------
  app.post(
    '/org-units',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        parentId: positiveInt.nullable(),
        name: z.string().min(1).max(200),
        code: z.string().max(40).nullable().optional(),
        sortOrder: z.number().int().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.createOrgUnit.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          parentId: body.parentId,
          name: body.name,
          code: body.code ?? null,
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.patch(
    '/org-units/:id',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        name: z.string().min(1).max(200).optional(),
        code: z.string().max(40).nullable().optional(),
        sortOrder: z.number().int().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.updateOrgUnit.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          id,
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/org-units/:id/move',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        newParentId: positiveInt.nullable(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.moveOrgUnit.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          id,
          newParentId: body.newParentId,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.delete(
    '/org-units/:id',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQuery),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      try {
        const dto = await deps.archiveOrgUnit.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId,
          id,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // DEPARTMENT
  // -------------------------------------------------------------------------
  app.post(
    '/departments',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        orgUnitId: positiveInt.nullable(),
        name: z.string().min(1).max(200),
        code: z.string().max(40).nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.createDepartment.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          orgUnitId: body.orgUnitId,
          name: body.name,
          code: body.code ?? null,
        });
        return c.json(dto, 201);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.patch(
    '/departments/:id',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        name: z.string().min(1).max(200).optional(),
        code: z.string().max(40).nullable().optional(),
        orgUnitId: positiveInt.nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.updateDepartment.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          id,
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.orgUnitId !== undefined ? { orgUnitId: body.orgUnitId } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.delete(
    '/departments/:id',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQuery),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      try {
        const dto = await deps.archiveDepartment.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId,
          id,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/departments/:id/assign-manager',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        employeeId: positiveInt.nullable(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.assignDepartmentManager.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          departmentId: id,
          employeeId: body.employeeId,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // POSITION
  // -------------------------------------------------------------------------
  app.get(
    '/positions',
    zValidator(
      'query',
      companyIdQuery.extend({
        status: positionStatusSchema.optional(),
        departmentId: z.coerce.number().int().positive().nullable().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const opts: {
          companyId: number;
          status?: 'draft' | 'open' | 'closed';
          departmentId?: number | null;
        } = { companyId: q.companyId };
        if (q.status !== undefined) opts.status = q.status;
        if (q.departmentId !== undefined) opts.departmentId = q.departmentId;
        const list = await deps.listPositions.execute(opts);
        return c.json({ positions: list });
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/positions',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        departmentId: positiveInt.nullable(),
        title: z.string().min(1).max(200),
        description: z.string().nullable().optional(),
        status: positionStatusSchema.optional(),
        headcountTarget: z.number().int().nonnegative().optional(),
        minSalary: z.number().nonnegative().nullable().optional(),
        maxSalary: z.number().nonnegative().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.createPosition.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          departmentId: body.departmentId,
          title: body.title,
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.headcountTarget !== undefined ? { headcountTarget: body.headcountTarget } : {}),
          ...(body.minSalary !== undefined ? { minSalary: body.minSalary } : {}),
          ...(body.maxSalary !== undefined ? { maxSalary: body.maxSalary } : {}),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.patch(
    '/positions/:id',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        title: z.string().min(1).max(200).optional(),
        description: z.string().nullable().optional(),
        headcountTarget: z.number().int().nonnegative().optional(),
        minSalary: z.number().nonnegative().nullable().optional(),
        maxSalary: z.number().nonnegative().nullable().optional(),
        departmentId: positiveInt.nullable().optional(),
        status: positionStatusSchema.optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.updatePosition.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          id,
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.headcountTarget !== undefined ? { headcountTarget: body.headcountTarget } : {}),
          ...(body.minSalary !== undefined ? { minSalary: body.minSalary } : {}),
          ...(body.maxSalary !== undefined ? { maxSalary: body.maxSalary } : {}),
          ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/positions/:id/close',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: positiveInt })),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('json');
      try {
        const dto = await deps.closePosition.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId,
          id,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // EMPLOYEE
  // -------------------------------------------------------------------------
  app.get(
    '/employees',
    zValidator(
      'query',
      companyIdQuery.extend({
        status: employeeStatusSchema.optional(),
        departmentId: z.coerce.number().int().positive().optional(),
        positionId: z.coerce.number().int().positive().optional(),
        q: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const opts: {
          companyId: number;
          status?: 'probation' | 'active' | 'on_leave' | 'terminated';
          departmentId?: number;
          positionId?: number;
          q?: string;
        } = { companyId: q.companyId };
        if (q.status !== undefined) opts.status = q.status;
        if (q.departmentId !== undefined) opts.departmentId = q.departmentId;
        if (q.positionId !== undefined) opts.positionId = q.positionId;
        if (q.q !== undefined) opts.q = q.q;
        const list = await deps.listEmployees.execute(opts);
        return c.json({ employees: list });
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/employees',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        departmentId: positiveInt,
        positionId: positiveInt.nullable(),
        employeeNo: z.string().max(40).optional(),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        tcKimlik: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        hireDate: z.string(),
        status: employeeStatusSchema.optional(),
        employmentType: employmentTypeSchema.optional(),
        userId: positiveInt.nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.hireEmployee.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          departmentId: body.departmentId,
          positionId: body.positionId,
          firstName: body.firstName,
          lastName: body.lastName,
          hireDate: body.hireDate,
          ...(body.employeeNo !== undefined ? { employeeNo: body.employeeNo } : {}),
          ...(body.tcKimlik !== undefined ? { tcKimlik: body.tcKimlik } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.employmentType !== undefined ? { employmentType: body.employmentType } : {}),
          ...(body.userId !== undefined ? { userId: body.userId } : {}),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.patch(
    '/employees/:id',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        tcKimlik: z.string().nullable().optional(),
        employmentType: employmentTypeSchema.optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.updateEmployeeProfile.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          id,
          ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
          ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.tcKimlik !== undefined ? { tcKimlik: body.tcKimlik } : {}),
          ...(body.employmentType !== undefined ? { employmentType: body.employmentType } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/employees/:id/transfer',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        newDepartmentId: positiveInt,
        newPositionId: positiveInt.nullable(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.transferEmployee.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          employeeId: id,
          newDepartmentId: body.newDepartmentId,
          newPositionId: body.newPositionId,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/employees/:id/terminate',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        terminationDate: z.string().optional(),
        reason: z.string().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.terminateEmployee.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          employeeId: id,
          ...(body.terminationDate !== undefined ? { terminationDate: body.terminationDate } : {}),
          ...(body.reason !== undefined ? { reason: body.reason } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/employees/:id/link-user',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: positiveInt, userId: positiveInt })),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.linkEmployeeToUser.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          employeeId: id,
          userId: body.userId,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.delete(
    '/employees/:id/link-user',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQuery),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      try {
        const dto = await deps.unlinkEmployeeFromUser.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId,
          employeeId: id,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // CANDIDATE
  // -------------------------------------------------------------------------
  app.get(
    '/candidates',
    zValidator(
      'query',
      companyIdQuery.extend({
        source: candidateSourceSchema.optional(),
        q: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const opts: {
          companyId: number;
          source?: 'referral' | 'linkedin' | 'jobboard' | 'direct' | 'agency' | 'other';
          q?: string;
        } = { companyId: q.companyId };
        if (q.source !== undefined) opts.source = q.source;
        if (q.q !== undefined) opts.q = q.q;
        const list = await deps.listCandidates.execute(opts);
        return c.json({ candidates: list });
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/candidates',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        source: candidateSourceSchema.optional(),
        cvUrl: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.registerCandidate.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          firstName: body.firstName,
          lastName: body.lastName,
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.source !== undefined ? { source: body.source } : {}),
          ...(body.cvUrl !== undefined ? { cvUrl: body.cvUrl } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.patch(
    '/candidates/:id',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        source: candidateSourceSchema.optional(),
        cvUrl: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.updateCandidate.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          id,
          ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
          ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.source !== undefined ? { source: body.source } : {}),
          ...(body.cvUrl !== undefined ? { cvUrl: body.cvUrl } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.delete(
    '/candidates/:id',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQuery),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      try {
        await deps.deleteCandidate.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId,
          id,
        });
        return c.json({ ok: true });
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // APPLICATION
  // -------------------------------------------------------------------------
  app.get(
    '/applications',
    zValidator(
      'query',
      companyIdQuery.extend({
        positionId: z.coerce.number().int().positive().optional(),
        candidateId: z.coerce.number().int().positive().optional(),
        stage: recruitmentStageSchema.optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        if (q.positionId !== undefined) {
          const opts: {
            companyId: number;
            positionId: number;
            stage?:
              | 'new'
              | 'screening'
              | 'interview'
              | 'offer'
              | 'hired'
              | 'rejected'
              | 'withdrawn';
          } = { companyId: q.companyId, positionId: q.positionId };
          if (q.stage !== undefined) opts.stage = q.stage;
          const list = await deps.listApplicationsForPosition.execute(opts);
          return c.json({ applications: list });
        }
        if (q.candidateId !== undefined) {
          const list = await deps.listApplicationsForCandidate.execute({
            companyId: q.companyId,
            candidateId: q.candidateId,
          });
          return c.json({ applications: list });
        }
        return c.json({ applications: [] });
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.get(
    '/applications/funnel',
    zValidator(
      'query',
      companyIdQuery.extend({
        positionId: z.coerce.number().int().positive().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const opts: { companyId: number; positionId?: number } = {
          companyId: q.companyId,
        };
        if (q.positionId !== undefined) opts.positionId = q.positionId;
        const funnel = await deps.getRecruitmentFunnel.execute(opts);
        return c.json(funnel);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/applications',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        candidateId: positiveInt,
        positionId: positiveInt,
        salaryExpectation: z.number().nonnegative().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.submitApplication.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          candidateId: body.candidateId,
          positionId: body.positionId,
          ...(body.salaryExpectation !== undefined
            ? { salaryExpectation: body.salaryExpectation }
            : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/applications/:id/move-stage',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        newStage: recruitmentStageSchema,
        rejectionReason: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.moveApplicationStage.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          applicationId: id,
          newStage: body.newStage,
          ...(body.rejectionReason !== undefined ? { rejectionReason: body.rejectionReason } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/applications/:id/reject',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: positiveInt, reason: z.string().min(1) })),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.rejectApplication.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          applicationId: id,
          reason: body.reason,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/applications/:id/withdraw',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: positiveInt, note: z.string().optional() })),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.withdrawApplication.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          applicationId: id,
          ...(body.note !== undefined ? { note: body.note } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/applications/:id/hire',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        departmentId: positiveInt,
        employeeNo: z.string().max(40).optional(),
        hireDate: z.string(),
        status: employeeStatusSchema.optional(),
        employmentType: employmentTypeSchema.optional(),
        tcKimlik: z.string().nullable().optional(),
        userId: positiveInt.nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.hireFromApplication.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          applicationId: id,
          departmentId: body.departmentId,
          hireDate: body.hireDate,
          ...(body.employeeNo !== undefined ? { employeeNo: body.employeeNo } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.employmentType !== undefined ? { employmentType: body.employmentType } : {}),
          ...(body.tcKimlik !== undefined ? { tcKimlik: body.tcKimlik } : {}),
          ...(body.userId !== undefined ? { userId: body.userId } : {}),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // LEAVE (İzin Yönetimi)
  // -------------------------------------------------------------------------
  app.get(
    '/leave-requests',
    zValidator(
      'query',
      companyIdQuery.extend({
        employeeId: z.coerce.number().int().positive().optional(),
        status: leaveStatusSchema.optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const opts: {
          companyId: number;
          employeeId?: number;
          status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
        } = { companyId: q.companyId };
        if (q.employeeId !== undefined) opts.employeeId = q.employeeId;
        if (q.status !== undefined) opts.status = q.status;
        const list = await deps.listLeaveRequests.execute(opts);
        return c.json({ leaveRequests: list });
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/leave-requests',
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        employeeId: positiveInt,
        leaveType: leaveTypeSchema,
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.requestLeave.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          employeeId: body.employeeId,
          leaveType: body.leaveType,
          startDate: body.startDate,
          endDate: body.endDate,
          ...(body.reason !== undefined ? { reason: body.reason } : {}),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/leave-requests/:id/approve',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({ companyId: positiveInt, note: z.string().nullable().optional() }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.approveLeaveRequest.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          leaveRequestId: id,
          ...(body.note !== undefined ? { note: body.note } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/leave-requests/:id/reject',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({ companyId: positiveInt, note: z.string().nullable().optional() }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.rejectLeaveRequest.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          leaveRequestId: id,
          ...(body.note !== undefined ? { note: body.note } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/leave-requests/:id/cancel',
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({ companyId: positiveInt, note: z.string().nullable().optional() }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.cancelLeaveRequest.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          leaveRequestId: id,
          ...(body.note !== undefined ? { note: body.note } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.get(
    '/leave-balance',
    zValidator(
      'query',
      companyIdQuery.extend({
        employeeId: z.coerce.number().int().positive(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const dto = await deps.getLeaveBalance.execute({
          companyId: q.companyId,
          employeeId: q.employeeId,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // PAYROLL (Bordro Yönetimi)
  // -------------------------------------------------------------------------
  app.get(
    '/payroll-runs',
    zValidator(
      'query',
      companyIdQuery.extend({
        year: z.coerce.number().int().optional(),
        status: payrollRunStatusSchema.optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const opts: {
          companyId: number;
          year?: number;
          status?: 'draft' | 'finalized';
        } = { companyId: q.companyId };
        if (q.year !== undefined) opts.year = q.year;
        if (q.status !== undefined) opts.status = q.status;
        const list = await deps.listPayrollRuns.execute(opts);
        return c.json({ payrollRuns: list });
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/payroll-runs',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        periodYear: z.number().int().min(2000).max(2200),
        periodMonth: z.number().int().min(1).max(12),
        note: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.createPayrollRun.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          periodYear: body.periodYear,
          periodMonth: body.periodMonth,
          ...(body.note !== undefined ? { note: body.note } : {}),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/payroll-runs/:id/run-batch',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: positiveInt })),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('json');
      try {
        const result = await deps.runPayrollBatch.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId,
          payrollRunId: id,
        });
        return c.json(result);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/payroll-runs/:id/finalize',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: positiveInt })),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('json');
      try {
        const dto = await deps.finalizePayrollRun.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId,
          payrollRunId: id,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.get(
    '/payroll-runs/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQuery),
    async (c) => {
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      try {
        const result = await deps.getPayrollRun.execute({
          companyId,
          payrollRunId: id,
        });
        return c.json(result);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // ASSET (Zimmet / Varlık Yönetimi)
  // -------------------------------------------------------------------------
  app.get(
    '/assets',
    zValidator(
      'query',
      companyIdQuery.extend({
        status: assetStatusSchema.optional(),
        assignedEmployeeId: z.coerce.number().int().positive().optional(),
        type: assetTypeSchema.optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const opts: {
          companyId: number;
          status?: 'in_stock' | 'assigned' | 'maintenance' | 'retired' | 'lost';
          assignedEmployeeId?: number;
          type?:
            | 'laptop'
            | 'desktop'
            | 'phone'
            | 'vehicle'
            | 'card'
            | 'monitor'
            | 'headset'
            | 'tablet'
            | 'printer'
            | 'furniture'
            | 'key_lock'
            | 'uniform'
            | 'ppe'
            | 'other';
        } = { companyId: q.companyId };
        if (q.status !== undefined) opts.status = q.status;
        if (q.assignedEmployeeId !== undefined) opts.assignedEmployeeId = q.assignedEmployeeId;
        if (q.type !== undefined) opts.type = q.type;
        const list = await deps.listAssets.execute(opts);
        return c.json({ assets: list });
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/assets',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        assetType: assetTypeSchema,
        name: z.string().min(1).max(200),
        brand: z.string().nullable().optional(),
        model: z.string().nullable().optional(),
        serialNo: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');
      try {
        const dto = await deps.createAsset.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          assetType: body.assetType,
          name: body.name,
          ...(body.brand !== undefined ? { brand: body.brand } : {}),
          ...(body.model !== undefined ? { model: body.model } : {}),
          ...(body.serialNo !== undefined ? { serialNo: body.serialNo } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.patch(
    '/assets/:id',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: positiveInt,
        name: z.string().min(1).max(200).optional(),
        brand: z.string().nullable().optional(),
        model: z.string().nullable().optional(),
        serialNo: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.updateAsset.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          id,
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.brand !== undefined ? { brand: body.brand } : {}),
          ...(body.model !== undefined ? { model: body.model } : {}),
          ...(body.serialNo !== undefined ? { serialNo: body.serialNo } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/assets/:id/assign',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: positiveInt, employeeId: positiveInt })),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.assignAsset.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          assetId: id,
          employeeId: body.employeeId,
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.post(
    '/assets/:id/return',
    requireHrWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({ companyId: positiveInt, returnNote: z.string().nullable().optional() }),
    ),
    async (c) => {
      const auth = c.get('auth');
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const dto = await deps.returnAsset.execute({
          actorUserId: auth.userId,
          actorUsername: auth.username,
          companyId: body.companyId,
          assetId: id,
          ...(body.returnNote !== undefined ? { returnNote: body.returnNote } : {}),
        });
        return c.json(dto);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  app.get(
    '/assets/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQuery),
    async (c) => {
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      try {
        const result = await deps.getAsset.execute({
          companyId,
          assetId: id,
        });
        return c.json(result);
      } catch (err) {
        mapHrError(err);
      }
    },
  );

  return app;
}
