/**
 * HrApi — backend ile konuşan port.
 *
 * Concrete impl: infrastructure/api/HrApiClient.ts (fetch wrapper).
 * Test'te mock'lanabilir.
 *
 * Tüm metodlar `companyId` parametresi alır (multi-tenant). Yazma işlemleri
 * backend'de `hr_manager` rolü ister; bu UI tarafında zorlanmaz, hata
 * dönerse kullanıcıya gösterilir.
 */
import type {
  ApplicationDto,
  ApplicationsResponse,
  AssetDto,
  AssetsResponse,
  AssetStatus,
  AssetType,
  AssetWithAssignments,
  CandidateDto,
  CandidatesResponse,
  CandidateSource,
  DepartmentDto,
  EmployeeDto,
  EmployeesResponse,
  EmployeeStatus,
  EmploymentType,
  LeaveBalanceDto,
  LeaveRequestDto,
  LeaveRequestsResponse,
  LeaveStatus,
  LeaveType,
  OrgTreeResponse,
  OrgUnitDto,
  PayrollRunDto,
  PayrollRunsResponse,
  PayrollRunStatus,
  PayrollRunWithItems,
  PositionDto,
  PositionsResponse,
  PositionStatus,
  RecruitmentFunnelDto,
  RecruitmentStage,
} from '../dto/HrDtos';

// ---------------------------------------------------------------------------
// Input tipleri
// ---------------------------------------------------------------------------

export interface CreateOrgUnitBody {
  companyId: number;
  parentId: number | null;
  name: string;
  code?: string | null;
  sortOrder?: number;
}

export interface UpdateOrgUnitBody {
  companyId: number;
  name?: string;
  code?: string | null;
  sortOrder?: number;
}

export interface MoveOrgUnitBody {
  companyId: number;
  newParentId: number | null;
}

export interface CreateDepartmentBody {
  companyId: number;
  orgUnitId: number | null;
  name: string;
  code?: string | null;
}

export interface UpdateDepartmentBody {
  companyId: number;
  name?: string;
  code?: string | null;
  orgUnitId?: number | null;
}

export interface AssignManagerBody {
  companyId: number;
  employeeId: number | null;
}

export interface CreatePositionBody {
  companyId: number;
  departmentId: number | null;
  title: string;
  description?: string | null;
  status?: PositionStatus;
  headcountTarget?: number;
  minSalary?: number | null;
  maxSalary?: number | null;
}

export interface UpdatePositionBody {
  companyId: number;
  title?: string;
  description?: string | null;
  headcountTarget?: number;
  minSalary?: number | null;
  maxSalary?: number | null;
  departmentId?: number | null;
  status?: PositionStatus;
}

export interface HireEmployeeBody {
  companyId: number;
  departmentId: number;
  positionId: number | null;
  employeeNo?: string;
  firstName: string;
  lastName: string;
  tcKimlik?: string | null;
  email?: string | null;
  phone?: string | null;
  hireDate: string;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  userId?: number | null;
}

export interface UpdateEmployeeBody {
  companyId: number;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  tcKimlik?: string | null;
  employmentType?: EmploymentType;
}

export interface TransferEmployeeBody {
  companyId: number;
  newDepartmentId: number;
  newPositionId: number | null;
}

export interface TerminateEmployeeBody {
  companyId: number;
  terminationDate?: string;
  reason?: string;
}

export interface LinkUserBody {
  companyId: number;
  userId: number;
}

export interface RegisterCandidateBody {
  companyId: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  source?: CandidateSource;
  cvUrl?: string | null;
  notes?: string | null;
}

export interface SubmitApplicationBody {
  companyId: number;
  candidateId: number;
  positionId: number;
  salaryExpectation?: number | null;
  notes?: string | null;
}

export interface MoveApplicationStageBody {
  companyId: number;
  newStage: RecruitmentStage;
  rejectionReason?: string | null;
}

export interface HireFromApplicationBody {
  companyId: number;
  departmentId: number;
  employeeNo?: string;
  hireDate: string;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  tcKimlik?: string | null;
  userId?: number | null;
}

export interface RequestLeaveBody {
  companyId: number;
  employeeId: number;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string | null;
}

export interface CreatePayrollRunBody {
  companyId: number;
  periodYear: number;
  periodMonth: number;
  note?: string | null;
}

export interface CreateAssetBody {
  companyId: number;
  assetType: AssetType;
  name: string;
  brand?: string | null;
  model?: string | null;
  serialNo?: string | null;
  notes?: string | null;
}

export interface UpdateAssetBody {
  companyId: number;
  name?: string;
  brand?: string | null;
  model?: string | null;
  serialNo?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

export interface HrApi {
  // OrgUnit
  getOrgTree(companyId: number, options?: { includeInactive?: boolean }): Promise<OrgTreeResponse>;
  createOrgUnit(body: CreateOrgUnitBody): Promise<OrgUnitDto>;
  updateOrgUnit(id: number, body: UpdateOrgUnitBody): Promise<OrgUnitDto>;
  moveOrgUnit(id: number, body: MoveOrgUnitBody): Promise<OrgUnitDto>;
  archiveOrgUnit(id: number, companyId: number): Promise<OrgUnitDto>;

