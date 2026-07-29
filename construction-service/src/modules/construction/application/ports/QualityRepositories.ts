/**
 * Kalite & Güvenlik kalıcılık portları (FAZ 6).
 * Concrete: infrastructure/persistence/PgQualityRepositories.ts
 */
import type { Assignment } from '../../domain/entities/Assignment.js';
import type { Defect } from '../../domain/entities/Defect.js';
import type { Inspection, InspectionTemplate } from '../../domain/entities/Inspection.js';
import type { Rfi } from '../../domain/entities/Rfi.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type {
  AssignmentSource,
  AssignmentStatus,
  DefectKind,
  DefectSeverity,
  DefectSource,
  DefectStatus,
  FileStage,
  InspectionScoring,
  InspectionStatus,
  InspectionTemplateKind,
  Priority,
  QualityDocKind,
  RfiDiscipline,
  RfiStatus,
} from '../../domain/valueObjects/QualitySafety.js';

// ===== HASAR-EKSİKLİK =======================================================

export interface NewDefectInput {
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  title: string;
  description: string | null;
  defectKind: DefectKind;
  severity: DefectSeverity;
  vendorId: number | null;
  responsibleUserId: number | null;
  reporterUserId: number | null;
  source: DefectSource;
  boqLineId: number | null;
  dueDate: string | null;
  costEstimate: number;
  currency: CurrencyCode;
}

export interface DefectFilter {
  projectId?: number | undefined;
  locationId?: number | undefined;
  /** Alt ağaç dahil: lokasyonun kendisi VE altındakiler. */
  locationSubtree?: boolean | undefined;
  status?: DefectStatus | undefined;
  /** true ise kapanmamış tüm kayıtlar (open/in_progress/fixed). */
  openOnly?: boolean | undefined;
  severity?: DefectSeverity | undefined;
  defectKind?: DefectKind | undefined;
  vendorId?: number | undefined;
  responsibleUserId?: number | undefined;
  overdueOnly?: boolean | undefined;
  search?: string | undefined;
}

export interface DefectSummaryRow {
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
  /** Ortalama giderme süresi (gün); giderilmiş kayıt yoksa null. */
  avgFixDays: number | null;
}

export interface DefectHistoryRow {
  id: number;
  defectId: number;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  actor: number | null;
  createdAt: string;
}

export interface DefectRepository {
  insert(input: NewDefectInput): Promise<Defect>;
  findById(id: number, companyId: number): Promise<Defect | null>;
  list(companyId: number, filter?: DefectFilter): Promise<ReadonlyArray<Defect>>;
  update(defect: Defect): Promise<Defect>;
  /** Durum değişimi + geçmiş satırı tek transaction'da. */
  changeStatus(
    defect: Defect,
    fromStatus: string,
    note: string | null,
    actor: number | null,
  ): Promise<void>;
  history(defectId: number, companyId: number): Promise<ReadonlyArray<DefectHistoryRow>>;
  summary(
    companyId: number,
    projectId: number,
    options?: { byLocation?: boolean },
  ): Promise<ReadonlyArray<DefectSummaryRow>>;
  /** Sıradaki kod (DEF-0001 gibi) — proje içinde artan. */
  nextCode(companyId: number, projectId: number): Promise<string>;
}

// ===== DENETLEME ============================================================

export interface NewInspectionTemplateInput {
  companyId: number;
  code: string;
  name: string;
  kind: InspectionTemplateKind;
  description: string | null;
  scoring: InspectionScoring;
  passPct: number;
  items: ReadonlyArray<{
    category: string | null;
    code: string;
    text: string;
    weight: number;
    maxScore: number;
    isCritical: boolean;
    sortOrder: number;
  }>;
}

export interface NewInspectionInput {
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
  note: string | null;
}

export interface InspectionFilter {
  projectId?: number | undefined;
  templateId?: number | undefined;
  vendorId?: number | undefined;
  locationId?: number | undefined;
  status?: InspectionStatus | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
}

export interface VendorScorecardRow {
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

export interface InspectionRepository {
  insertTemplate(input: NewInspectionTemplateInput): Promise<InspectionTemplate>;
  findTemplate(id: number, companyId: number): Promise<InspectionTemplate | null>;
  listTemplates(
    companyId: number,
    options?: { kind?: InspectionTemplateKind; includeInactive?: boolean },
  ): Promise<ReadonlyArray<InspectionTemplate>>;
  /** Şablon gövdesini (maddeleri) toptan değiştirir. */
  replaceTemplateItems(
    templateId: number,
    companyId: number,
    items: NewInspectionTemplateInput['items'],
  ): Promise<InspectionTemplate>;
  deactivateTemplate(id: number, companyId: number): Promise<InspectionTemplate>;

