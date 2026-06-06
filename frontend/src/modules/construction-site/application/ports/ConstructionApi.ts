/**
 * ConstructionApi — Şantiye modülü backend sözleşmesi (port).
 * Concrete: infrastructure/api/ConstructionApiClient.ts
 */
import type {
  AdvanceDto,
  AdvancesResponse,
  BoqDto,
  CashMovementDto,
  CashResponse,
  ContractDto,
  ContractParty,
  ContractsResponse,
  CurrencyCode,
  DeductionKind,
  ExpenseDto,
  ExpensesResponse,
  MaterialDto,
  MaterialRequestDto,
  MaterialRequestStatus,
  MaterialRequestsResponse,
  MaterialsResponse,
  MovementsResponse,
  PozDto,
  PozResponse,
  ProgressKind,
  ProgressListResponse,
  ProgressPaymentDto,
  ProgressStatus,
  ProgressType,
  ProjectCostSummaryDto,
  ProjectDto,
  ProjectStatus,
  ProjectType,
  ProjectsResponse,
  StockMoveKind,
  StockMovementDto,
  StockResponse,
  WarehouseDto,
  WarehousesResponse,
  LaborCostSummaryDto,
  MachineDto,
  MachineKind,
  MachineLogDto,
  MachineLogsResponse,
  MachinesResponse,
  PersonnelDto,
  PersonnelResponse,
  ProgressCurveDto,
  ProjectDashboardDto,
  TimesheetDto,
  TimesheetsResponse,
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

export interface CreatePozBody {
  companyId: number;
  pozNo: string;
  name: string;
  unit: string;
  unitPrice?: number;
  source?: string | null;
  year?: number | null;
}

export interface UpdatePozBody {
  companyId: number;
  name?: string;
  unit?: string;
  unitPrice?: number;
  source?: string | null;
  year?: number | null;
}

export interface BoqLineBody {
  groupId?: number | null;
  pozId?: number | null;
  pozNo?: string | null;
  description: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
}

export interface SaveBoqBody {
  companyId: number;
  lines: ReadonlyArray<BoqLineBody>;
}

export interface CreateProgressBody {
  companyId: number;
  contractId: number;
  kind: ProgressKind;
  ptype?: ProgressType;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface SaveProgressLinesBody {
  companyId: number;
  quantities: ReadonlyArray<{ boqLineId: number; thisQty: number }>;
}

export interface DeductionBody {
  kind: DeductionKind;
  label?: string | null;
  ratePct?: number | null;
  amount: number;
  sign?: number;
}

export interface SaveDeductionsBody {
  companyId: number;
  priceDiff?: number;
  deductions: ReadonlyArray<DeductionBody>;
}

export interface ChangeProgressStatusBody {
  companyId: number;
  status: ProgressStatus;
  note?: string | null;
}

export interface CreateExpenseBody {
  companyId: number;
  projectId: number;
  boqLineId?: number | null;
  vendorId?: number | null;
  invoiceId?: number | null;
  category?: string;
  description?: string | null;
  amount: number;
  currency?: CurrencyCode;
  spentAt: string;
}
export interface UpdateExpenseBody {
  companyId: number;
  boqLineId?: number | null;
  category?: string;
  description?: string | null;
  amount?: number;
  currency?: CurrencyCode;
  spentAt?: string;
}
export interface CreateAdvanceBody {
  companyId: number;
  projectId: number;
  vendorId?: number | null;
  description?: string | null;
  amount: number;
  offsetAmount?: number;
  currency?: CurrencyCode;
  givenAt: string;
}
export interface CreateCashBody {
  companyId: number;
  projectId: number;
  direction: 1 | -1;
  accountRef?: string | null;
  description?: string | null;
  amount: number;
  currency?: CurrencyCode;
  movedAt: string;
  relatedProgressId?: number | null;
}

export interface CreateMaterialBody {
  companyId: number;
  code: string;
  name: string;
  unit?: string;
  wastePct?: number;
}
export interface UpdateMaterialBody {
  companyId: number;
  name?: string;
  unit?: string;
  wastePct?: number;
}
export interface CreateWarehouseBody {
  companyId: number;
  projectId: number;
  code: string;
  name: string;
}
export interface RecordMovementBody {
  companyId: number;
  materialId: number;
  kind: StockMoveKind;
  fromWarehouse?: number | null;
  toWarehouse?: number | null;
  qty: number;
  unitCost?: number;
  boqLineId?: number | null;
  description?: string | null;
  movedAt: string;
}
export interface CreateMaterialRequestBody {
  companyId: number;
  projectId: number;
  neededBy?: string | null;
  note?: string | null;
  lines: ReadonlyArray<{ materialId: number; qty: number; note?: string | null }>;
}

export interface CreatePersonnelBody {
  companyId: number;
  projectId: number;
  fullName: string;
  trade?: string | null;
  dailyCost?: number;
  vendorId?: number | null;
  isSubcontractor?: boolean;
}
export interface SaveTimesheetBody {
  companyId: number;
  personnelId: number;
  workDate: string;
  hours?: number;
  overtime?: number;
  statusCode?: string;
  boqLineId?: number | null;
}
export interface CreateMachineBody {
  companyId: number;
  code: string;
  name: string;
  kind?: MachineKind;
  vendorId?: number | null;
  hourlyCost?: number;
}
export interface CreateMachineLogBody {
  companyId: number;
  machineId: number;
  projectId: number;
  logDate: string;
  workHours?: number;
  fuelLiters?: number;
  fuelCost?: number;
  maintCost?: number;
  boqLineId?: number | null;
  note?: string | null;
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

  // Poz catalog
  listPoz(
    companyId: number,
    options?: { includeInactive?: boolean; search?: string },
  ): Promise<PozResponse>;
  createPoz(body: CreatePozBody): Promise<PozDto>;
  updatePoz(id: number, body: UpdatePozBody): Promise<PozDto>;
  deactivatePoz(id: number, companyId: number): Promise<PozDto>;

  // Keşif (BoQ)
  getBoq(contractId: number, companyId: number): Promise<BoqDto>;
  saveBoq(contractId: number, body: SaveBoqBody): Promise<BoqDto>;

  // Hakediş
  listProgress(
    companyId: number,
    contractId: number,
    kind?: ProgressKind,
  ): Promise<ProgressListResponse>;
  getProgress(id: number, companyId: number): Promise<ProgressPaymentDto>;
  createProgress(body: CreateProgressBody): Promise<ProgressPaymentDto>;
  saveProgressLines(id: number, body: SaveProgressLinesBody): Promise<ProgressPaymentDto>;
  saveDeductions(id: number, body: SaveDeductionsBody): Promise<ProgressPaymentDto>;
  changeProgressStatus(id: number, body: ChangeProgressStatusBody): Promise<ProgressPaymentDto>;

  // Harcama & Finans
  listExpenses(companyId: number, projectId: number): Promise<ExpensesResponse>;
  createExpense(body: CreateExpenseBody): Promise<ExpenseDto>;
  updateExpense(id: number, body: UpdateExpenseBody): Promise<ExpenseDto>;
  deleteExpense(id: number, companyId: number): Promise<void>;
  getCostSummary(projectId: number, companyId: number): Promise<ProjectCostSummaryDto>;
  listAdvances(companyId: number, projectId: number): Promise<AdvancesResponse>;
  createAdvance(body: CreateAdvanceBody): Promise<AdvanceDto>;
  deleteAdvance(id: number, companyId: number): Promise<void>;
  listCash(companyId: number, projectId: number): Promise<CashResponse>;
  createCash(body: CreateCashBody): Promise<CashMovementDto>;
  deleteCash(id: number, companyId: number): Promise<void>;

  // Malzeme & Depo
  listMaterials(companyId: number, includeInactive?: boolean): Promise<MaterialsResponse>;
  createMaterial(body: CreateMaterialBody): Promise<MaterialDto>;
  updateMaterial(id: number, body: UpdateMaterialBody): Promise<MaterialDto>;
  deactivateMaterial(id: number, companyId: number): Promise<MaterialDto>;
  listWarehouses(companyId: number, projectId: number): Promise<WarehousesResponse>;
  createWarehouse(body: CreateWarehouseBody): Promise<WarehouseDto>;
  listStock(companyId: number, projectId: number): Promise<StockResponse>;
  listMovements(companyId: number, projectId: number): Promise<MovementsResponse>;
  recordMovement(body: RecordMovementBody): Promise<StockMovementDto>;
  listMaterialRequests(companyId: number, projectId: number): Promise<MaterialRequestsResponse>;
  getMaterialRequest(id: number, companyId: number): Promise<MaterialRequestDto>;
  createMaterialRequest(body: CreateMaterialRequestBody): Promise<MaterialRequestDto>;
  changeMaterialRequestStatus(
    id: number,
    body: { companyId: number; status: MaterialRequestStatus },
  ): Promise<MaterialRequestDto>;

  // İş Gücü & Makine
  listPersonnel(companyId: number, projectId: number): Promise<PersonnelResponse>;
  createPersonnel(body: CreatePersonnelBody): Promise<PersonnelDto>;
  deactivatePersonnel(id: number, companyId: number): Promise<PersonnelDto>;
  listTimesheets(companyId: number, projectId: number): Promise<TimesheetsResponse>;
  saveTimesheet(body: SaveTimesheetBody): Promise<TimesheetDto>;
  listMachines(companyId: number, includeInactive?: boolean): Promise<MachinesResponse>;
  createMachine(body: CreateMachineBody): Promise<MachineDto>;
  listMachineLogs(companyId: number, projectId: number): Promise<MachineLogsResponse>;
  createMachineLog(body: CreateMachineLogBody): Promise<MachineLogDto>;
  getLaborCostSummary(projectId: number, companyId: number): Promise<LaborCostSummaryDto>;

  // Raporlar
  getProjectDashboard(projectId: number, companyId: number): Promise<ProjectDashboardDto>;
  getProgressCurve(contractId: number, companyId: number): Promise<ProgressCurveDto>;
}
