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
export type CandidateSource =
  | 'referral'
  | 'linkedin'
  | 'jobboard'
  | 'direct'
  | 'agency'
  | 'other';
export type RecruitmentStage =
  | 'new'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn';

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
