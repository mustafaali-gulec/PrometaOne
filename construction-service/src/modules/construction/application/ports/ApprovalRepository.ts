/**
 * ApprovalRepository — jenerik onay akışı kalıcılık portu (FAZ 5).
 * Concrete: infrastructure/persistence/PgApprovalRepository.ts
 */
import type {
  ApprovalDocKind,
  ApprovalFlow,
  ApprovalMode,
  ApprovalStatus,
  DecisionOutcome,
} from '../../domain/entities/ApprovalFlow.js';

export interface NewApprovalFlowInput {
  companyId: number;
  docKind: ApprovalDocKind;
  docId: number;
  projectId: number | null;
  mode: ApprovalMode;
  minApprovals: number | null;
  title: string | null;
  note: string | null;
  createdBy: number | null;
  /** Onaycılar sıra numarasıyla; sıra dizinin kendi sırasından türetilir. */
  approvers: ReadonlyArray<{ approverUserId: number; dueDate: string | null }>;
}

/** cs_v_approval_flow_summary satırı — belge satırındaki "N/M" göstergesi. */
export interface ApprovalFlowSummary {
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
  /** Sıralı modda sıradaki onaycı; sırasızda null. */
  currentApproverUserId: number | null;
  nextDueDate: string | null;
  /** Kapanmış akışta null — tamamlanmış işi geç göstermek yanıltır. */
  daysOverdue: number | null;
}

/** cs_v_my_pending_approvals satırı — "bana atanan onaylar" kutusu. */
export interface PendingApprovalRow {
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

export interface ApprovalHistoryRow {
  id: number;
  flowId: number;
  stepId: number | null;
  action: string;
  actor: number | null;
  note: string | null;
  createdAt: string;
}

export interface ListFlowsFilter {
  docKind?: ApprovalDocKind;
  docId?: number;
  projectId?: number;
  status?: ApprovalStatus;
  /** true ise yalnız gecikmiş (bekleyen ve bitiş tarihi geçmiş) akışlar. */
  overdueOnly?: boolean;
}

export interface ApprovalRepository {
  /** Akışı + adımlarını + 'created' geçmiş satırını tek transaction'da kurar. */
  insert(input: NewApprovalFlowInput): Promise<ApprovalFlow>;
  findById(id: number, companyId: number): Promise<ApprovalFlow | null>;
  /** Belgenin AKTİF (pending) akışı; yoksa null. */
  findActiveByDoc(
    companyId: number,
    docKind: ApprovalDocKind,
    docId: number,
  ): Promise<ApprovalFlow | null>;
  /**
   * Karar sonucunu yazar: adım kararı + atlanan adımlar + akış durumu + geçmiş
   * satırı, hepsi tek transaction'da. Kısmi yazım denetim izini bozar.
   */
  applyDecision(outcome: DecisionOutcome, actor: number | null): Promise<void>;
  /** Akışı iptal eder (bekleyen adımlar 'skipped'). */
  cancel(flow: ApprovalFlow, actor: number | null): Promise<void>;

  listSummaries(
    companyId: number,
    filter?: ListFlowsFilter,
  ): Promise<ReadonlyArray<ApprovalFlowSummary>>;
  summaryFor(flowId: number, companyId: number): Promise<ApprovalFlowSummary | null>;
  /** Birden çok belgenin özetini tek sorguda — liste ekranlarının N+1'ini önler. */
  summariesForDocs(
    companyId: number,
    docKind: ApprovalDocKind,
    docIds: ReadonlyArray<number>,
  ): Promise<ReadonlyArray<ApprovalFlowSummary>>;

  listPendingForUser(companyId: number, userId: number): Promise<ReadonlyArray<PendingApprovalRow>>;
  history(flowId: number, companyId: number): Promise<ReadonlyArray<ApprovalHistoryRow>>;
}
