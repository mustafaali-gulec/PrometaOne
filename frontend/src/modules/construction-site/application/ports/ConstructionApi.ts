/**
 * ConstructionApi — Şantiye modülü backend sözleşmesi (port).
 * Concrete: infrastructure/api/ConstructionApiClient.ts
 */
import type {
  ContractDto,
  ContractParty,
  ContractsResponse,
  CurrencyCode,
  ProjectDto,
  ProjectStatus,
  ProjectType,
  ProjectsResponse,
} from '../dto/ConstructionDtos';

export interface CreateProjectBody {
  companyId: number;
  name: string;
  code?: string;
  projectType?: ProjectType;
  orgUnitId?: number | null;
  managerUserId?: number | null;
  location?: string | null;
  startDate?: string | null;
  plannedEnd?: string | null;
  budgetAmount?: number;
  currency?: CurrencyCode;
}

export interface UpdateProjectBody {
  companyId: number;
  name?: string;
  projectType?: ProjectType;
  location?: string | null;
  startDate?: string | null;
  plannedEnd?: string | null;
  budgetAmount?: number;
  currency?: CurrencyCode;
}

export interface ChangeProjectStatusBody {
  companyId: number;
  status: ProjectStatus;
}

export interface TenderInfoBody {
  ikn?: string | null;
  procedure?: string | null;
  approxCost?: number | null;
  tenderDate?: string | null;
  workIncreasePct?: number;
  perfBondPct?: number;
  notes?: string | null;
}

export interface CreateContractBody {
  companyId: number;
  projectId: number;
  partyKind: ContractParty;
  vendorId?: number | null;
  contractNo?: string;
  title: string;
  amount?: number;
  currency?: CurrencyCode;
  signDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  retentionPct?: number;
  advancePct?: number;
  priceDiffOn?: boolean;
  tender?: TenderInfoBody | null;
}

export interface UpdateContractBody {
  companyId: number;
  title?: string;
  vendorId?: number | null;
  amount?: number;
  currency?: CurrencyCode;
  signDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  retentionPct?: number;
  advancePct?: number;
  priceDiffOn?: boolean;
  tender?: TenderInfoBody | null;
}

export interface ConstructionApi {
  // Projects
  listProjects(
    companyId: number,
    options?: {
      includeInactive?: boolean;
      status?: ProjectStatus;
      projectType?: ProjectType;
      search?: string;
    },
  ): Promise<ProjectsResponse>;
  createProject(body: CreateProjectBody): Promise<ProjectDto>;
  updateProject(id: number, body: UpdateProjectBody): Promise<ProjectDto>;
  changeProjectStatus(id: number, body: ChangeProjectStatusBody): Promise<ProjectDto>;
  deactivateProject(id: number, companyId: number): Promise<ProjectDto>;

  // Contracts
  listContracts(
    companyId: number,
    options?: { projectId?: number; partyKind?: ContractParty; search?: string },
  ): Promise<ContractsResponse>;
  createContract(body: CreateContractBody): Promise<ContractDto>;
  updateContract(id: number, body: UpdateContractBody): Promise<ContractDto>;
}
