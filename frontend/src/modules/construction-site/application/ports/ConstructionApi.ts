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
  AttachmentDto,
  AttachmentsResponse,
  ExpenseDto,
  ExpensesResponse,
  MeasurementDto,
  MeasurementsResponse,
  MeasurementSummaryResponse,
  MaterialDto,
  MaterialRequestDto,
  MaterialRequestStatus,
  MaterialRequestsResponse,
  MaterialsResponse,
  MovementsResponse,
  ManualPaymentDto,
  PaymentListResponse,
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
  BulkGenerateResultDto,
  DeleteLocationResultDto,
  ItemState,
  LocationDto,
  LocationKind,
  LocationListResponse,
  LocationTreeResponse,
  LocationUsageDto,
  ProgressTemplateDto,
  ProgressTemplatesResponse,
  ProjectPhysicalProgressDto,
  SaveTemplateBodyResultDto,
  TrackScope,
  TrackingBoardDto,
  TrackingDto,
  TrackingItemHistoryResponse,
  TrackingLocationsResponse,
  TrackingStatus,
  TrackingsResponse,
  AccidentSeverity,
  DailyLogCommentDto,
  DailyLogDayDto,
  DailyLogDto,
  DailyLogEntryDto,
  DailyLogFileDto,
  DailyLogMonthDto,
  DailyLogStatus,
  KindSpecsResponse,
  LogEntryKind,
  ManpowerReportDto,
  MaterialConsumptionResponse,
  ProductionActualsResponse,
  SafetySummaryDto,
  WorkState,
  ManhourSummariesResponse,
  PerformanceReportDto,
  ApprovalDocKind,
  ApprovalFlowDto,
  ApprovalFlowsResponse,
  ApprovalHistoryResponse,
  ApprovalMode,
  ApprovalStatus,
  ApprovalSummariesResponse,
  DecideApprovalResultDto,
  MyApprovalsDto,
  AssignmentDto,
  AssignmentSource,
  AssignmentStatus,
  AssignmentSummaryRowDto,
  DefectDto,
  DefectHistoryRowDto,
  DefectKind,
  DefectSeverity,
  DefectSource,
  DefectStatus,
  DefectSummaryRowDto,
  InspectionDto,
  InspectionStatus,
  InspectionTemplateDto,
  InspectionTemplateKind,
  QualityDocKind,
  QualityFileDto,
  QualityPriority,
  RfiDiscipline,
  RfiDto,
  RfiStatus,
  RfiSummaryDto,
  VendorScorecardRowDto,
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
  /** DÖVİZ (004): kayda dondurulacak kur — manuel ya da TCMB. */
  fxRate?: number | null;
  fxRateSource?: 'manual' | 'tcmb' | null;
  fxRateDate?: string | null;
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
// --- Yeşil Defter (metraj) + Ataşman — SF-8 --------------------------------
export interface CreateMeasurementBody {
  companyId: number;
  contractId: number;
  boqLineId: number;
  progressId?: number | null;
  measuredQty?: number;
  measuredAt?: string | null;
  note?: string | null;
}
export interface UpdateMeasurementBody {
  companyId: number;
  progressId?: number | null;
  measuredQty?: number;
  measuredAt?: string | null;
  note?: string | null;
}
export interface CreateAttachmentBody {
  companyId: number;
  measurementId: number;
  boqLineId?: number | null;
  formula?: string | null;
  dimA?: number | null;
  dimB?: number | null;
  dimC?: number | null;
  countN?: number | null;
  manualQty?: number | null;
  fileUrl?: string | null;
}
export interface UpdateAttachmentBody {
  companyId: number;
  boqLineId?: number | null;
  formula?: string | null;
  dimA?: number | null;
  dimB?: number | null;
  dimC?: number | null;
  countN?: number | null;
  manualQty?: number | null;
  fileUrl?: string | null;
}

