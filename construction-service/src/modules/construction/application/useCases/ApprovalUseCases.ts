/**
 * Jenerik onay akışı use-case'leri (FAZ 5).
 *
 * BELGEYİ İLERLETME SORUMLULUĞU BU MODÜLDE DEĞİL. Akış tamamlandığında
 * `approval` konusuna bir domain olayı yayınlanır (`completed`) ve belgenin
 * kendi durum makinesi bunu dinler. Alternatif — akış motorunun 10 belge tipinin
 * durum geçişlerini bilmesi — motoru her şeye bağlardı ve her yeni belge tipi
 * motoru değiştirmek demek olurdu. Olay seam'i modülde zaten var
 * (hakediş→muhasebe fişi aynı yolu kullanıyor).
 */
import type { ApprovalDocKind, ApprovalMode } from '../../domain/entities/ApprovalFlow.js';
import {
  ApprovalFlowNotFoundError,
  ConstructionValidationError,
  DuplicateApprovalFlowError,
} from '../../domain/errors/ConstructionErrors.js';
import { toApprovalFlowDto, type ApprovalFlowDto } from '../dto/ApprovalDtos.js';
import type {
  ApprovalFlowSummary,
  ApprovalHistoryRow,
  ApprovalRepository,
  ListFlowsFilter,
  PendingApprovalRow,
} from '../ports/ApprovalRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { EventPublisher } from '../ports/EventPublisher.js';

export interface StartApprovalInput {
  companyId: number;
  docKind: ApprovalDocKind;
  docId: number;
  projectId?: number | null | undefined;
  mode?: ApprovalMode | undefined;
  minApprovals?: number | null | undefined;
  title?: string | null | undefined;
  note?: string | null | undefined;
  createdBy?: number | null | undefined;
  approvers: ReadonlyArray<{ approverUserId: number; dueDate?: string | null | undefined }>;
}

export class StartApprovalFlowUseCase {
  constructor(private readonly approvals: ApprovalRepository) {}

  async execute(input: StartApprovalInput): Promise<ApprovalFlowDto> {
    if (input.approvers.length === 0) {
      throw new ConstructionValidationError('onay akışı en az bir onaycı gerektirir');
    }
    const ids = new Set(input.approvers.map((a) => a.approverUserId));
    if (ids.size !== input.approvers.length) {
      throw new ConstructionValidationError('aynı kullanıcı akışta iki kez onaycı olamaz');
    }
    if (
      input.minApprovals !== null &&
      input.minApprovals !== undefined &&
      input.minApprovals > input.approvers.length
    ) {
      throw new ConstructionValidationError(
        `gereken onay sayısı (${String(input.minApprovals)}) onaycı sayısından (${String(input.approvers.length)}) fazla olamaz`,
      );
    }

    // Aynı belgede iki aktif akış olamaz: "onay sırası 2/3" göstergesi hangi
    // akışı gösterdiği belirsiz hale gelir ve iki akış çelişik karar üretebilir.
    const existing = await this.approvals.findActiveByDoc(
      input.companyId,
      input.docKind,
      input.docId,
    );
    if (existing) throw new DuplicateApprovalFlowError(input.docKind, input.docId);

    const flow = await this.approvals.insert({
      companyId: input.companyId,
      docKind: input.docKind,
      docId: input.docId,
      projectId: input.projectId ?? null,
      mode: input.mode ?? 'ordered',
      minApprovals: input.minApprovals ?? null,
      title: input.title?.trim() || null,
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
      approvers: input.approvers.map((a) => ({
        approverUserId: a.approverUserId,
        dueDate: a.dueDate ?? null,
      })),
    });
    return toApprovalFlowDto(flow);
  }
}

export interface DecideApprovalInput {
  companyId: number;
  stepId: number;
  flowId: number;
  approve: boolean;
  actorUserId?: number | null | undefined;
  comment?: string | null | undefined;
}

export interface DecideApprovalResult {
  flow: ApprovalFlowDto;
  /** Akış bu kararla kapandı mı? */
  completed: boolean;
}

export class DecideApprovalStepUseCase {
  constructor(
    private readonly approvals: ApprovalRepository,
    private readonly clock: Clock,
    private readonly events: EventPublisher,
  ) {}

  async execute(input: DecideApprovalInput): Promise<DecideApprovalResult> {
    const flow = await this.approvals.findById(input.flowId, input.companyId);
    if (!flow) throw new ApprovalFlowNotFoundError(input.flowId);

    const outcome = flow.decide(
      input.stepId,
      input.approve,
      input.actorUserId ?? null,
      this.clock.now(),
      input.comment ?? null,
    );
    await this.approvals.applyDecision(outcome, input.actorUserId ?? null);

    // Akış kapandıysa belgeyi ilerletme sorumluluğu dinleyicide. Yayın hatası
    // iş akışını kırmaz (EventPublisher sözleşmesi).
    if (outcome.completed) {
      await this.events.publish({
        topic: 'approval',
        key: `${outcome.flow.docKind}:${String(outcome.flow.docId)}`,
        type: 'completed',
        payload: {
          flowId: outcome.flow.id,
          companyId: outcome.flow.companyId,
          docKind: outcome.flow.docKind,
          docId: outcome.flow.docId,
          projectId: outcome.flow.projectId,
          status: outcome.flow.status,
          approvedCount: outcome.flow.approvedCount,
          requiredCount: outcome.flow.requiredCount,
          decidedBy: input.actorUserId ?? null,
        },
      });
    }

    return { flow: toApprovalFlowDto(outcome.flow), completed: outcome.completed };
  }
}