  // Department
  createDepartment(body: CreateDepartmentBody): Promise<DepartmentDto>;
  updateDepartment(id: number, body: UpdateDepartmentBody): Promise<DepartmentDto>;
  archiveDepartment(id: number, companyId: number): Promise<DepartmentDto>;
  assignDepartmentManager(id: number, body: AssignManagerBody): Promise<DepartmentDto>;

  // Position
  listPositions(
    companyId: number,
    options?: { status?: PositionStatus; departmentId?: number | null },
  ): Promise<PositionsResponse>;
  createPosition(body: CreatePositionBody): Promise<PositionDto>;
  updatePosition(id: number, body: UpdatePositionBody): Promise<PositionDto>;
  closePosition(id: number, companyId: number): Promise<PositionDto>;

  // Employee
  listEmployees(
    companyId: number,
    options?: {
      status?: EmployeeStatus;
      departmentId?: number;
      positionId?: number;
      q?: string;
    },
  ): Promise<EmployeesResponse>;
  hireEmployee(body: HireEmployeeBody): Promise<EmployeeDto>;
  updateEmployee(id: number, body: UpdateEmployeeBody): Promise<EmployeeDto>;
  transferEmployee(id: number, body: TransferEmployeeBody): Promise<EmployeeDto>;
  terminateEmployee(id: number, body: TerminateEmployeeBody): Promise<EmployeeDto>;
  linkEmployeeToUser(id: number, body: LinkUserBody): Promise<EmployeeDto>;
  unlinkEmployeeFromUser(id: number, companyId: number): Promise<EmployeeDto>;

  // Candidate
  listCandidates(
    companyId: number,
    options?: { source?: CandidateSource; q?: string },
  ): Promise<CandidatesResponse>;
  registerCandidate(body: RegisterCandidateBody): Promise<CandidateDto>;
  deleteCandidate(id: number, companyId: number): Promise<void>;

  // Application
  listApplications(
    companyId: number,
    options?: { positionId?: number; candidateId?: number; stage?: RecruitmentStage },
  ): Promise<ApplicationsResponse>;
  getRecruitmentFunnel(companyId: number, positionId?: number): Promise<RecruitmentFunnelDto>;
  submitApplication(body: SubmitApplicationBody): Promise<ApplicationDto>;
  moveApplicationStage(id: number, body: MoveApplicationStageBody): Promise<ApplicationDto>;
  rejectApplication(id: number, companyId: number, reason: string): Promise<ApplicationDto>;
  withdrawApplication(id: number, companyId: number, note?: string): Promise<ApplicationDto>;
  hireFromApplication(id: number, body: HireFromApplicationBody): Promise<EmployeeDto>;

  // Leave
  listLeaveRequests(
    companyId: number,
    options?: { employeeId?: number; status?: LeaveStatus },
  ): Promise<LeaveRequestsResponse>;
  requestLeave(body: RequestLeaveBody): Promise<LeaveRequestDto>;
  approveLeave(id: number, companyId: number, note?: string | null): Promise<LeaveRequestDto>;
  rejectLeave(id: number, companyId: number, note?: string | null): Promise<LeaveRequestDto>;
  cancelLeave(id: number, companyId: number, note?: string | null): Promise<LeaveRequestDto>;
  getLeaveBalance(companyId: number, employeeId: number): Promise<LeaveBalanceDto>;

  // Payroll
  listPayrollRuns(
    companyId: number,
    options?: { year?: number; status?: PayrollRunStatus },
  ): Promise<PayrollRunsResponse>;
  createPayrollRun(body: CreatePayrollRunBody): Promise<PayrollRunDto>;
  runPayrollBatch(id: number, companyId: number): Promise<PayrollRunWithItems>;
  finalizePayrollRun(id: number, companyId: number): Promise<PayrollRunDto>;
  getPayrollRun(id: number, companyId: number): Promise<PayrollRunWithItems>;

  // Asset (Zimmet / Varlık Yönetimi)
  listAssets(
    companyId: number,
    options?: { status?: AssetStatus; assignedEmployeeId?: number; type?: AssetType },
  ): Promise<AssetsResponse>;
  createAsset(body: CreateAssetBody): Promise<AssetDto>;
  updateAsset(id: number, body: UpdateAssetBody): Promise<AssetDto>;
  assignAsset(id: number, companyId: number, employeeId: number): Promise<AssetDto>;
  returnAsset(id: number, companyId: number, returnNote?: string | null): Promise<AssetDto>;
  getAsset(id: number, companyId: number): Promise<AssetWithAssignments>;
}
