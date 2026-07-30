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

// --- Yeşil Defter (metraj) + Ataşman — SF-8 --------------------------------
export interface MeasurementDto {
  id: number;
  companyId: number;
  contractId: number;
  boqLineId: number;
  progressId: number | null;
  measuredQty: number;
  measuredAt: string | null;
  note: string | null;
  createdAt: string;
}
export interface AttachmentDto {
  id: number;
  companyId: number;
  measurementId: number;
  boqLineId: number | null;
  formula: string | null;
  dimA: number | null;
  dimB: number | null;
  dimC: number | null;
  countN: number | null;
  resultQty: number;
  fileUrl: string | null;
  createdAt: string;
}
export interface MeasurementSummaryLineDto {
  boqLineId: number;
  totalMeasured: number;
}
export interface MeasurementsResponse {
  measurements: ReadonlyArray<MeasurementDto>;
}
export interface AttachmentsResponse {
  attachments: ReadonlyArray<AttachmentDto>;
}
export interface MeasurementSummaryResponse {
  lines: ReadonlyArray<MeasurementSummaryLineDto>;
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

// ============================================================================
// FAZ 1 — MEKÂN KIRILIMI (cs_locations)
// ============================================================================

export type LocationKind = 'site' | 'block' | 'floor' | 'unit' | 'zone';

export interface LocationDto {
  id: number;
  companyId: number;
  projectId: number;
  parentId: number | null;
  kind: LocationKind;
  code: string;
  name: string;
  sortOrder: number;
  /** Backend trigger'ı türetir: "A Blok > 2 > Daire 18" */
  path: string;
  depth: number;
  unitType: string | null;
  grossArea: number | null;
  netArea: number | null;
  landShare: number | null;
  facade: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Bu düğümün altına eklenebilecek tipler — "Ekle" menüsü buna göre kurulur. */
  allowedChildKinds: LocationKind[];
}

export interface LocationTreeNodeDto extends LocationDto {
  children: LocationTreeNodeDto[];
  unitCount: number;
  netAreaTotal: number | null;
}

export interface LocationTreeResponse {
  tree: LocationTreeNodeDto[];
}

export interface LocationListResponse {
  locations: LocationDto[];
}

export interface LocationUsageDto {
  usage: {
    boqLines: number;
    expenses: number;
    timesheets: number;
    machineLogs: number;
    stockMovements: number;
    measurements: number;
    materialRequests: number;
    attachments: number;
    trackingLocations: number;
    children: number;
  };
  canHardDelete: boolean;
  blockers: string[];
}

export interface DeleteLocationResultDto {
  deleted: boolean;
  location: LocationDto;
}

export interface BulkGenerateResultDto {
  created: LocationDto[];
  createdCount: number;
}

// ============================================================================
// FAZ 2 — FİZİKSEL İLERLEME TAKİBİ
// ============================================================================

export type TrackScope = 'general' | 'block' | 'floor' | 'unit';
export type TrackingStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type ItemState = 'not_started' | 'in_progress' | 'has_defects' | 'completed';

export interface TemplateItemDto {
  id: number;
  code: string;
  name: string;
  weightPct: number;
  sortOrder: number;
  pozId: number | null;
}

export interface TemplateGroupDto {
  id: number;
  code: string;
  name: string;
  weightPct: number;
  sortOrder: number;
  items: TemplateItemDto[];
}

export interface WeightIssueDto {
  level: 'template' | 'group';
  groupId?: number;
  groupName?: string;
  sum: number;
}

export interface ProgressTemplateDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  scope: TrackScope;
  description: string | null;
  pctInProgress: number;
  pctHasDefects: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  groups: TemplateGroupDto[];
  itemCount: number;
  /** Boş değilse ağırlıklar %100'e tümlenmiyor. */
  weightIssues: WeightIssueDto[];
  scopeLocationKinds: string[];
}

export interface ProgressTemplatesResponse {
  templates: ProgressTemplateDto[];
}

export interface SaveTemplateBodyResultDto {
  template: ProgressTemplateDto;
  affectedTrackings: number;
}