export interface CreatePaymentBody {
  companyId: number;
  projectId?: number | null;
  payee?: string | null;
  description?: string | null;
  amount: number;
  currency?: CurrencyCode;
  dueDate?: string | null;
  status?: 'planned' | 'paid';
  paidAt?: string | null;
  method?: string | null;
}
export interface UpdatePaymentBody {
  companyId: number;
  payee?: string | null;
  description?: string | null;
  amount?: number;
  currency?: CurrencyCode;
  dueDate?: string | null;
  status?: 'planned' | 'paid';
  paidAt?: string | null;
  method?: string | null;
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
  // Yeşil Defter (metraj) + Ataşman — SF-8
  listMeasurements(companyId: number, contractId: number): Promise<MeasurementsResponse>;
  getMeasurementSummary(contractId: number, companyId: number): Promise<MeasurementSummaryResponse>;
  createMeasurement(body: CreateMeasurementBody): Promise<MeasurementDto>;
  updateMeasurement(id: number, body: UpdateMeasurementBody): Promise<MeasurementDto>;
  deleteMeasurement(id: number, companyId: number): Promise<void>;
  listAttachments(companyId: number, measurementId: number): Promise<AttachmentsResponse>;
  createAttachment(body: CreateAttachmentBody): Promise<AttachmentDto>;
  updateAttachment(id: number, body: UpdateAttachmentBody): Promise<AttachmentDto>;
  deleteAttachment(id: number, companyId: number): Promise<void>;
  // Ödeme Listesi (birleşik: manuel + hakediş + gider + avans)
  listPaymentList(companyId: number, projectId?: number | null): Promise<PaymentListResponse>;
  createPayment(body: CreatePaymentBody): Promise<ManualPaymentDto>;
  updatePayment(id: number, body: UpdatePaymentBody): Promise<ManualPaymentDto>;
  deletePayment(id: number, companyId: number): Promise<void>;
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

  // FAZ 1 — Mekân kırılımı
  getLocationTree(
    projectId: number,
    companyId: number,
    options?: LocationQueryOptions,
  ): Promise<LocationTreeResponse>;
  listLocations(
    projectId: number,
    companyId: number,
    options?: LocationQueryOptions,
  ): Promise<LocationListResponse>;
  createLocation(body: CreateLocationBody): Promise<LocationDto>;
  updateLocation(id: number, body: UpdateLocationBody): Promise<LocationDto>;
  moveLocation(id: number, body: MoveLocationBody): Promise<LocationDto>;
  getLocationUsage(id: number, companyId: number): Promise<LocationUsageDto>;
  deleteLocation(
    id: number,
    companyId: number,
    deactivateOnly?: boolean,
  ): Promise<DeleteLocationResultDto>;
  bulkGenerateLocations(body: BulkGenerateLocationsBody): Promise<BulkGenerateResultDto>;

  // FAZ 2 — Fiziksel ilerleme takibi: şablonlar
  listProgressTemplates(
    companyId: number,
    options?: { includeInactive?: boolean; scope?: TrackScope; search?: string },
  ): Promise<ProgressTemplatesResponse>;
  getProgressTemplate(id: number, companyId: number): Promise<ProgressTemplateDto>;
  createProgressTemplate(body: CreateProgressTemplateBody): Promise<ProgressTemplateDto>;
  updateProgressTemplate(
    id: number,
    body: UpdateProgressTemplateBody,
  ): Promise<ProgressTemplateDto>;
  saveTemplateBody(id: number, body: SaveTemplateBodyBody): Promise<SaveTemplateBodyResultDto>;
  deactivateProgressTemplate(id: number, companyId: number): Promise<ProgressTemplateDto>;

