/**
 * Kalite & Güvenlik DTO'ları (FAZ 6).
 *
 * Gecikme günü ve yaş SUNUCUDA hesaplanır: istemcinin saati ve saat dilimi
 * güvenilmez, "3 gün gecikmiş" ifadesi tarayıcıya göre değişmemeli.
 */
import type { Assignment } from '../../domain/entities/Assignment.js';
import type { Defect } from '../../domain/entities/Defect.js';
import type { Inspection, InspectionTemplate } from '../../domain/entities/Inspection.js';
import type { Rfi } from '../../domain/entities/Rfi.js';
import {
  allowedDefectTransitions,
  type DefectStatus,
  type ScoreResult,
} from '../../domain/valueObjects/QualitySafety.js';

const today = (): string => new Date().toISOString().slice(0, 10);

// ===== HASAR-EKSİKLİK =======================================================

export interface DefectDto {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  title: string;
  description: string | null;
  defectKind: string;
  severity: string;
  status: string;
  vendorId: number | null;
  responsibleUserId: number | null;
  reporterUserId: number | null;
  source: string;
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
  reopenCount: number;
  createdAt: string;
  updatedAt: string;
  /** İşi bitmiş mi (verified/closed/rejected). */
  closed: boolean;
  /** Gecikme günü; kapanmış kayıtta null. */
  daysOverdue: number | null;
  /** Bu statüden gidilebilecek statüler — arayüz geçersiz düğme göstermesin. */
  allowedTransitions: ReadonlyArray<DefectStatus>;
}

export function toDefectDto(d: Defect): DefectDto {
  const j = d.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    locationId: j.locationId,
    code: j.code,
    title: j.title,
    description: j.description,
    defectKind: j.defectKind,
    severity: j.severity,
    status: j.status,
    vendorId: j.vendorId,
    responsibleUserId: j.responsibleUserId,
    reporterUserId: j.reporterUserId,
    source: j.source,
    boqLineId: j.boqLineId,
    dueDate: j.dueDate,
    fixedAt: j.fixedAt === null ? null : j.fixedAt.toISOString(),
    fixedBy: j.fixedBy,
    verifiedAt: j.verifiedAt === null ? null : j.verifiedAt.toISOString(),
    verifiedBy: j.verifiedBy,
    closedAt: j.closedAt === null ? null : j.closedAt.toISOString(),
    costEstimate: j.costEstimate,
    costActual: j.costActual,
    currency: j.currency,
    reopenCount: j.reopenCount,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    closed: d.isClosed,
    daysOverdue: d.overdueDays(today()),
    allowedTransitions: allowedDefectTransitions(j.status),
  };
}

// ===== DENETLEME ============================================================

export interface InspectionTemplateItemDto {
  id: number;
  category: string | null;
  code: string;
  text: string;
  weight: number;
  maxScore: number;
  isCritical: boolean;
  sortOrder: number;
}

export interface InspectionTemplateDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  kind: string;
  description: string | null;
  scoring: string;
  passPct: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: InspectionTemplateItemDto[];
  /** Karne formu taşeron ister; arayüz alanı zorunlu işaretlesin. */
  requiresVendor: boolean;
  /** Ağırlıklı tam puan — şablonun "kaç üzerinden" olduğu. */
  maxScoreTotal: number;
}

export function toInspectionTemplateDto(t: InspectionTemplate): InspectionTemplateDto {
  const j = t.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    code: j.code,
    name: j.name,
    kind: j.kind,
    description: j.description,
    scoring: j.scoring,
    passPct: j.passPct,
    isActive: j.isActive,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    items: j.items.map((i) => ({
      id: i.id,
      category: i.category,
      code: i.code,
      text: i.text,
      weight: i.weight,
      maxScore: i.maxScore,
      isCritical: i.isCritical,
      sortOrder: i.sortOrder,
    })),
    requiresVendor: t.requiresVendor,
    maxScoreTotal: j.items.reduce((s, i) => s + i.maxScore * i.weight, 0),
  };
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
  defectId: number | null;
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
  status: string;
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
  /** Canlı puan: kaydedilmiş puandan farklıysa arayüz taze değeri gösterir. */
  live: {
    totalScore: number;
    maxScore: number;
    scorePct: number | null;
    grade: string | null;
    passed: boolean | null;
    criticalFailures: number;
    answeredCount: number;
    naCount: number;
    unansweredCount: number;
  };
}