export interface TrackingDto {
  id: number;
  companyId: number;
  projectId: number;
  templateId: number;
  code: string;
  name: string;
  projectWeightPct: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  status: TrackingStatus;
  assignedUserId: number | null;
  visibleAll: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingListRowDto extends TrackingDto {
  progressPct: number;
  locationCount: number;
  /** Plan tarihi yoksa null — 0 varsayılmaz. */
  plannedPct: number | null;
  deviationPct: number | null;
}

export interface TrackingsResponse {
  trackings: TrackingListRowDto[];
}

export interface TrackingBoardItemDto {
  trackingItemId: number;
  templateItemId: number;
  itemName: string;
  itemWeight: number;
  state: ItemState;
  overridePct: number | null;
  effectivePct: number;
  inspectedBy: number | null;
  inspectedAt: string | null;
  note: string | null;
  pozId: number | null;
}

export interface TrackingBoardGroupDto {
  groupId: number;
  groupName: string;
  groupWeight: number;
  /** Grup İÇİ ağırlıklara göre normalize edilmiş ilerleme (0-100). */
  progressPct: number;
  items: TrackingBoardItemDto[];
}

export interface TrackingLocationBoardDto {
  trackingLocationId: number;
  locationId: number;
  locationName: string;
  locationPath: string;
  weightPct: number;
  progressPct: number;
  itemCount: number;
  completedCount: number;
  defectCount: number;
  inProgressCount: number;
  groups: TrackingBoardGroupDto[];
}

export interface TrackingBoardDto {
  tracking: TrackingDto;
  templateName: string;
  pctInProgress: number;
  pctHasDefects: number;
  progressPct: number;
  plannedPct: number | null;
  deviationPct: number | null;
  locations: TrackingLocationBoardDto[];
}

/** Saha durumu yazma yanıtı — güncel lokasyon ilerlemeleri (grup/iş ağacı YOK). */
export interface TrackingLocationProgressDto {
  trackingLocationId: number;
  locationId: number;
  locationPath: string;
  locationName: string;
  weightPct: number;
  progressPct: number;
  itemCount: number;
  completedCount: number;
  defectCount: number;
  inProgressCount: number;
}

export interface TrackingLocationsResponse {
  locations: TrackingLocationProgressDto[];
}

export interface TrackingItemHistoryRowDto {
  id: number;
  trackingItemId: number;
  fromState: ItemState | null;
  toState: ItemState;
  fromPct: number | null;
  toPct: number;
  changedBy: number | null;
  changedAt: string;
  note: string | null;
}

export interface TrackingItemHistoryResponse {
  history: TrackingItemHistoryRowDto[];
}

export interface ProjectPhysicalProgressDto {
  projectId: number;
  progressPct: number;
  /** Takip ağırlıklarının toplamı; <100 ise ölçülmeyen iş payı var. */
  weightSum: number;
  trackingCount: number;
  unmeasuredWeight: number;
  trackings: TrackingListRowDto[];
}

// ============================================================================
// FAZ 3 — ŞANTİYE GÜNLÜĞÜ (cs_daily_logs)
// ============================================================================

export type DailyLogStatus = 'open' | 'locked';
export type WorkState = 'working' | 'not_working' | 'partial';
export type LogEntryKind =
  | 'subcontractor'
  | 'personnel'
  | 'equipment'
  | 'note'
  | 'delivery'
  | 'accident'
  | 'material_used'
  | 'production'
  | 'fuel'
  | 'maintenance'
  | 'visitor';
export type AccidentSeverity = 'near_miss' | 'first_aid' | 'medical' | 'lost_time' | 'fatal';

export interface DailyLogDto {
  id: number;
  companyId: number;
  projectId: number;
  logDate: string;
  status: DailyLogStatus;
  workState: WorkState;
  tempC: number | null;
  weatherNote: string | null;
  noWorkReason: string | null;
  summary: string | null;
  lockedBy: number | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Satır eklenip değiştirilebilir mi? (status === 'open') */
  editable: boolean;
}

export interface DailyLogEntryDto {
  id: number;
  logId: number;
  kind: LogEntryKind;
  locationId: number | null;
  vendorId: number | null;
  personnelId: number | null;
  machineId: number | null;
  materialId: number | null;
  boqLineId: number | null;
  trackingItemId: number | null;
  crewName: string | null;
  personName: string | null;
  description: string | null;
  headcount: number | null;
  hours: number | null;
  idleHours: number | null;
  qty: number | null;
  unit: string | null;
  amount: number | null;
  currency: CurrencyCode;
  waybillNo: string | null;
  occurredAt: string | null;
  severity: AccidentSeverity | null;
  lostDays: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogTotalsDto {
  logId: number;
  projectId: number;
  logDate: string;
  status: DailyLogStatus;
  workState: WorkState;
  subHeadcount: number;
  subHours: number;
  ownHeadcount: number;
  ownHours: number;
  equipHours: number;
  equipIdleHours: number;
  accidentCount: number;
  /** 'near_miss' hariç gerçek kaza sayısı. */
  realAccidentCount: number;
  lostDays: number;
  productionCount: number;
  deliveryCount: number;
  entryCount: number;
  fileCount: number;
}

export interface DailyLogFileDto {
  id: number;
  logId: number;
  entryId: number | null;
  fileKind: string;
  title: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdBy: number | null;
  createdAt: string;
}

export interface DailyLogCommentDto {
  id: number;
  logId: number;
  entryId: number | null;
  body: string;
  createdBy: number | null;
  createdAt: string;
}

/** Günün tam görünümü — bölümler TÜM kayıt tiplerini içerir (boş olanlar dahil). */
export interface DailyLogDayDto {
  log: DailyLogDto;
  totals: DailyLogTotalsDto | null;
  sections: { kind: LogEntryKind; entries: DailyLogEntryDto[] }[];
  files: DailyLogFileDto[];
  comments: DailyLogCommentDto[];
}

export interface DailyLogMonthDto {
  projectId: number;
  fromDate: string;
  toDate: string;
  days: DailyLogTotalsDto[];
}

/** Kayıt tipi tarifi — form alanları buna göre kurulur. */
export interface KindSpecDto {
  kind: LogEntryKind;
  required: string[];
  optional: string[];
  bridge: 'timesheet' | 'machine_log' | null;
}

export interface KindSpecsResponse {
  kinds: KindSpecDto[];
}

export interface ManpowerRowDto {
  logDate: string;
  workState: WorkState;
  ownHeadcount: number;
  ownHours: number;
  subHeadcount: number;
  subHours: number;
  totalHeadcount: number;
  totalHours: number;
}

export interface ManpowerReportDto {
  projectId: number;
  fromDate: string;
  toDate: string;
  rows: ManpowerRowDto[];
  totalOwnHours: number;
  totalSubHours: number;
  totalHours: number;
  workedDays: number;
  notWorkedDays: number;
  /** Çalışılan gün yoksa null (0 değil). */
  avgHeadcountPerWorkedDay: number | null;
}

export interface SafetySummaryDto {
  fromDate: string;
  toDate: string;
  totalHours: number;
  accidentCount: number;
  recordableAccidentCount: number;
  nearMissCount: number;
  lostDays: number;
  /** Çalışma saati 0 ise null — 0 döndürmek "kaza yok" gibi okunur. */
  frequencyRate: number | null;
  severityRate: number | null;
}

export interface ProductionActualRowDto {
  boqLineId: number;
  unit: string | null;
  producedQty: number;
  firstDate: string;
  lastDate: string;
  entryCount: number;
}

export interface ProductionActualsResponse {
  rows: ProductionActualRowDto[];
}

export interface MaterialConsumptionRowDto {
  materialId: number;
  locationId: number | null;
  unit: string | null;
  consumedQty: number;
  entryCount: number;
}

export interface MaterialConsumptionResponse {
  rows: MaterialConsumptionRowDto[];
}

// ============================================================================
// FAZ 4 — ADAM×SAAT & VERİMLİLİK (cs_v_boq_performance)
// ============================================================================

/** Verim yorumu bandı — arayüz rengi ve etiketi buradan gelir. */
export type EfficiencyBand = 'unknown' | 'critical' | 'behind' | 'onTrack' | 'ahead';

export interface PerformanceRowDto {
  boqLineId: number;
  contractId: number;
  projectId: number;
  lineNo: number;
  pozNo: string | null;
  description: string;
  unit: string;
  locationId: number | null;