export class CancelApprovalFlowUseCase {
  constructor(
    private readonly approvals: ApprovalRepository,
    private readonly clock: Clock,
    private readonly events: EventPublisher,
  ) {}

  async execute(input: {
    companyId: number;
    flowId: number;
    actorUserId?: number | null | undefined;
  }): Promise<ApprovalFlowDto> {
    const flow = await this.approvals.findById(input.flowId, input.companyId);
    if (!flow) throw new ApprovalFlowNotFoundError(input.flowId);
    const cancelled = flow.cancel(this.clock.now());
    await this.approvals.cancel(cancelled, input.actorUserId ?? null);

    await this.events.publish({
      topic: 'approval',
      key: `${cancelled.docKind}:${String(cancelled.docId)}`,
      type: 'cancelled',
      payload: {
        flowId: cancelled.id,
        companyId: cancelled.companyId,
        docKind: cancelled.docKind,
        docId: cancelled.docId,
        cancelledBy: input.actorUserId ?? null,
      },
    });
    return toApprovalFlowDto(cancelled);
  }
}

export class GetApprovalFlowUseCase {
  constructor(private readonly approvals: ApprovalRepository) {}

  async execute(input: { companyId: number; flowId: number }): Promise<ApprovalFlowDto> {
    const flow = await this.approvals.findById(input.flowId, input.companyId);
    if (!flow) throw new ApprovalFlowNotFoundError(input.flowId);
    return toApprovalFlowDto(flow);
  }
}

/** Belgenin aktif akışı; yoksa null (hata değil — çoğu belgede akış yoktur). */
export class GetDocApprovalUseCase {
  constructor(private readonly approvals: ApprovalRepository) {}

  async execute(input: {
    companyId: number;
    docKind: ApprovalDocKind;
    docId: number;
  }): Promise<ApprovalFlowDto | null> {
    const flow = await this.approvals.findActiveByDoc(input.companyId, input.docKind, input.docId);
    return flow === null ? null : toApprovalFlowDto(flow);
  }
}

export class ListApprovalFlowsUseCase {
  constructor(private readonly approvals: ApprovalRepository) {}

  async execute(
    input: ListFlowsFilter & { companyId: number },
  ): Promise<ReadonlyArray<ApprovalFlowSummary>> {
    const { companyId, ...filter } = input;
    return this.approvals.listSummaries(companyId, filter);
  }
}

/** Liste ekranları için: belge id kümesine karşılık gelen "N/M" özetleri. */
export class GetApprovalSummariesForDocsUseCase {
  constructor(private readonly approvals: ApprovalRepository) {}

  async execute(input: {
    companyId: number;
    docKind: ApprovalDocKind;
    docIds: ReadonlyArray<number>;
  }): Promise<ReadonlyArray<ApprovalFlowSummary>> {
    if (input.docIds.length === 0) return [];
    return this.approvals.summariesForDocs(input.companyId, input.docKind, input.docIds);
  }
}

export interface MyApprovalsDto {
  userId: number;
  /** Şimdi karar verebileceği adımlar. */
  actionable: ReadonlyArray<PendingApprovalRow>;
  /** Sıralı akışta sırası henüz gelmemiş adımlar. */
  waiting: ReadonlyArray<PendingApprovalRow>;
  /** Bitiş tarihi geçmiş bekleyen adımlar (actionable ∪ waiting içinden). */
  overdue: ReadonlyArray<PendingApprovalRow>;
  /**
   * Imperium'un panelindeki gecikme kovaları: bugün/1-7 gün/7 günden fazla.
   * Sayılar yalnız bitiş tarihi OLAN adımları kapsar; tarihsiz adım geciktirilemez.
   */
  buckets: { dueToday: number; overdue1to7: number; overdueOver7: number; noDueDate: number };
}

/**
 * "Bana atanan onaylar" kutusu. actionable/waiting ayrımı kasıtlı: sıralı akışta
 * sırası gelmemiş bir onayı "yapılacak iş" gibi göstermek kullanıcıyı boşa
 * uğraştırır, ama listeden tamamen saklamak da "bu belge bana gelecek" bilgisini
 * gizler.
 */
export class GetMyApprovalsUseCase {
  constructor(private readonly approvals: ApprovalRepository) {}

  async execute(input: { companyId: number; userId: number }): Promise<MyApprovalsDto> {
    const rows = await this.approvals.listPendingForUser(input.companyId, input.userId);
    const actionable = rows.filter((r) => r.actionable);
    const waiting = rows.filter((r) => !r.actionable);
    const overdue = rows.filter((r) => (r.daysOverdue ?? 0) > 0);

    const buckets = { dueToday: 0, overdue1to7: 0, overdueOver7: 0, noDueDate: 0 };
    for (const r of rows) {
      if (r.dueDate === null) buckets.noDueDate += 1;
      else if ((r.daysOverdue ?? 0) === 0) buckets.dueToday += 1;
      else if ((r.daysOverdue ?? 0) <= 7) buckets.overdue1to7 += 1;
      else buckets.overdueOver7 += 1;
    }

    return { userId: input.userId, actionable, waiting, overdue, buckets };
  }
}

export class GetApprovalHistoryUseCase {
  constructor(private readonly approvals: ApprovalRepository) {}

  async execute(input: {
    companyId: number;
    flowId: number;
  }): Promise<ReadonlyArray<ApprovalHistoryRow>> {
    const flow = await this.approvals.findById(input.flowId, input.companyId);
    if (!flow) throw new ApprovalFlowNotFoundError(input.flowId);
    return this.approvals.history(input.flowId, input.companyId);
  }
}