  // FAZ 2 — Takipler
  listTrackings(
    companyId: number,
    options?: {
      projectId?: number;
      status?: TrackingStatus;
      includeCancelled?: boolean;
      search?: string;
      asOf?: string;
    },
  ): Promise<TrackingsResponse>;
  getTrackingBoard(id: number, companyId: number, asOf?: string): Promise<TrackingBoardDto>;
  createTracking(body: CreateTrackingBody): Promise<TrackingDto>;
  updateTracking(id: number, body: UpdateTrackingBody): Promise<TrackingDto>;
  changeTrackingStatus(
    id: number,
    body: { companyId: number; status: TrackingStatus },
  ): Promise<TrackingDto>;
  setTrackingItemStates(id: number, body: SetTrackingItemsBody): Promise<TrackingLocationsResponse>;
  getTrackingItemHistory(
    trackingItemId: number,
    companyId: number,
  ): Promise<TrackingItemHistoryResponse>;
  addTrackingLocations(
    id: number,
    body: AddTrackingLocationsBody,
  ): Promise<TrackingLocationsResponse>;
  removeTrackingLocation(
    id: number,
    trackingLocationId: number,
    companyId: number,
  ): Promise<TrackingLocationsResponse>;
  syncTrackingWithTemplate(id: number, companyId: number): Promise<{ addedItems: number }>;
  getProjectPhysicalProgress(
    projectId: number,
    companyId: number,
    asOf?: string,
  ): Promise<ProjectPhysicalProgressDto>;

  // FAZ 3 — Şantiye günlüğü
  getDailyLogMonth(
    projectId: number,
    companyId: number,
    year: number,
    month: number,
  ): Promise<DailyLogMonthDto>;
  /** Gün yoksa ve create=false ise null döner (404 değil: o gün henüz doldurulmadı). */
  getDailyLogDay(
    projectId: number,
    companyId: number,
    logDate: string,
    create?: boolean,
  ): Promise<DailyLogDayDto | null>;
  updateDailyLog(logId: number, body: UpdateDailyLogBody): Promise<DailyLogDto>;
  changeDailyLogStatus(
    logId: number,
    body: { companyId: number; status: DailyLogStatus },
  ): Promise<DailyLogDto>;
  listDailyLogKinds(): Promise<KindSpecsResponse>;
  saveDailyLogEntry(logId: number, body: SaveDailyLogEntryBody): Promise<DailyLogEntryDto>;
  deleteDailyLogEntry(entryId: number, companyId: number): Promise<{ deleted: boolean }>;
  addDailyLogFile(logId: number, body: AddDailyLogFileBody): Promise<DailyLogFileDto>;
  deleteDailyLogFile(fileId: number, companyId: number): Promise<{ deleted: boolean }>;
  addDailyLogComment(logId: number, body: AddDailyLogCommentBody): Promise<DailyLogCommentDto>;
  getManpowerReport(
    projectId: number,
    companyId: number,
    fromDate: string,
    toDate: string,
  ): Promise<ManpowerReportDto>;
  getSafetySummary(
    projectId: number,
    companyId: number,
    fromDate: string,
    toDate: string,
  ): Promise<SafetySummaryDto>;
  getProductionActuals(projectId: number, companyId: number): Promise<ProductionActualsResponse>;
  getMaterialConsumption(
    projectId: number,
    companyId: number,
  ): Promise<MaterialConsumptionResponse>;

  // FAZ 4 — Adam×saat & verimlilik
  getContractPerformance(contractId: number, companyId: number): Promise<PerformanceReportDto>;
  getProjectPerformance(projectId: number, companyId: number): Promise<PerformanceReportDto>;
  getManhourSummaries(projectId: number, companyId: number): Promise<ManhourSummariesResponse>;
  setUnitManhours(contractId: number, body: SetUnitManhoursBody): Promise<{ updated: number }>;

