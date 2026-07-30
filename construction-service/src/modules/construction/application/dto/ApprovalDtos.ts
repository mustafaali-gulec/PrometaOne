/**
 * Onay akışı DTO'ları (FAZ 5).
 */
import type {
  ApprovalDecision,
  ApprovalDocKind,
  ApprovalFlow,
  ApprovalMode,
  ApprovalStatus,
} from '../../domain/entities/ApprovalFlow.js';

export interface ApprovalStepDto {
  id: number;
  seqNo: number;
  approverUserId: number;
  dueDate: string | null;
  decision: ApprovalDecision;
  decidedAt: string | null;
  /** Vekâleten karar verildiyse gerçek karar veren. */
  decidedBy: number | null;
  comment: string | null;
  /** Bu adım ŞU AN karar verebilir mi? (sıralı akışta sıra bunda mı) */
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
  minApprovals: number | null;
  title: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  steps: ApprovalStepDto[];
  /** Imperium'un "Onay Sırası 2/3" göstergesi. */
  approvedCount: number;
  requiredCount: number;
  /** Sıralı modda sıradaki onaycı; sırasızda null. */
  currentApproverUserId: number | null;
  open: boolean;
}

/** Gecikme günü — bugüne göre. Kapanmış akışta hesaplanmaz. */
function overdueDays(dueDate: string | null, open: boolean): number | null {
  if (dueDate === null || !open) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (today <= dueDate) return 0;
  const diff = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`);
  return Math.max(0, Math.round(diff / 86_400_000));
}

export function toApprovalFlowDto(f: ApprovalFlow): ApprovalFlowDto {
  const j = f.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    docKind: j.docKind,
    docId: j.docId,
    projectId: j.projectId,
    mode: j.mode,
    status: j.status,
    minApprovals: j.minApprovals,
    title: j.title,
    note: j.note,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    completedAt: j.completedAt === null ? null : j.completedAt.toISOString(),
    steps: j.steps.map((s) => ({
      id: s.id,
      seqNo: s.seqNo,
      approverUserId: s.approverUserId,
      dueDate: s.dueDate,
      decision: s.decision,
      decidedAt: s.decidedAt === null ? null : s.decidedAt.toISOString(),
      decidedBy: s.decidedBy,
      comment: s.comment,
      actionable: f.isActionable(s.id),
      daysOverdue: s.decision === 'pending' ? overdueDays(s.dueDate, f.open) : null,
    })),
    approvedCount: f.approvedCount,
    requiredCount: f.requiredCount,
    currentApproverUserId: f.currentApproverUserId,
    open: f.open,
  };
}