  /** Denetimi şablon maddelerinden cevap iskeletiyle birlikte kurar. */
  insertInspection(input: NewInspectionInput): Promise<Inspection>;
  findInspection(id: number, companyId: number): Promise<Inspection | null>;
  listInspections(companyId: number, filter?: InspectionFilter): Promise<ReadonlyArray<Inspection>>;
  saveAnswers(inspection: Inspection): Promise<void>;
  changeInspectionStatus(inspection: Inspection): Promise<void>;
  /** Cevabı doğan hasar-eksiklik kaydına bağlar. */
  linkAnswerDefect(answerId: number, companyId: number, defectId: number): Promise<void>;
  scorecard(
    companyId: number,
    options?: { projectId?: number; vendorId?: number },
  ): Promise<ReadonlyArray<VendorScorecardRow>>;
  nextInspectionCode(companyId: number): Promise<string>;
}

// ===== RFI ==================================================================

export interface NewRfiInput {
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  subject: string;
  question: string;
  discipline: RfiDiscipline;
  priority: Priority;
  askedBy: number | null;
  askedToUserId: number | null;
  vendorId: number | null;
  boqLineId: number | null;
  dueDate: string | null;
  impactDays: number;
  impactCost: number;
  currency: CurrencyCode;
}

export interface RfiFilter {
  projectId?: number | undefined;
  locationId?: number | undefined;
  status?: RfiStatus | undefined;
  discipline?: RfiDiscipline | undefined;
  priority?: Priority | undefined;
  askedToUserId?: number | undefined;
  overdueOnly?: boolean | undefined;
  search?: string | undefined;
}

export interface RfiSummaryRow {
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

export interface RfiRepository {
  insert(input: NewRfiInput): Promise<Rfi>;
  findById(id: number, companyId: number): Promise<Rfi | null>;
  list(companyId: number, filter?: RfiFilter): Promise<ReadonlyArray<Rfi>>;
  update(rfi: Rfi): Promise<Rfi>;
  summary(companyId: number, projectId: number): Promise<RfiSummaryRow | null>;
  nextCode(companyId: number, projectId: number): Promise<string>;
}

// ===== GÖREVLENDİRME ========================================================

export interface NewAssignmentInput {
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  title: string;
  description: string | null;
  assignedToUserId: number | null;
  vendorId: number | null;
  assignedBy: number | null;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  sourceKind: AssignmentSource | null;
  sourceId: number | null;
}

export interface AssignmentFilter {
  projectId?: number | undefined;
  locationId?: number | undefined;
  assignedToUserId?: number | undefined;
  vendorId?: number | undefined;
  status?: AssignmentStatus | undefined;
  openOnly?: boolean | undefined;
  priority?: Priority | undefined;
  sourceKind?: AssignmentSource | undefined;
  sourceId?: number | undefined;
  overdueOnly?: boolean | undefined;
}

export interface AssignmentSummaryRow {
  projectId: number;
  assignedToUserId: number | null;
  total: number;
  openCount: number;
  inProgressCount: number;
  doneCount: number;
  overdueCount: number;
  avgProgressPct: number | null;
}

export interface AssignmentRepository {
  insert(input: NewAssignmentInput): Promise<Assignment>;
  findById(id: number, companyId: number): Promise<Assignment | null>;
  list(companyId: number, filter?: AssignmentFilter): Promise<ReadonlyArray<Assignment>>;
  update(assignment: Assignment): Promise<Assignment>;
  summary(
    companyId: number,
    projectId: number,
    options?: { byUser?: boolean },
  ): Promise<ReadonlyArray<AssignmentSummaryRow>>;
  nextCode(companyId: number, projectId: number): Promise<string>;
}

// ===== ORTAK EK DOSYASI =====================================================

export interface NewQualityFileInput {
  companyId: number;
  docKind: QualityDocKind;
  docId: number;
  fileKind: string;
  stage: FileStage;
  title: string | null;
  fileUrl: string | null;
  content: Buffer | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdBy: number | null;
}

export interface QualityFileRow {
  id: number;
  docKind: QualityDocKind;
  docId: number;
  fileKind: string;
  stage: FileStage;
  title: string | null;
  fileUrl: string | null;
  hasContent: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  createdBy: number | null;
  createdAt: string;
}

export interface QualityFileRepository {
  insert(input: NewQualityFileInput): Promise<QualityFileRow>;
  list(
    companyId: number,
    docKind: QualityDocKind,
    docId: number,
  ): Promise<ReadonlyArray<QualityFileRow>>;
  delete(id: number, companyId: number): Promise<boolean>;
}