  plannedQty: number;
  unitPrice: number;
  plannedAmount: number;
  pursantajPct: number;
  plannedUnitManhours: number;
  plannedManhours: number;

  /** Hakedişten (onaylı/ödenmiş) — MALİ gerçeklik. */
  progressQty: number;
  progressAmount: number;
  /** Günlük rapor imalat kayıtlarından — FİZİKSEL gerçeklik. */
  producedQty: number;

  ownManhours: number;
  subManhours: number;
  actualManhours: number;
  /** Makine saati adam×saat DEĞİLDİR; verim hesabına girmez. */
  machineHours: number;
  expenseAmount: number;

  /** Oranlar payda 0 iken null gelir — 0 değil. */
  progressPct: number | null;
  producedPct: number | null;
  manhourPct: number | null;
  earnedPursantaj: number | null;

  actualUnitManhours: number | null;
  expectedManhours: number;
  efficiency: number | null;
  manhourVariance: number;

  /** İlerleme-işçilik makası: miktar% − a×s%. Negatif = kâr kaybı sinyali. */
  progressGap: number | null;
  eacManhours: number;
  eacVariance: number;
  band: EfficiencyBand;
  /** İmalat − hakediş. Pozitif: kesilmemiş iş. Negatif: fazla hakediş. */
  productionVsProgressQty: number;

