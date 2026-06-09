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

export interface PozDto {
  id: number;
  companyId: number;
  pozNo: string;
  name: string;
  unit: string;
  unitPrice: number;
  source: string | null;
  year: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PozResponse {
  poz: ReadonlyArray<PozDto>;
}

export interface BoqLineDto {
  id: number;
  contractId: number;
  groupId: number | null;
  pozId: number | null;
  lineNo: number;
  pozNo: string | null;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  pursantajPct: number;
}

export interface BoqDto {
  contractId: number;
  lines: BoqLineDto[];
  totalAmount: number;
  pursantajTotal: number;
}

export type ProgressKind = 'employer' | 'subcontractor';
export type ProgressType = 'interim' | 'final';
export type ProgressStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid' | 'cancelled';
export type DeductionKind =
  | 'retention'
  | 'advance_offset'
  | 'sgk'
  | 'income_tax'
  | 'stoppage'
  | 'penalty'
  | 'price_diff'
  | 'other';

export interface ProgressLineDto {
  id: number;
  boqLineId: number;
  prevQty: number;
  thisQty: number;
  cumulQty: number;
  unitPrice: number;
  thisAmount: number;
  cumulAmount: number;
}

export interface DeductionDto {
  id: number;
  kind: DeductionKind;
  label: string | null;
  ratePct: number | null;
  amount: number;
  sign: number;
}

export interface ProgressPaymentDto {
  id: number;
  companyId: number;
  contractId: number;
  hakedisNo: string;
  kind: ProgressKind;
  ptype: ProgressType;
  seqNo: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: ProgressStatus;
  grossThis: number;
  grossCumul: number;
  priceDiff: number;
  deductionsTot: number;
  netPayable: number;
  currency: CurrencyCode;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: number | null;
  createdAt: string;
  updatedAt: string;
  lines: ProgressLineDto[];
  deductions: DeductionDto[];
}

export type ProgressSummaryDto = Omit<ProgressPaymentDto, 'lines' | 'deductions'>;

export interface ProgressListResponse {
  progress: ReadonlyArray<ProgressSummaryDto>;
}

export interface ExpenseDto {
  id: number;
  companyId: number;
  projectId: number;
  boqLineId: number | null;
  vendorId: number | null;
  invoiceId: number | null;
  category: string;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  spentAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdvanceDto {
  id: number;
  companyId: number;
  projectId: number;
  vendorId: number | null;
  description: string | null;
  amount: number;
  offsetAmount: number;
  remaining: number;
  currency: CurrencyCode;
  givenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashMovementDto {
  id: number;
  companyId: number;
  projectId: number;
  direction: number;
  accountRef: string | null;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  movedAt: string;
  relatedProgressId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCostSummaryDto {
  projectId: number;
  budgetAmount: number;
  currency: CurrencyCode;
  spentTotal: number;
  variance: number;
  byCategory: Array<{ category: string; amount: number }>;
}

export interface ExpensesResponse {
  expenses: ReadonlyArray<ExpenseDto>;
}
export interface AdvancesResponse {
  advances: ReadonlyArray<AdvanceDto>;
}
export interface CashResponse {
  movements: ReadonlyArray<CashMovementDto>;
}

// ===== Ödeme Listesi =========================================================
export type PaymentStatus = 'planned' | 'paid';
export type PaymentSource = 'manual' | 'hakedis' | 'expense' | 'advance';

/** Manuel ödeme kaydı (cs_payments). */
export interface ManualPaymentDto {
  id: number;
  companyId: number;
  projectId: number | null;
  payee: string | null;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  dueDate: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  method: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Birleşik ödeme listesi satırı (manuel + hakediş + gider + avans). */
export interface PaymentListItemDto {
  source: PaymentSource;
  sourceId: number;
  paymentId: number | null; // manuel ise düzenle/sil için
  projectId: number | null;
  payee: string | null;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  date: string | null;
  dueDate: string | null;
  method: string | null;
}

export interface PaymentListResponse {
  items: ReadonlyArray<PaymentListItemDto>;
}

export type StockMoveKind = 'in' | 'out' | 'transfer' | 'adjust' | 'waste';
export type MaterialRequestStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'fulfilled'
  | 'cancelled';

export interface MaterialDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  unit: string;
  wastePct: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseDto {
  id: number;
  companyId: number;
  projectId: number;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockDto {
  warehouseId: number;
  warehouseName: string;
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  qty: number;
}

export interface StockMovementDto {
  id: number;
  materialId: number;
  kind: StockMoveKind;
  fromWarehouse: number | null;
  toWarehouse: number | null;
  qty: number;
  unitCost: number;
  boqLineId: number | null;
  description: string | null;
  movedAt: string;
  createdAt: string;
}

export interface MaterialRequestLineDto {
  id: number;
  materialId: number;
  qty: number;
  note: string | null;
}

export interface MaterialRequestDto {
  id: number;
  companyId: number;
  projectId: number;
  reqNo: string;
  status: MaterialRequestStatus;
  neededBy: string | null;
  note: string | null;
  approvedBy: number | null;
  createdAt: string;
  updatedAt: string;
  lines: MaterialRequestLineDto[];
}

export type MaterialRequestSummaryDto = Omit<MaterialRequestDto, 'lines'>;

export interface MaterialsResponse {
  materials: ReadonlyArray<MaterialDto>;
}
export interface WarehousesResponse {
  warehouses: ReadonlyArray<WarehouseDto>;
}
export interface StockResponse {
  stock: ReadonlyArray<StockDto>;
}
export interface MovementsResponse {
  movements: ReadonlyArray<StockMovementDto>;
}
export interface MaterialRequestsResponse {
  requests: ReadonlyArray<MaterialRequestSummaryDto>;
}

export type MachineKind = 'owned' | 'rented' | 'subcontractor';

export interface PersonnelDto {
  id: number;
  companyId: number;
  projectId: number;
  employeeId: number | null;
  vendorId: number | null;
  fullName: string;
  trade: string | null;
  dailyCost: number;
  isSubcontractor: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetDto {
  id: number;
  personnelId: number;
  workDate: string;
  hours: number;
  overtime: number;
  statusCode: string;
  boqLineId: number | null;
}

export interface MachineDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  kind: MachineKind;
  vendorId: number | null;
  hourlyCost: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MachineLogDto {
  id: number;
  machineId: number;
  projectId: number;
  logDate: string;
  workHours: number;
  fuelLiters: number;
  fuelCost: number;
  maintCost: number;
  boqLineId: number | null;
  note: string | null;
}

export interface LaborCostSummaryDto {
  projectId: number;
  laborCost: number;
  machineWorkCost: number;
  fuelCost: number;
  maintCost: number;
  total: number;
}

export interface PersonnelResponse {
  personnel: ReadonlyArray<PersonnelDto>;
}
export interface TimesheetsResponse {
  timesheets: ReadonlyArray<TimesheetDto>;
}
export interface MachinesResponse {
  machines: ReadonlyArray<MachineDto>;
}
export interface MachineLogsResponse {
  logs: ReadonlyArray<MachineLogDto>;
}

export interface ProjectDashboardDto {
  projectId: number;
  projectName: string;
  currency: string;
  employerContractTotal: number;
  subcontractorContractTotal: number;
  boqTotal: number;
  progressGrossCumul: number;
  progressNetPaid: number;
  expenseTotal: number;
  laborTotal: number;
  costTotal: number;
  physicalPct: number;
  estimatedProfit: number;
}

export interface ProgressCurvePointDto {
  seqNo: number;
  periodEnd: string | null;
  status: string;
  grossCumul: number;
  cumulPct: number;
}

export interface ProgressCurveDto {
  contractId: number;
  contractNo: string;
  contractAmount: number;
  currency: string;
  points: ProgressCurvePointDto[];
}