  // FAZ 5 — Jenerik onay akışı
  /** "Bana atanan onaylar" — kullanıcı token'dan gelir, parametre alınmaz. */
  getMyApprovals(companyId: number): Promise<MyApprovalsDto>;
  listApprovalFlows(
    companyId: number,
    options?: {
      docKind?: ApprovalDocKind;
      docId?: number;
      projectId?: number;
      status?: ApprovalStatus;
      overdueOnly?: boolean;
    },
  ): Promise<ApprovalFlowsResponse>;
  /** Liste ekranlarındaki N/M göstergeleri — belge başına ayrı istek atmamak için. */
  getApprovalSummaries(
    companyId: number,
    docKind: ApprovalDocKind,
    docIds: ReadonlyArray<number>,
  ): Promise<ApprovalSummariesResponse>;
  /** Belgenin aktif akışı; yoksa null (backend 204 döner — hata değil). */
  getDocApproval(
    companyId: number,
    docKind: ApprovalDocKind,
    docId: number,
  ): Promise<ApprovalFlowDto | null>;
  getApprovalFlow(flowId: number, companyId: number): Promise<ApprovalFlowDto>;
  getApprovalHistory(flowId: number, companyId: number): Promise<ApprovalHistoryResponse>;
  startApprovalFlow(body: StartApprovalFlowBody): Promise<ApprovalFlowDto>;
  decideApprovalStep(
    flowId: number,
    stepId: number,
    body: DecideApprovalBody,
  ): Promise<DecideApprovalResultDto>;
  /** Yönetici yetkisi ister (backend 403). */
  cancelApprovalFlow(flowId: number, companyId: number): Promise<ApprovalFlowDto>;

  // FAZ 6 — Kalite & Güvenlik
  listDefects(companyId: number, options?: DefectListOptions): Promise<{ defects: DefectDto[] }>;
  getDefect(
    id: number,
    companyId: number,
  ): Promise<{ defect: DefectDto; history: DefectHistoryRowDto[] }>;
  createDefect(body: CreateDefectBody): Promise<DefectDto>;
  updateDefect(id: number, body: UpdateDefectBody): Promise<DefectDto>;
  changeDefectStatus(
    id: number,
    body: { companyId: number; status: DefectStatus; note?: string | null },
  ): Promise<DefectDto>;
  getDefectSummary(
    projectId: number,
    companyId: number,
    byLocation?: boolean,
  ): Promise<{ rows: DefectSummaryRowDto[] }>;

  listInspectionTemplates(
    companyId: number,
    options?: { kind?: InspectionTemplateKind; includeInactive?: boolean },
  ): Promise<{ templates: InspectionTemplateDto[] }>;
  createInspectionTemplate(body: CreateInspectionTemplateBody): Promise<InspectionTemplateDto>;
  replaceInspectionTemplateItems(
    id: number,
    body: { companyId: number; items: InspectionTemplateItemBody[] },
  ): Promise<InspectionTemplateDto>;
  deactivateInspectionTemplate(id: number, companyId: number): Promise<InspectionTemplateDto>;

  listInspections(
    companyId: number,
    options?: InspectionListOptions,
  ): Promise<{ inspections: InspectionDto[] }>;
  getInspection(id: number, companyId: number): Promise<InspectionDto>;
  startInspection(body: StartInspectionBody): Promise<InspectionDto>;
  saveInspectionAnswers(
    id: number,
    body: { companyId: number; answers: InspectionAnswerBody[] },
  ): Promise<InspectionDto>;
  /** status=approved yönetici ister (backend 403). */
  changeInspectionStatus(
    id: number,
    body: { companyId: number; status: InspectionStatus },
  ): Promise<InspectionDto>;
  /** Başarısız denetim maddesinden hasar-eksiklik doğurur ve cevaba bağlar. */
  raiseDefectFromAnswer(
    inspectionId: number,
    itemId: number,
    body: RaiseDefectBody,
  ): Promise<{ inspection: InspectionDto; defect: DefectDto }>;
  getVendorScorecard(
    companyId: number,
    options?: { projectId?: number; vendorId?: number },
  ): Promise<{ rows: VendorScorecardRowDto[] }>;