  // FAZ 7 — Taahhüt & maliyet
  /** Poza verilen toplam sipariş (iptal hariç). */
  committedAmount: number;
  /** Açık taahhüt — verilmiş, henüz fiiliye dönmemiş. */
  openCommittedAmount: number;
  /** Fiili + açık taahhüt = gerçek maruziyet. */
  costExposure: number;
  /** Planlanan − maruziyet. Negatif = poz bütçeyi aşmış/aşmak üzere. */
  budgetVariance: number;
}

export interface PerformanceSummaryDto {
  lineCount: number;
  plannedManhours: number;
  actualManhours: number;
  ownManhours: number;
  subManhours: number;
  machineHours: number;
  expectedManhours: number;
  manhourVariance: number;
  manhourPct: number | null;
  /** Ağırlıklı verim (Σbeklenen/Σharcanan), satır ortalaması değil. */
  efficiency: number | null;
  band: EfficiencyBand;
  eacManhours: number;
  eacVariance: number;
  plannedAmount: number;
  progressAmount: number;
  expenseAmount: number;
  earnedPursantaj: number;
  /** Planlanan a×s girilmemiş satır sayısı — verim ölçülemeyen kısım. */
  linesWithoutPlan: number;
  // FAZ 7 — Taahhüt & maliyet
  committedAmount: number;
  openCommittedAmount: number;
  costExposure: number;
  budgetVariance: number;
}

export interface PerformanceReportDto {
  rows: PerformanceRowDto[];
  summary: PerformanceSummaryDto;
}

export interface ContractManhourSummaryDto {
  contractId: number;
  projectId: number;
  lineCount: number;
  plannedManhours: number;
  actualManhours: number;
  ownManhours: number;
  subManhours: number;
  machineHours: number;
  expectedManhours: number;
  manhourVariance: number;
  plannedAmount: number;
  progressAmount: number;
  expenseAmount: number;
  earnedPursantaj: number;
  manhourPct: number | null;
  efficiency: number | null;
  band: EfficiencyBand;
}

export interface ManhourSummariesResponse {
  summaries: ContractManhourSummaryDto[];
}

// ============================================================================
// FAZ 5 — JENERİK ONAY AKIŞI (cs_approval_flows)
// ============================================================================

/**
 * Onay akışının bağlanabileceği belge tipleri. Backend enum'unun aynısı —
 * ayrışırsa arayüz var olmayan bir tip gönderip 400 alır.
 */
export type ApprovalDocKind =
  | 'contract'
  | 'progress'
  | 'material_request'
  | 'expense'
  | 'advance'
  | 'daily_log'
  | 'tracking'
  | 'boq'
  | 'measurement'
  | 'payment';

/** `ordered`: yalnız sırası gelen karar verir · `unordered`: bekleyen herkes. */
export type ApprovalMode = 'ordered' | 'unordered';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalDecision = 'pending' | 'approved' | 'rejected' | 'skipped' | 'delegated';

export interface ApprovalStepDto {
  id: number;
  seqNo: number;
  approverUserId: number;
  dueDate: string | null;
  decision: ApprovalDecision;
  decidedAt: string | null;
  /** Vekâleten karar verildiyse gerçek karar veren — kimin bastığı gizlenmez. */
  decidedBy: number | null;
  comment: string | null;
  /** Bu adım ŞU AN karar verebilir mi (sıralı akışta sıra bunda mı). */
  actionable: boolean;
  /** Bitiş tarihi geçmiş bekleyen adımda gecikme günü; yoksa null. */
  daysOverdue: number | null;
}

export interface ApprovalFlowDto {
  id: number;
  companyId: number;
  docKind: ApprovalDocKind;
  docId: number;
  projectId: number | null;
  mode: ApprovalMode;
  status: ApprovalStatus;
  /** null = herkes onaylamalı; sayı = "3 onaycıdan 2'si". */
  minApprovals: number | null;
  title: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  steps: ApprovalStepDto[];
  /** "Onay Sırası N/M" göstergesinin payı. */
  approvedCount: number;
  requiredCount: number;
  /** Sıralı modda sıradaki onaycı; sırasızda null. */
  currentApproverUserId: number | null;
  open: boolean;
}

/** Belge satırındaki N/M göstergesi — akışın tamamını çekmeden. */
export interface ApprovalFlowSummaryDto {
  flowId: number;
  docKind: ApprovalDocKind;
  docId: number;
  projectId: number | null;
  mode: ApprovalMode;
  status: ApprovalStatus;
  minApprovals: number | null;
  title: string | null;
  createdAt: string;
  completedAt: string | null;
  stepCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  requiredCount: number;
  currentApproverUserId: number | null;
  nextDueDate: string | null;
  /** Kapanmış akışta null — tamamlanmış işi geç göstermek yanıltır. */
  daysOverdue: number | null;
}

export interface ApprovalFlowsResponse {
  flows: ApprovalFlowSummaryDto[];
}

export interface ApprovalSummariesResponse {
  summaries: ApprovalFlowSummaryDto[];
}

/** "Bana atanan onaylar" kutusundaki bir satır. */
export interface PendingApprovalRowDto {
  stepId: number;
  approverUserId: number;
  seqNo: number;
  dueDate: string | null;
  flowId: number;
  docKind: ApprovalDocKind;
  docId: number;
  projectId: number | null;
  mode: ApprovalMode;
  title: string | null;
  flowCreatedAt: string;
  /** false ise sıralı akışta sıra henüz bu kişide değil. */
  actionable: boolean;
  daysOverdue: number | null;
}

export interface MyApprovalsDto {
  userId: number;
  /** Şimdi karar verebileceği adımlar. */
  actionable: PendingApprovalRowDto[];
  /** Sıralı akışta sırası henüz gelmemiş adımlar. */
  waiting: PendingApprovalRowDto[];
  overdue: PendingApprovalRowDto[];
  /**
   * Imperium panelindeki gecikme kovaları. `upcoming` AYRI: bitiş tarihi ileride
   * olan adımı "bugün teslim" saymak paneli yalan söyletir.
   */
  buckets: {
    dueToday: number;
    overdue1to7: number;
    overdueOver7: number;
    upcoming: number;
    noDueDate: number;
  };
}

export interface ApprovalHistoryRowDto {
  id: number;
  flowId: number;
  stepId: number | null;
  action: string;
  actor: number | null;
  note: string | null;
  createdAt: string;
}

export interface ApprovalHistoryResponse {
  history: ApprovalHistoryRowDto[];
}

export interface DecideApprovalResultDto {
  flow: ApprovalFlowDto;
  /** Akış bu kararla kapandı mı — arayüz "belge onaylandı" mesajını buna göre basar. */
  completed: boolean;
}

// ============================================================================
// FAZ 6 — KALİTE & GÜVENLİK (cs_defects / cs_inspections / cs_rfis / cs_assignments)
// ============================================================================

/** Backend enum'larının birebir kopyası — ayrışırsa 400 yeriz. */
export type DefectKind =
  | 'workmanship'
  | 'missing_work'
  | 'material_damage'
  | 'dimensional'
  | 'plumbing'
  | 'electrical'
  | 'paint'
  | 'insulation'
  | 'cleaning'
  | 'safety'
  | 'other';
export type DefectSeverity = 'very_low' | 'low' | 'medium' | 'high' | 'critical';
export type DefectStatus = 'open' | 'in_progress' | 'fixed' | 'verified' | 'closed' | 'rejected';
export type DefectSource = 'internal' | 'inspection' | 'daily_log' | 'client' | 'rfi';
export type InspectionTemplateKind =
  | 'quality'
  | 'subcontractor_scorecard'
  | 'hse'
  | 'handover'
  | 'other';
export type InspectionStatus = 'draft' | 'completed' | 'approved' | 'cancelled';
export type RfiDiscipline =
  | 'architectural'
  | 'structural'
  | 'mechanical'
  | 'electrical'
  | 'infrastructure'
  | 'landscape'
  | 'geotechnical'
  | 'other';
export type QualityPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RfiStatus = 'open' | 'answered' | 'closed' | 'cancelled';
export type AssignmentStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export type AssignmentSource = 'defect' | 'rfi' | 'inspection' | 'daily_log' | 'tracking';
export type QualityDocKind = 'defect' | 'inspection' | 'rfi' | 'assignment';

export interface DefectDto {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  title: string;
  description: string | null;
  defectKind: DefectKind;
  severity: DefectSeverity;
  status: DefectStatus;
  vendorId: number | null;
  responsibleUserId: number | null;
  reporterUserId: number | null;
  source: DefectSource;
  boqLineId: number | null;
  dueDate: string | null;
  fixedAt: string | null;
  fixedBy: number | null;
  verifiedAt: string | null;
  verifiedBy: number | null;
  closedAt: string | null;
  costEstimate: number;
  costActual: number;
  currency: string;
  /** Kaç kez "giderildi" deyip yeniden açıldı — taşeron karnesi sinyali. */
  reopenCount: number;
  createdAt: string;
  updatedAt: string;
  closed: boolean;
  /** Gecikme SUNUCUDA hesaplanır; kapanmış kayıtta null. */
  daysOverdue: number | null;
  /** Bu statüden gidilebilecek statüler — geçersiz düğme gösterilmez. */
  allowedTransitions: DefectStatus[];
}

export interface DefectHistoryRowDto {
  id: number;
  defectId: number;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  actor: number | null;
  createdAt: string;
}

export interface DefectSummaryRowDto {
  projectId: number;
  locationId: number | null;
  total: number;
  openCount: number;
  awaitingVerify: number;
  closedCount: number;
  rejectedCount: number;
  criticalCount: number;
  highCount: number;
  overdueCount: number;
  reopenedCount: number;
  costEstimateTotal: number;
  costActualTotal: number;
  avgFixDays: number | null;
}

export interface InspectionTemplateItemDto {
  id: number;
  category: string | null;
  code: string;
  text: string;
  weight: number;
  maxScore: number;
  /** Sıfır alırsa denetim toplam puandan bağımsız kalır. */
  isCritical: boolean;
  sortOrder: number;
}

export interface InspectionTemplateDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  kind: InspectionTemplateKind;
  description: string | null;
  scoring: 'weighted' | 'pass_fail';
  passPct: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: InspectionTemplateItemDto[];
  /** Karne formu taşeron ister — form alanı zorunlu işaretlenir. */
  requiresVendor: boolean;
  maxScoreTotal: number;
}

export interface InspectionAnswerDto {
  id: number;
  itemId: number;
  itemText: string;
  weight: number;
  maxScore: number;
  score: number | null;
  isNa: boolean;
  isCritical: boolean;
  note: string | null;
  /** Bu maddeden doğan hasar-eksiklik kaydı. */
  defectId: number | null;
}

export interface InspectionLiveScoreDto {
  totalScore: number;
  maxScore: number;
  scorePct: number | null;
  grade: string | null;
  passed: boolean | null;
  criticalFailures: number;
  answeredCount: number;
  naCount: number;
  unansweredCount: number;
}

export interface InspectionDto {
  id: number;
  companyId: number;
  projectId: number;
  templateId: number;
  locationId: number | null;
  code: string;
  vendorId: number | null;
  contractId: number | null;
  inspectorUserId: number | null;
  inspectionDate: string;
  periodLabel: string | null;
  status: InspectionStatus;
  note: string | null;
  totalScore: number;
  maxScore: number;
  scorePct: number | null;
  grade: string | null;
  passed: boolean | null;
  passPct: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  answers: InspectionAnswerDto[];
  editable: boolean;
  live: InspectionLiveScoreDto;
}

export interface VendorScorecardRowDto {
  vendorId: number;
  projectId: number;
  vendorName: string | null;
  inspectionCount: number;
  avgScorePct: number | null;
  minScorePct: number | null;
  lastInspectionDate: string | null;
  failedInspectionCount: number;
  defectCount: number;
  defectOpen: number;
  defectOverdue: number;
  defectSevere: number;
  reopenTotal: number;
  avgFixDays: number | null;
}

export interface RfiDto {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  subject: string;
  question: string;
  discipline: RfiDiscipline;
  priority: QualityPriority;
  status: RfiStatus;
  askedBy: number | null;
  askedToUserId: number | null;
  vendorId: number | null;
  boqLineId: number | null;
  dueDate: string | null;
  answer: string | null;
  answeredBy: number | null;
  answeredAt: string | null;
  closedAt: string | null;
  /** Süre/maliyet etkisi — süre uzatımı talebinin dayanağı. */
  impactDays: number;
  impactCost: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  daysOverdue: number | null;
  ageDays: number;
}

export interface RfiSummaryDto {
  projectId: number;
  total: number;
  openCount: number;
  answeredCount: number;
  closedCount: number;
  overdueCount: number;
  avgAnswerDays: number | null;
  oldestOpenDays: number | null;
  impactDaysTotal: number;
  impactCostTotal: number;
}

export interface AssignmentDto {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  title: string;
  description: string | null;
  assignedToUserId: number | null;
  vendorId: number | null;
  assignedBy: number | null;
  priority: QualityPriority;
  status: AssignmentStatus;
  startDate: string | null;
  dueDate: string | null;
  doneAt: string | null;
  progressPct: number;
  sourceKind: AssignmentSource | null;
  sourceId: number | null;
  createdAt: string;
  updatedAt: string;
  daysOverdue: number | null;
}

export interface AssignmentSummaryRowDto {
  projectId: number;
  assignedToUserId: number | null;
  total: number;
  openCount: number;
  inProgressCount: number;
  doneCount: number;
  overdueCount: number;
  avgProgressPct: number | null;
}

export interface QualityFileDto {
  id: number;
  docKind: QualityDocKind;
  docId: number;
  fileKind: string;
  stage: 'before' | 'after' | 'other';
  title: string | null;
  fileUrl: string | null;
  hasContent: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  createdBy: number | null;
  createdAt: string;
}

// ============================================================================
// FAZ 7 — TAAHHÜT & EVM (cs_commitments / cs_v_contract_evm)
// ============================================================================

export type CommitmentSource = 'purchase_order' | 'subcontract' | 'manual';
export type CommitmentStatus = 'open' | 'partial' | 'closed' | 'cancelled';

export interface CommitmentDto {
  id: number;
  companyId: number;
  projectId: number;
  contractId: number | null;
  boqLineId: number | null;
  locationId: number | null;
  source: CommitmentSource;
  refNo: string;
  refLineNo: number;
  vendorId: number | null;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  amount: number;
  /** Teslim alınan (KÜMÜLATİF) — artık taahhüt değil, fiiliye dönmüş. */
  deliveredAmount: number;
  /** Açık taahhüt = amount − delivered (kapalı/iptalde 0) — maruziyete giren kısım. */
  openAmount: number;
  currency: string;
  status: CommitmentStatus;
  committedAt: string;
  closedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractEvmDto {
  contractId: number;
  projectId: number;
  lineCount: number;
  /** Budget At Completion — keşif toplamı. */
  bac: number;
  /** Earned Value — hakediş kümülatifi (onaylı/ödenmiş). */
  ev: number;
  /** Actual Cost — fiili gider. */
  ac: number;
  committedAmount: number;
  openCommitted: number;
  costExposure: number;
  budgetRemaining: number;
  /** EV/AC; AC 0 → null. <1 = kazandığından çok harcıyor. */
  cpi: number | null;
  pctEarned: number | null;
  pctSpent: number | null;
  pctExposure: number | null;
}

export interface ProjectCommitmentSummaryDto {
  projectId: number;
  commitmentCount: number;
  openCount: number;
  committedTotal: number;
  openCommitted: number;
  /** Poza bağlanmamış taahhüt — veri kalitesi göstergesi. */
  unlinkedCount: number;
  unlinkedAmount: number;
}

export interface ProjectEvmDto {
  contracts: ContractEvmDto[];
  commitments: ProjectCommitmentSummaryDto | null;
}

export interface SyncCommitmentsResultDto {
  inserted: number;
  updated: number;
  cancelled: number;
  errors: { refNo: string; refLineNo: number; message: string }[];
}

// ============================================================================
// FAZ 8 — İŞ PROGRAMI (cs_schedule_activities / cs_schedule_progress_log)
// ============================================================================

export type ActivityKind = 'group' | 'task' | 'milestone';

export interface ScheduleActivityDto {
  id: number;
  companyId: number;
  projectId: number;
  parentId: number | null;
  code: string;
  name: string;
  kind: ActivityKind;
  plannedStart: string;
  plannedEnd: string;
  /** Fiili tarihler İLERLEMEDEN türer (ilk >0 başlangıç, 100 bitiş) — elle girilmez. */
  actualStart: string | null;
  actualEnd: string | null;
  progressPct: number;
  weightPct: number;
  trackingId: number | null;
  boqLineId: number | null;
  locationId: number | null;
  dependsOn: number | null;
  sortOrder: number;
  note: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Gecikme günü (bitmemiş + planlanan bitişi geçmiş); grup satırında null. */
  daysOverdue: number | null;
  /** Bağlı fiziksel takibin GÜNCEL yüzdesi — referans; otomatik eşitlenmez. */
  trackingPct: number | null;
}

export interface ScheduleSummaryDto {
  projectId: number;
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  notStartedLateCount: number;
  projectStart: string | null;
  projectEnd: string | null;
}

export interface ProjectScheduleDto {
  activities: ScheduleActivityDto[];
  summary: ScheduleSummaryDto | null;
}

export interface ScheduleCurvePointDto {
  date: string;
  plannedPct: number;
  /** Gelecek tarihte null — fiili gelecek için çizilmez. */
  actualPct: number | null;
}

export interface ScheduleCurveDto {
  points: ScheduleCurvePointDto[];
  /** 'explicit' = girilen ağırlıklar; 'duration' = süre-orantılı (ağırlık girilmemiş). */
  weightMode: 'explicit' | 'duration';
  plannedStart: string | null;
  plannedEnd: string | null;
}

export interface ActivityProgressLogRowDto {
  id: number;
  activityId: number;
  asOf: string;
  progressPct: number;
  note: string | null;
  createdBy: number | null;
  createdAt: string;
}

// ============================================================================
// FAZ 9 — MAKİNE PARKI (cs_machines genişletilmiş + sayaç + bakım)
// ============================================================================

export type MeterType = 'km' | 'hour';
export type MaintenanceIntervalType = 'meter' | 'days';
export type RentalPeriod = 'daily' | 'monthly';

export interface WarrantyStatusDto {
  /** true = sürüyor; false = bitti; null = garanti bilgisi girilmemiş. */
  inWarranty: boolean | null;
  daysLeft: number | null;
  meterLeft: number | null;
}

export interface MachineParkDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  kind: MachineKind;
  vendorId: number | null;
  hourlyCost: number;
  active: boolean;
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  plateNo: string | null;
  chassisNo: string | null;
  engineNo: string | null;
  meterType: MeterType;
  /** Sayaç günlüğünden türetilir — doğrudan yazılmaz. */
  currentMeter: number;
  purchaseDate: string | null;
  rentalStart: string | null;
  rentalEnd: string | null;
  rentalCost: number;
  rentalPeriod: RentalPeriod | null;
  warrantyUntil: string | null;
  warrantyMeter: number | null;
  parkNote: string | null;
  warranty: WarrantyStatusDto;
  rentalDaysLeft: number | null;
  /** Vadesi geçmiş aktif bakım planı sayısı. */
  overduePlanCount: number;
  /** Hiç bakım görmemiş (vadesi hesaplanamayan) plan sayısı. */
  plansWithoutBaseline: number;
}

export interface MaintenanceDueDto {
  nextDueMeter: number | null;
  nextDueDate: string | null;
  /** Kalan (meter: sayaç birimi, days: gün); NEGATİF = vade geçmiş; null = hesaplanamıyor. */
  remaining: number | null;
  overdue: boolean | null;
}

export interface MaintenancePlanDto {
  id: number;
  machineId: number;
  name: string;
  intervalType: MaintenanceIntervalType;
  intervalValue: number;
  lastDoneMeter: number | null;
  lastDoneDate: string | null;
  note: string | null;
  active: boolean;
  due: MaintenanceDueDto;
}

export interface MaintenanceRecordDto {
  id: number;
  machineId: number;
  planId: number | null;
  doneAt: string;
  meterAt: number | null;
  cost: number;
  description: string;
  vendorId: number | null;
  createdBy: number | null;
  createdAt: string;
}

export interface MachineMeterLogRowDto {
  id: number;
  machineId: number;
  readAt: string;
  meterValue: number;
  isReset: boolean;
  note: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface MachineMaintenanceDto {
  machine: MachineParkDto;
  plans: MaintenancePlanDto[];
  records: MaintenanceRecordDto[];
  meterLog: MachineMeterLogRowDto[];
}

// ============================================================================
// FAZ 10 — KONUT SATIŞ (bağımsız bölüm satış / tahsilat / değişiklik isteği)
// ============================================================================

export type UnitSaleStatus = 'reserved' | 'sold' | 'barter' | 'cancelled';
export type UnitSaleSource = 'crm' | 'manual';
export type UnitPaymentKind = 'collection' | 'refund';
export type UnitPaymentMethod = 'cash' | 'bank' | 'cheque' | 'other';
export type ChangeRequestStatus = 'open' | 'approved' | 'rejected' | 'done';

export interface UnitSaleDto {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number;
  status: UnitSaleStatus;
  source: UnitSaleSource;
  refNo: string | null;
  buyerName: string | null;
  vendorId: number | null;
  /** Satış anında defterden donan liste fiyatı. */
  listPrice: number;
  salePrice: number;
  /** liste − satış; liste donuğu 0 ise null (iskonto bilinmiyor). */
  discount: number | null;
  currency: string;
  reservedAt: string | null;
  soldAt: string | null;
  cancelledAt: string | null;
  cancelNote: string | null;
  note: string | null;
  allowedTransitions: UnitSaleStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface UnitPaymentDto {
  id: number;
  saleId: number;
  kind: UnitPaymentKind;
  paidAt: string;
  amount: number;
  method: UnitPaymentMethod | null;
  note: string | null;
  createdAt: string;
}

export interface UnitChangeRequestDto {
  id: number;
  saleId: number;
  code: string;
  title: string;
  description: string | null;
  cost: number;
  status: ChangeRequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  doneAt: string | null;
  note: string | null;
  allowedTransitions: ChangeRequestStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface UnitSaleDetailDto {
  sale: UnitSaleDto;
  /** Net tahsilat = Σtahsilat − Σiade. */
  collected: number;
  /** satış + onaylı değişiklik − tahsilat. */
  remaining: number;
  payments: UnitPaymentDto[];
  changeRequests: UnitChangeRequestDto[];
}

export interface UnitInventoryRowDto {
  locationId: number;
  projectId: number;
  code: string;
  name: string;
  path: string;
  unitType: string | null;
  grossArea: number | null;
  netArea: number | null;
  facade: string | null;
  /** Defterdeki güncel liste fiyatı (girilmemişse null). */
  bookListPrice: number | null;
  saleId: number | null;
  /** 'available' = satışsız daire (türetilir). */
  saleStatus: UnitSaleStatus | 'available';
  source: UnitSaleSource | null;
  refNo: string | null;
  buyerName: string | null;
  vendorId: number | null;
  saleListPrice: number | null;
  salePrice: number | null;
  discount: number | null;
  reservedAt: string | null;
  soldAt: string | null;
  changeOrderTotal: number | null;
  collected: number | null;
  remaining: number | null;
  openChangeRequests: number;
}

export interface ProjectSalesSummaryDto {
  projectId: number;
  unitCount: number;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  barterCount: number;
  soldValue: number;
  reservedValue: number;
  /** İş karşılığı bedeli — nakit DEĞİL, taşeron mahsubu; satılandan ayrı. */
  barterValue: number;
  changeOrderTotal: number;
  collectedTotal: number;
  remainingTotal: number;
  availableListValue: number | null;
  /** Liste fiyatı girilmemiş boş daire — veri kalitesi göstergesi. */
  unpricedAvailableCount: number;
  openChangeRequests: number;
  cancelledCount: number;
  /** İptal edilmiş satışlarda iade edilmemiş tahsilat. */
  refundLiability: number;
}

export interface UnitInventoryDto {
  units: UnitInventoryRowDto[];
  summary: ProjectSalesSummaryDto | null;
}
