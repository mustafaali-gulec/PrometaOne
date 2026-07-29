/**
 * ApprovalFlow — jenerik onay akışı (FAZ 5).
 * Tablolar: cs_approval_flows, cs_approval_steps (009_approval_flow.sql)
 *
 * Akış, adımlarıyla birlikte TEK AGREGAT olarak yüklenir: "sıra kimde",
 * "yeterli onay toplandı mı", "red terminal mi" sorularının hepsi adımların
 * tümüne bakmayı gerektirir. Adımı ayrı agregat yapmak bu kararları veritabanı
 * sorgularına dağıtır ve tutarsızlığa açar.
 *
 * KARAR KURALLARI (hepsi burada, tek yerde):
 *   ordered   → yalnız en küçük seq_no'lu bekleyen adım karar verebilir
 *   unordered → bekleyen her adım karar verebilir
 *   red       → TERMİNAL; kalan adımlar 'skipped' olur, akış 'rejected'
 *   onay      → gereken sayıya ulaşıldıysa akış 'approved', kalanlar 'skipped'
 *
 * Red'in terminal olması şantiye için güvenli varsayılandır: reddedilmiş bir
 * hakediş "çoğunluk onayladı" diye ilerlememelidir.
 */
import {
  ApprovalNotActionableError,
  ApprovalStepNotFoundError,
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';

export const APPROVAL_DOC_KINDS = [
  'contract',
  'progress',
  'material_request',
  'expense',
  'advance',
  'daily_log',
  'tracking',
  'boq',
  'measurement',
  'payment',
] as const;
export type ApprovalDocKind = (typeof APPROVAL_DOC_KINDS)[number];

export function isApprovalDocKind(v: unknown): v is ApprovalDocKind {
  return typeof v === 'string' && (APPROVAL_DOC_KINDS as ReadonlyArray<string>).includes(v);
}

export type ApprovalMode = 'ordered' | 'unordered';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalDecision = 'pending' | 'approved' | 'rejected' | 'skipped' | 'delegated';

export interface ApprovalStepProps {
  id: number;
  companyId: number;
  flowId: number;
  seqNo: number;
  approverUserId: number;
  dueDate: string | null;
  decision: ApprovalDecision;
  decidedAt: Date | null;
  /** Vekâleten karar verildiyse gerçek karar veren; approver'dan farklıysa vekâlet. */
  decidedBy: number | null;
  comment: string | null;
}

export interface ApprovalFlowProps {
  id: number;
  companyId: number;
  docKind: ApprovalDocKind;
  docId: number;
  projectId: number | null;
  mode: ApprovalMode;
  status: ApprovalStatus;
  /** NULL = herkes onaylamalı. Sayı = bu kadar onay yeter. */
  minApprovals: number | null;
  title: string | null;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  steps: ReadonlyArray<ApprovalStepProps>;
}

/** Bir adım kararının akışa etkisi — repository bunu yazar. */
export interface DecisionOutcome {
  flow: ApprovalFlow;
  /** Karar verilen adım. */
  decidedStepId: number;
  /** Yeterli onay/red sonrası artık sorulmayacak adımlar. */
  skippedStepIds: ReadonlyArray<number>;
  /** Akış bu kararla kapandı mı? */
  completed: boolean;
}

export class ApprovalFlow {
  private constructor(private readonly props: Readonly<ApprovalFlowProps>) {}

  static create(props: ApprovalFlowProps): ApprovalFlow {
    if (props.id <= 0) throw new ConstructionValidationError('ApprovalFlow.id pozitif olmalı');
    if (props.docId <= 0)
      throw new ConstructionValidationError('ApprovalFlow.docId pozitif olmalı');
    if (props.minApprovals !== null && props.minApprovals <= 0) {
      throw new ConstructionValidationError('gereken onay sayısı pozitif olmalı');
    }
    if (props.minApprovals !== null && props.minApprovals > props.steps.length) {
      throw new ConstructionValidationError(
        `gereken onay sayısı (${String(props.minApprovals)}) onaycı sayısından (${String(props.steps.length)}) fazla olamaz`,
      );
    }
    if (props.status === 'pending' && props.completedAt !== null) {
      throw new ConstructionValidationError('bekleyen akışta tamamlanma zamanı olamaz');
    }
    if (props.status !== 'pending' && props.completedAt === null) {
      throw new ConstructionValidationError('kapanmış akışta tamamlanma zamanı zorunlu');
    }
    // Aynı kişi iki kez onaycı olamaz — "2/3 onay" sayımı bozulur
    const ids = new Set(props.steps.map((s) => s.approverUserId));
    if (ids.size !== props.steps.length) {
      throw new ConstructionValidationError('aynı kullanıcı akışta iki kez onaycı olamaz');
    }
    return new ApprovalFlow({
      ...props,
      steps: [...props.steps].sort((a, b) => a.seqNo - b.seqNo),
    });
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get docKind(): ApprovalDocKind {
    return this.props.docKind;
  }
  get docId(): number {
    return this.props.docId;
  }
  get projectId(): number | null {
    return this.props.projectId;
  }
  get mode(): ApprovalMode {
    return this.props.mode;
  }
  get status(): ApprovalStatus {
    return this.props.status;
  }
  get minApprovals(): number | null {
    return this.props.minApprovals;
  }
  get title(): string | null {
    return this.props.title;
  }
  get note(): string | null {
    return this.props.note;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
  get steps(): ReadonlyArray<ApprovalStepProps> {
    return this.props.steps;
  }

  get open(): boolean {
    return this.props.status === 'pending';
  }

  /** Gereken onay sayısı: minApprovals verilmişse o, yoksa tüm adımlar. */
  get requiredCount(): number {
    return this.props.minApprovals ?? this.props.steps.length;
  }

  get approvedCount(): number {
    return this.props.steps.filter((s) => s.decision === 'approved' || s.decision === 'delegated')
      .length;
  }

  get pendingSteps(): ReadonlyArray<ApprovalStepProps> {
    return this.props.steps.filter((s) => s.decision === 'pending');
  }

  /** Sıralı modda sıradaki onaycı; sırasız modda null (herkes aynı anda). */
  get currentApproverUserId(): number | null {
    if (this.props.mode !== 'ordered') return null;
    return this.pendingSteps[0]?.approverUserId ?? null;
  }

  /**
   * Bu adım şu anda karar verebilir mi?
   * Sıralı modda yalnız en küçük bekleyen sıra; sırasızda bekleyen her adım.
   */
  isActionable(stepId: number): boolean {
    if (!this.open) return false;
    const step = this.props.steps.find((s) => s.id === stepId);
    if (!step || step.decision !== 'pending') return false;
    if (this.props.mode === 'unordered') return true;
    return this.pendingSteps[0]?.id === stepId;
  }

  /**
   * Adıma karar uygula. Akışın yeni hâlini ve yan etkilerini döner; kalıcılığı
   * repository yapar (tek transaction).
   *
   * `actorUserId` adımın sahibinden farklıysa karar VEKÂLETEN kaydedilir
   * ('delegated'): onay yine sayılır ama izde kimin bastığı görünür. Yetki
   * denetimi route katmanında.
   */
  decide(
    stepId: number,
    approve: boolean,
    actorUserId: number | null,
    now: Date,
    comment?: string | null,
  ): DecisionOutcome {
    if (!this.open) {
      throw new InvalidStatusTransitionError(this.props.status, approve ? 'approved' : 'rejected');
    }
    const step = this.props.steps.find((s) => s.id === stepId);
    if (!step) throw new ApprovalStepNotFoundError(stepId);
    if (step.decision !== 'pending') {
      throw new ApprovalNotActionableError('bu adım için karar zaten verilmiş');
    }
    if (!this.isActionable(stepId)) {
      throw new ApprovalNotActionableError(
        'sıralı akışta sıra henüz bu onaycıda değil — önceki onaycılar beklemede',
      );
    }

    const delegated = actorUserId !== null && actorUserId !== step.approverUserId;
    const decision: ApprovalDecision = approve
      ? delegated
        ? 'delegated'
        : 'approved'
      : 'rejected';

    const decidedSteps = this.props.steps.map((s) =>
      s.id === stepId
        ? {
            ...s,
            decision,
            decidedAt: now,
            decidedBy: actorUserId,
            comment: comment?.trim() || null,
          }
        : s,
    );

    // Red TERMİNAL: kalan adımlar sorulmaz
    if (!approve) {
      const skipped = decidedSteps
        .filter((s) => s.decision === 'pending')
        .map((s): ApprovalStepProps => ({ ...s, decision: 'skipped', decidedAt: now }));
      const finalSteps = decidedSteps.map((s) => skipped.find((k) => k.id === s.id) ?? s);
      return {
        flow: new ApprovalFlow({
          ...this.props,
          status: 'rejected',
          completedAt: now,
          updatedAt: now,
          steps: finalSteps,
        }),
        decidedStepId: stepId,
        skippedStepIds: skipped.map((s) => s.id),
        completed: true,
      };
    }

    // Onay: gereken sayıya ulaşıldı mı?
    const approvedNow = decidedSteps.filter(
      (s) => s.decision === 'approved' || s.decision === 'delegated',
    ).length;

    if (approvedNow >= this.requiredCount) {
      const skipped = decidedSteps
        .filter((s) => s.decision === 'pending')
        .map((s): ApprovalStepProps => ({ ...s, decision: 'skipped', decidedAt: now }));
      const finalSteps = decidedSteps.map((s) => skipped.find((k) => k.id === s.id) ?? s);
      return {
        flow: new ApprovalFlow({
          ...this.props,
          status: 'approved',
          completedAt: now,
          updatedAt: now,
          steps: finalSteps,
        }),
        decidedStepId: stepId,
        skippedStepIds: skipped.map((s) => s.id),
        completed: true,
      };
    }

    return {
      flow: new ApprovalFlow({ ...this.props, updatedAt: now, steps: decidedSteps }),
      decidedStepId: stepId,
      skippedStepIds: [],
      completed: false,
    };
  }

  /**
   * Akışı iptal et. Bekleyen adımlar 'skipped' olur.
   * Kapanmış akış tekrar iptal edilemez — geçmişi yeniden yazmak olur.
   */
  cancel(now: Date): ApprovalFlow {
    if (!this.open) throw new InvalidStatusTransitionError(this.props.status, 'cancelled');
    return new ApprovalFlow({
      ...this.props,
      status: 'cancelled',
      completedAt: now,
      updatedAt: now,
      steps: this.props.steps.map((s) =>
        s.decision === 'pending' ? { ...s, decision: 'skipped', decidedAt: now } : s,
      ),
    });
  }

  toJSON(): Readonly<ApprovalFlowProps> {
    return { ...this.props, steps: [...this.props.steps] };
  }
}