  listRfis(companyId: number, options?: RfiListOptions): Promise<{ rfis: RfiDto[] }>;
  createRfi(body: CreateRfiBody): Promise<RfiDto>;
  updateRfi(id: number, body: UpdateRfiBody): Promise<RfiDto>;
  answerRfi(id: number, body: { companyId: number; answer: string }): Promise<RfiDto>;
  changeRfiStatus(id: number, body: { companyId: number; status: RfiStatus }): Promise<RfiDto>;
  /** Hiç RFI'ı olmayan projede null (backend 204). */
  getRfiSummary(projectId: number, companyId: number): Promise<RfiSummaryDto | null>;

  listAssignments(
    companyId: number,
    options?: AssignmentListOptions,
  ): Promise<{ assignments: AssignmentDto[] }>;
  createAssignment(body: CreateAssignmentBody): Promise<AssignmentDto>;
  updateAssignment(id: number, body: UpdateAssignmentBody): Promise<AssignmentDto>;
  changeAssignmentStatus(
    id: number,
    body: { companyId: number; status: AssignmentStatus },
  ): Promise<AssignmentDto>;
  getAssignmentSummary(
    projectId: number,
    companyId: number,
    byUser?: boolean,
  ): Promise<{ rows: AssignmentSummaryRowDto[] }>;

  listQualityFiles(
    companyId: number,
    docKind: QualityDocKind,
    docId: number,
  ): Promise<{ files: QualityFileDto[] }>;
  addQualityFile(body: AddQualityFileBody): Promise<QualityFileDto>;
  deleteQualityFile(id: number, companyId: number): Promise<{ deleted: boolean }>;
}

// ===== FAZ 6 — istek gövdeleri ==============================================

export interface DefectListOptions {
  projectId?: number;
  locationId?: number;
  locationSubtree?: boolean;
  status?: DefectStatus;
  openOnly?: boolean;
  severity?: DefectSeverity;
  defectKind?: DefectKind;
  vendorId?: number;
  responsibleUserId?: number;
  overdueOnly?: boolean;
  search?: string;
}

export interface CreateDefectBody {
  companyId: number;
  projectId: number;
  locationId?: number | null;
  code?: string;
  title: string;
  description?: string | null;
  defectKind: DefectKind;
  severity?: DefectSeverity;
  vendorId?: number | null;
  responsibleUserId?: number | null;
  source?: DefectSource;
  boqLineId?: number | null;
  dueDate?: string | null;
  costEstimate?: number;
  currency?: string;
}

export interface UpdateDefectBody {
  companyId: number;
  locationId?: number | null;
  title?: string;
  description?: string | null;
  defectKind?: DefectKind;
  severity?: DefectSeverity;
  vendorId?: number | null;
  responsibleUserId?: number | null;
  boqLineId?: number | null;
  dueDate?: string | null;
  costEstimate?: number;
  costActual?: number;
  currency?: string;
}

export interface InspectionTemplateItemBody {
  category?: string | null;
  code: string;
  text: string;
  weight?: number;
  maxScore?: number;
  isCritical?: boolean;
  sortOrder?: number;
}

export interface CreateInspectionTemplateBody {
  companyId: number;
  code: string;
  name: string;
  kind?: InspectionTemplateKind;
  description?: string | null;
  scoring?: 'weighted' | 'pass_fail';
  passPct?: number;
  items: InspectionTemplateItemBody[];
}

export interface InspectionListOptions {
  projectId?: number;
  templateId?: number;
  vendorId?: number;
  locationId?: number;
  status?: InspectionStatus;
  fromDate?: string;
  toDate?: string;
}

export interface StartInspectionBody {
  companyId: number;
  projectId: number;
  templateId: number;
  locationId?: number | null;
  code?: string;
  vendorId?: number | null;
  contractId?: number | null;
  inspectionDate: string;
  periodLabel?: string | null;
  note?: string | null;
}

export interface InspectionAnswerBody {
  itemId: number;
  score?: number | null;
  isNa?: boolean;
  note?: string | null;
}

export interface RaiseDefectBody {
  companyId: number;
  defectKind: DefectKind;
  severity?: DefectSeverity;
  vendorId?: number | null;
  responsibleUserId?: number | null;
  dueDate?: string | null;
}