export function toInspectionDto(ins: Inspection): InspectionDto {
  const j = ins.toJSON();
  const live: ScoreResult = ins.score();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    templateId: j.templateId,
    locationId: j.locationId,
    code: j.code,
    vendorId: j.vendorId,
    contractId: j.contractId,
    inspectorUserId: j.inspectorUserId,
    inspectionDate: j.inspectionDate,
    periodLabel: j.periodLabel,
    status: j.status,
    note: j.note,
    totalScore: j.totalScore,
    maxScore: j.maxScore,
    scorePct: j.scorePct,
    grade: j.grade,
    passed: j.passed,
    passPct: j.passPct,
    completedAt: j.completedAt === null ? null : j.completedAt.toISOString(),
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    answers: j.answers.map((a) => ({
      id: a.id,
      itemId: a.itemId,
      itemText: a.itemText,
      weight: a.weight,
      maxScore: a.maxScore,
      score: a.score,
      isNa: a.isNa,
      isCritical: a.isCritical ?? false,
      note: a.note,
      defectId: a.defectId,
    })),
    editable: ins.editable,
    live: {
      totalScore: live.totalScore,
      maxScore: live.maxScore,
      scorePct: live.scorePct,
      grade: live.grade,
      passed: live.passed,
      criticalFailures: live.criticalFailures,
      answeredCount: live.answeredCount,
      naCount: live.naCount,
      unansweredCount: live.unansweredCount,
    },
  };
}

// ===== RFI ==================================================================

export interface RfiDto {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  subject: string;
  question: string;
  discipline: string;
  priority: string;
  status: string;
  askedBy: number | null;
  askedToUserId: number | null;
  vendorId: number | null;
  boqLineId: number | null;
  dueDate: string | null;
  answer: string | null;
  answeredBy: number | null;
  answeredAt: string | null;
  closedAt: string | null;
  impactDays: number;
  impactCost: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  daysOverdue: number | null;
  /** Kaydın yaşı (gün) — açık RFI'da süre uzatımı dayanağı. */
  ageDays: number;
}

export function toRfiDto(r: Rfi): RfiDto {
  const j = r.toJSON();
  const t = today();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    locationId: j.locationId,
    code: j.code,
    subject: j.subject,
    question: j.question,
    discipline: j.discipline,
    priority: j.priority,
    status: j.status,
    askedBy: j.askedBy,
    askedToUserId: j.askedToUserId,
    vendorId: j.vendorId,
    boqLineId: j.boqLineId,
    dueDate: j.dueDate,
    answer: j.answer,
    answeredBy: j.answeredBy,
    answeredAt: j.answeredAt === null ? null : j.answeredAt.toISOString(),
    closedAt: j.closedAt === null ? null : j.closedAt.toISOString(),
    impactDays: j.impactDays,
    impactCost: j.impactCost,
    currency: j.currency,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    daysOverdue: r.overdueDays(t),
    ageDays: r.ageDays(t),
  };
}

// ===== GÖREVLENDİRME ========================================================

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
  priority: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  doneAt: string | null;
  progressPct: number;
  sourceKind: string | null;
  sourceId: number | null;
  createdAt: string;
  updatedAt: string;
  daysOverdue: number | null;
}

export function toAssignmentDto(a: Assignment): AssignmentDto {
  const j = a.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    locationId: j.locationId,
    code: j.code,
    title: j.title,
    description: j.description,
    assignedToUserId: j.assignedToUserId,
    vendorId: j.vendorId,
    assignedBy: j.assignedBy,
    priority: j.priority,
    status: j.status,
    startDate: j.startDate,
    dueDate: j.dueDate,
    doneAt: j.doneAt === null ? null : j.doneAt.toISOString(),
    progressPct: j.progressPct,
    sourceKind: j.sourceKind,
    sourceId: j.sourceId,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    daysOverdue: a.overdueDays(today()),
  };
}
