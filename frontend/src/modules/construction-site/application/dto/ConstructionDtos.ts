/**
 * Construction (Şantiye) DTO'ları — backend /v1/construction yanıt tipleri aynası.
 */
export type CurrencyCode = 'TRY' | 'USD' | 'EUR';
export type ProjectType = 'private' | 'public_tender';
export type ProjectStatus = 'planning' | 'active' | 'suspended' | 'completed' | 'closed';
export type ContractParty = 'employer' | 'subcontractor';

export interface ProjectDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  projectType: ProjectType;
  status: ProjectStatus;
  orgUnitId: number | null;
  managerUserId: number | null;
  location: string | null;
  startDate: string | null;
  plannedEnd: string | null;
  budgetAmount: number;
  currency: CurrencyCode;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenderInfoDto {
  ikn: string | null;
  procedure: string | null;
  approxCost: number | null;
  tenderDate: string | null;
  workIncreasePct: number;
  perfBondPct: number;
  notes: string | null;
}

export interface ContractDto {
  id: number;
  companyId: number;
  projectId: number;
  partyKind: ContractParty;
  vendorId: number | null;
  contractNo: string;
  title: string;
  amount: number;
  currency: CurrencyCode;
  signDate: string | null;
  startDate: string | null;
  endDate: string | null;
  retentionPct: number;
  advancePct: number;
  priceDiffOn: boolean;
  tender: TenderInfoDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsResponse {
  projects: ReadonlyArray<ProjectDto>;
}

export interface ContractsResponse {
  contracts: ReadonlyArray<ContractDto>;
}