export interface RfiListOptions {
  projectId?: number;
  locationId?: number;
  status?: RfiStatus;
  discipline?: RfiDiscipline;
  priority?: QualityPriority;
  askedToUserId?: number;
  overdueOnly?: boolean;
  search?: string;
}

export interface CreateRfiBody {
  companyId: number;
  projectId: number;
  locationId?: number | null;
  code?: string;
  subject: string;
  question: string;
  discipline?: RfiDiscipline;
  priority?: QualityPriority;
  askedToUserId?: number | null;
  vendorId?: number | null;
  boqLineId?: number | null;
  dueDate?: string | null;
  impactDays?: number;
  impactCost?: number;
  currency?: string;
}

export interface UpdateRfiBody {
  companyId: number;
  locationId?: number | null;
  subject?: string;
  question?: string;
  discipline?: RfiDiscipline;
  priority?: QualityPriority;
  askedToUserId?: number | null;
  vendorId?: number | null;
  boqLineId?: number | null;
  dueDate?: string | null;
  impactDays?: number;
  impactCost?: number;
  currency?: string;
}

export interface AssignmentListOptions {
  projectId?: number;
  locationId?: number;
  assignedToUserId?: number;
  vendorId?: number;
  status?: AssignmentStatus;
  openOnly?: boolean;
  priority?: QualityPriority;
  sourceKind?: AssignmentSource;
  sourceId?: number;
  overdueOnly?: boolean;
}

export interface CreateAssignmentBody {
  companyId: number;
  projectId: number;
  locationId?: number | null;
  code?: string;
  title: string;
  description?: string | null;
  assignedToUserId?: number | null;
  vendorId?: number | null;
  priority?: QualityPriority;
  startDate?: string | null;
  dueDate?: string | null;
  sourceKind?: AssignmentSource | null;
  sourceId?: number | null;
}

export interface UpdateAssignmentBody {
  companyId: number;
  locationId?: number | null;
  title?: string;
  description?: string | null;
  assignedToUserId?: number | null;
  vendorId?: number | null;
  priority?: QualityPriority;
  startDate?: string | null;
  dueDate?: string | null;
  progressPct?: number;
}

export interface AddQualityFileBody {
  companyId: number;
  docKind: QualityDocKind;
  docId: number;
  fileKind?: string;
  stage?: 'before' | 'after' | 'other';
  title?: string | null;
  fileUrl?: string | null;
  contentBase64?: string | null;
  mimeType?: string | null;
}

// ===== FAZ 4 — istek gövdesi =================================================

export interface SetUnitManhoursBody {
  companyId: number;
  updates: { boqLineId: number; unitManhours: number }[];
}

// ===== FAZ 5 — istek gövdeleri ==============================================

export interface StartApprovalFlowBody {
  companyId: number;
  docKind: ApprovalDocKind;
  docId: number;
  projectId?: number | null;
  mode?: ApprovalMode;
  /** null/boş = herkes onaylamalı. */
  minApprovals?: number | null;
  title?: string | null;
  note?: string | null;
  approvers: { approverUserId: number; dueDate?: string | null }[];
}

export interface DecideApprovalBody {
  companyId: number;
  approve: boolean;
  comment?: string | null;
}

// ===== FAZ 3 — Şantiye günlüğü istek gövdeleri ==============================

export interface UpdateDailyLogBody {
  companyId: number;
  workState?: WorkState;
  tempC?: number | null;
  weatherNote?: string | null;
  noWorkReason?: string | null;
  summary?: string | null;
}

