/**
 * HR DTO tipleri — backend (api-server/src/modules/hr/application/dto)
 * ile birebir uyumlu.
 *
 * Bu modül backend'den hiç import etmez (frontend ↔ api-server arası
 * deploy bağımsız); yine de tipler senkron tutulmalı.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type PositionStatus = 'draft' | 'open' | 'closed';
export type EmployeeStatus = 'probation' | 'active' | 'on_leave' | 'terminated';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type CandidateSource = 'referral' | 'linkedin' | 'jobboard' | 'direct' | 'agency' | 'other';
export type RecruitmentStage =
  | 'new'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn';
export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'maternity' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type PayrollRunStatus = 'draft' | 'finalized';
export type AssetType =
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
export type AssetStatus = 'in_stock' | 'assigned' | 'maintenance' | 'retired' | 'lost';

// ---------------------------------------------------------------------------
// Entity DTO'ları
// ---------------------------------------------------------------------------
export interface OrgUnitDto {
  id: number;
  companyId: number;
  parentId: number | null;
  name: string;
  code: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrgTreeNodeDto {
  unit: OrgUnitDto;
  children: ReadonlyArray<OrgTreeNodeDto>;
}

export interface DepartmentDto {
  id: number;
  companyId: number;
  orgUnitId: number | null;
  name: string;
  code: string | null;
  managerEmployeeId: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PositionDto {
  id: number;
  companyId: number;
  departmentId: number | null;
  title: string;
  description: string | null;
  status: PositionStatus;
  headcountTarget: number;
  minSalary: number | null;
  maxSalary: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeDto {
  id: number;
  companyId: number;
  userId: number | null;
  departmentId: number;
  positionId: number | null;
  employeeNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  tcKimlik: string | null;
  email: string | null;
  phone: string | null;
  hireDate: string;
  terminationDate: string | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  sourceApplicationId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateDto {
  id: number;
  companyId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: CandidateSource;
  cvUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDto {
  id: number;
  companyId: number;
  candidateId: number;
  positionId: number;
  stage: RecruitmentStage;
  stageChangedAt: string;
  stageChangedBy: number | null;
  rejectionReason: string | null;
  salaryExpectation: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentFunnelDto {
  positionId: number | null;
  counts: Partial<Record<RecruitmentStage, number>>;
}

export interface LeaveRequestDto {
  id: number;
  companyId: number;
  employeeId: number;
  leaveType: LeaveType;
  /** YYYY-MM-DD. */
  startDate: string;
  /** YYYY-MM-DD. */
  endDate: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  requestedByUserId: number | null;
  decidedByUserId: number | null;
  /** ISO timestamp veya null. */
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalanceDto {
  employeeId: number;
  year: number;
  entitlement: number;
  used: number;
  remaining: number;
}

export interface PayrollRunDto {
  id: number;
  companyId: number;
  periodYear: number;
  periodMonth: number;
  status: PayrollRunStatus;
  note: string | null;
  /** ISO timestamp veya null. */
  finalizedAt: string | null;
  finalizedByUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollItemDto {
  id: number;
  companyId: number;
  runId: number;
  employeeId: number;
  grossSalary: number;
  sgkEmployee: number;
  unemployment: number;
  incomeTax: number;
  stampTax: number;
  otherDeductions: number;
  netSalary: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDto {
  id: number;
  companyId: number;
  assetType: AssetType;
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  status: AssetStatus;
  assignedEmployeeId: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetAssignmentDto {
  id: number;
  companyId: number;
  assetId: number;
  employeeId: number;
  /** ISO timestamp. */
  assignedAt: string;
  assignedByUserId: number | null;
  /** ISO timestamp veya null (açık atama). */
  returnedAt: string | null;
  returnedByUserId: number | null;
  returnNote: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Liste response zarfları (Hono { items } pattern'i)
// ---------------------------------------------------------------------------
export interface OrgTreeResponse {
  tree: ReadonlyArray<OrgTreeNodeDto>;
}

export interface EmployeesResponse {
  employees: ReadonlyArray<EmployeeDto>;
}

export interface PositionsResponse {
  positions: ReadonlyArray<PositionDto>;
}

export interface CandidatesResponse {
  candidates: ReadonlyArray<CandidateDto>;
}

export interface ApplicationsResponse {
  applications: ReadonlyArray<ApplicationDto>;
}

export interface LeaveRequestsResponse {
  leaveRequests: ReadonlyArray<LeaveRequestDto>;
}

export interface PayrollRunsResponse {
  payrollRuns: ReadonlyArray<PayrollRunDto>;
}

/** Bir koşu + satırları (bordro fişi verisi). */
export interface PayrollRunWithItems {
  run: PayrollRunDto;
  items: ReadonlyArray<PayrollItemDto>;
}

export interface AssetsResponse {
  assets: ReadonlyArray<AssetDto>;
}

/** Bir varlık + atama geçmişi (ledger). */
export interface AssetWithAssignments {
  asset: AssetDto;
  assignments: ReadonlyArray<AssetAssignmentDto>;
}