export interface SaveDailyLogEntryBody {
  companyId: number;
  /** Doluysa güncelleme, boşsa ekleme. */
  entryId?: number;
  kind: LogEntryKind;
  locationId?: number | null;
  vendorId?: number | null;
  personnelId?: number | null;
  machineId?: number | null;
  materialId?: number | null;
  boqLineId?: number | null;
  trackingItemId?: number | null;
  crewName?: string | null;
  personName?: string | null;
  description?: string | null;
  headcount?: number | null;
  hours?: number | null;
  idleHours?: number | null;
  qty?: number | null;
  unit?: string | null;
  amount?: number | null;
  currency?: CurrencyCode;
  waybillNo?: string | null;
  occurredAt?: string | null;
  severity?: AccidentSeverity | null;
  lostDays?: number | null;
  sortOrder?: number;
}

export interface AddDailyLogFileBody {
  companyId: number;
  entryId?: number | null;
  fileKind?: 'photo' | 'doc';
  title?: string | null;
  fileUrl?: string | null;
  contentBase64?: string | null;
  mimeType?: string | null;
}

export interface AddDailyLogCommentBody {
  companyId: number;
  entryId?: number | null;
  body: string;
}

// ===== FAZ 1 — Mekân kırılımı istek gövdeleri ===============================

export interface LocationQueryOptions {
  includeInactive?: boolean;
  kind?: LocationKind;
  subtreeOf?: number;
  search?: string;
}

export interface CreateLocationBody {
  companyId: number;
  projectId: number;
  parentId?: number | null;
  kind: LocationKind;
  code: string;
  name?: string;
  sortOrder?: number;
  unitType?: string | null;
  grossArea?: number | null;
  netArea?: number | null;
  landShare?: number | null;
  facade?: string | null;
}

export interface UpdateLocationBody {
  companyId: number;
  code?: string;
  name?: string;
  sortOrder?: number;
  unitType?: string | null;
  grossArea?: number | null;
  netArea?: number | null;
  landShare?: number | null;
  facade?: string | null;
}

export interface MoveLocationBody {
  companyId: number;
  newParentId: number | null;
}

export interface BulkGenerateLocationsBody {
  companyId: number;
  projectId: number;
  parentId?: number | null;
  blocks: string[];
  floors?: string[];
  unitsPerFloor?: number;
  unitNumbering?: 'sequential' | 'per_floor';
  defaultUnitType?: string | null;
  blockNameTemplate?: string;
  floorNameTemplate?: string;
  unitNameTemplate?: string;
}

// ===== FAZ 2 — Takip istek gövdeleri =======================================

export interface TemplateBodyPayload {
  groups: {
    code: string;
    name: string;
    weightPct: number;
    sortOrder?: number;
    items: {
      code: string;
      name: string;
      weightPct: number;
      sortOrder?: number;
      pozId?: number | null;
    }[];
  }[];
}

export interface CreateProgressTemplateBody {
  companyId: number;
  name: string;
  code?: string;
  scope?: TrackScope;
  description?: string | null;
  pctInProgress?: number;
  pctHasDefects?: number;
  body?: TemplateBodyPayload;
}

export interface UpdateProgressTemplateBody {
  companyId: number;
  name?: string;
  scope?: TrackScope;
  description?: string | null;
  pctInProgress?: number;
  pctHasDefects?: number;
}

export interface SaveTemplateBodyBody extends TemplateBodyPayload {
  companyId: number;
}

export interface CreateTrackingBody {
  companyId: number;
  projectId: number;
  templateId: number;
  name: string;
  code?: string;
  projectWeightPct?: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  assignedUserId?: number | null;
  visibleAll?: boolean;
  note?: string | null;
  locationIds: number[];
  locationWeights?: Record<string, number>;
}

export interface UpdateTrackingBody {
  companyId: number;
  name?: string;
  projectWeightPct?: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  assignedUserId?: number | null;
  visibleAll?: boolean;
  note?: string | null;
}

export interface SetTrackingItemsBody {
  companyId: number;
  updates: {
    trackingItemId: number;
    state: ItemState;
    overridePct?: number | null;
    inspectedBy?: number | null;
    inspectedAt?: string | null;
    note?: string | null;
  }[];
}

export interface AddTrackingLocationsBody {
  companyId: number;
  locationIds: number[];
  locationWeights?: Record<string, number>;
}
