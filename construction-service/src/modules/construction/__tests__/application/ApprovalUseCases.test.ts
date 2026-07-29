/**
 * Jenerik onay akışı (FAZ 5) testleri.
 *
 * Odak: sıralı/sırasız mod farkı, red'in terminal olması, min_approvals ile
 * kısmi onay, vekâleten karar izi, tek-aktif-akış kuralı ve "bana atanan
 * onaylar" kova sayımı.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type {
  ApprovalFlowSummary,
  ApprovalHistoryRow,
  ApprovalRepository,
  ListFlowsFilter,
  NewApprovalFlowInput,
  PendingApprovalRow,
} from '../../application/ports/ApprovalRepository.js';
import {
  CancelApprovalFlowUseCase,
  DecideApprovalStepUseCase,
  GetMyApprovalsUseCase,
  StartApprovalFlowUseCase,
} from '../../application/useCases/ApprovalUseCases.js';
import {
  ApprovalFlow,
  type ApprovalDocKind,
  type ApprovalStepProps,
  type DecisionOutcome,
} from '../../domain/entities/ApprovalFlow.js';
import {
  ApprovalNotActionableError,
  ConstructionValidationError,
  DuplicateApprovalFlowError,
  InvalidStatusTransitionError,
} from '../../domain/errors/ConstructionErrors.js';
import { FakeEventPublisher, FixedClock } from '../fakes.js';

const NOW = new Date('2026-07-28T10:00:00.000Z');

function step(
  over: Partial<ApprovalStepProps> & { id: number; seqNo: number; approverUserId: number },
): ApprovalStepProps {
  return {
    companyId: 1,
    flowId: 1,
    dueDate: null,
    decision: 'pending',
    decidedAt: null,
    decidedBy: null,
    comment: null,
    ...over,
  };
}

function flow(over: Partial<Parameters<typeof ApprovalFlow.create>[0]> = {}): ApprovalFlow {
  return ApprovalFlow.create({
    id: 1,
    companyId: 1,
    docKind: 'progress',
    docId: 10,
    projectId: 5,
    mode: 'ordered',
    status: 'pending',
    minApprovals: null,
    title: 'Hakediş onayı',
    note: null,
    createdBy: 99,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    steps: [
      step({ id: 1, seqNo: 1, approverUserId: 11 }),
      step({ id: 2, seqNo: 2, approverUserId: 22 }),
      step({ id: 3, seqNo: 3, approverUserId: 33 }),
    ],
    ...over,
  });
}

// ===== DOMAIN ===============================================================

describe('ApprovalFlow invariantları', () => {
  it('gereken onay sayısı onaycı sayısından fazla olamaz', () => {
    assert.throws(() => flow({ minApprovals: 5 }), /onaycı sayısından/);
  });
  it('aynı kullanıcı iki kez onaycı olamaz', () => {
    assert.throws(
      () =>
        flow({
          steps: [
            step({ id: 1, seqNo: 1, approverUserId: 11 }),
            step({ id: 2, seqNo: 2, approverUserId: 11 }),
          ],
        }),
      /iki kez onaycı/,
    );
  });
  it('kapanmış akışta tamamlanma zamanı zorunlu', () => {
    assert.throws(
      () => flow({ status: 'approved', completedAt: null }),
      /tamamlanma zamanı zorunlu/,
    );
  });
  it('bekleyen akışta tamamlanma zamanı olamaz', () => {
    assert.throws(() => flow({ completedAt: NOW }), /bekleyen akışta tamamlanma/);
  });
  it('gereken onay sayısı: minApprovals yoksa tüm adımlar', () => {
    assert.equal(flow().requiredCount, 3);
    assert.equal(flow({ minApprovals: 2 }).requiredCount, 2);
  });
});

describe('sıralı mod', () => {
  it('yalnız en küçük bekleyen sıra eyleme geçebilir', () => {
    const f = flow();
    assert.ok(f.isActionable(1));
    assert.ok(!f.isActionable(2));
    assert.ok(!f.isActionable(3));
    assert.equal(f.currentApproverUserId, 11);
  });

  it('sırası gelmemiş adım karar veremez', () => {
    assert.throws(() => flow().decide(2, true, 22, NOW), ApprovalNotActionableError);
  });

  it('ilk onaydan sonra sıra ikinciye geçer', () => {
    const out = flow().decide(1, true, 11, NOW);
    assert.equal(out.completed, false);
    assert.equal(out.flow.status, 'pending');
    assert.equal(out.flow.currentApproverUserId, 22);
    assert.equal(out.flow.approvedCount, 1);
  });

  it('son onay akışı tamamlar ve atlanan adım kalmaz', () => {
    let f = flow();
    f = f.decide(1, true, 11, NOW).flow;
    f = f.decide(2, true, 22, NOW).flow;
    const out = f.decide(3, true, 33, NOW);
    assert.equal(out.completed, true);
    assert.equal(out.flow.status, 'approved');
    assert.deepEqual([...out.skippedStepIds], []);
    assert.notEqual(out.flow.completedAt, null);
  });
});

describe('sırasız mod', () => {
  it('bekleyen her adım eyleme geçebilir, sıradaki onaycı null', () => {
    const f = flow({ mode: 'unordered' });
    assert.ok(f.isActionable(1));
    assert.ok(f.isActionable(3));
    assert.equal(f.currentApproverUserId, null);
  });

  it('üçüncü onaycı ilk karar verebilir', () => {
    const out = flow({ mode: 'unordered' }).decide(3, true, 33, NOW);
    assert.equal(out.completed, false);
    assert.equal(out.flow.approvedCount, 1);
  });
});

describe('red terminaldir', () => {
  it('bir red akışı reddeder ve kalan adımlar atlanır', () => {
    const out = flow().decide(1, false, 11, NOW, 'Metraj hatalı');
    assert.equal(out.completed, true);
    assert.equal(out.flow.status, 'rejected');
    assert.deepEqual(
      [...out.skippedStepIds].sort((a, b) => a - b),
      [2, 3],
    );
    const rejected = out.flow.steps.find((s) => s.id === 1);
    assert.equal(rejected?.decision, 'rejected');
    assert.equal(rejected?.comment, 'Metraj hatalı');
    assert.equal(out.flow.steps.find((s) => s.id === 2)?.decision, 'skipped');
  });

  it('çoğunluk onaylamış olsa bile red akışı reddeder', () => {
    // 3 onaycıdan 2'si yeter; biri onayladı, ikincisi reddetti
    let f = flow({ mode: 'unordered', minApprovals: 2 });
    f = f.decide(1, true, 11, NOW).flow;
    const out = f.decide(2, false, 22, NOW);
    assert.equal(out.flow.status, 'rejected');
  });

  it('kapanmış akışta karar verilemez', () => {
    const out = flow().decide(1, false, 11, NOW);
    assert.throws(() => out.flow.decide(2, true, 22, NOW), InvalidStatusTransitionError);
  });
});

describe('min_approvals ile kısmi onay', () => {
  it('gereken sayıya ulaşınca akış onaylanır, kalanlar atlanır', () => {
    let f = flow({ mode: 'unordered', minApprovals: 2 });
    f = f.decide(1, true, 11, NOW).flow;
    const out = f.decide(3, true, 33, NOW);
    assert.equal(out.completed, true);
    assert.equal(out.flow.status, 'approved');
    // 2. adım hiç sorulmadan atlanır
    assert.deepEqual([...out.skippedStepIds], [2]);
    assert.equal(out.flow.steps.find((s) => s.id === 2)?.decision, 'skipped');
  });
});

describe('vekâleten karar', () => {
  it('başkası adına onay "delegated" olarak işaretlenir ama onay sayılır', () => {
    const out = flow().decide(1, true, 999, NOW);
    const s = out.flow.steps.find((x) => x.id === 1);
    assert.equal(s?.decision, 'delegated');
    assert.equal(s?.decidedBy, 999);
    // Vekâleten onay da onay sayılır
    assert.equal(out.flow.approvedCount, 1);
  });

  it('kendi adımına onay "approved" olur', () => {
    const out = flow().decide(1, true, 11, NOW);
    assert.equal(out.flow.steps.find((x) => x.id === 1)?.decision, 'approved');
  });
});

describe('iptal', () => {
  it('bekleyen adımlar atlanır, akış iptal olur', () => {
    const c = flow().cancel(NOW);
    assert.equal(c.status, 'cancelled');
    assert.ok(c.steps.every((s) => s.decision === 'skipped'));
    assert.notEqual(c.completedAt, null);
  });
  it('kapanmış akış tekrar iptal edilemez', () => {
    const c = flow().cancel(NOW);
    assert.throws(() => c.cancel(NOW), InvalidStatusTransitionError);
  });
});

// ===== USE-CASE'LER =========================================================

class FakeApprovalRepository implements ApprovalRepository {
  private seq = 0;
  private stepSeq = 0;
  flows = new Map<number, ApprovalFlow>();
  pending: PendingApprovalRow[] = [];
  appliedOutcomes: DecisionOutcome[] = [];

  async insert(input: NewApprovalFlowInput): Promise<ApprovalFlow> {
    this.seq += 1;
    const id = this.seq;
    const steps = input.approvers.map((a, i) => {
      this.stepSeq += 1;
      return step({
        id: this.stepSeq,
        seqNo: i + 1,
        approverUserId: a.approverUserId,
        flowId: id,
        dueDate: a.dueDate,
      });
    });
    const f = ApprovalFlow.create({
      id,
      companyId: input.companyId,
      docKind: input.docKind,
      docId: input.docId,
      projectId: input.projectId,
      mode: input.mode,
      status: 'pending',
      minApprovals: input.minApprovals,
      title: input.title,
      note: input.note,
      createdBy: input.createdBy,
      createdAt: NOW,
      updatedAt: NOW,
      completedAt: null,
      steps,
    });
    this.flows.set(id, f);
    return Promise.resolve(f);
  }

  async findById(id: number, companyId: number): Promise<ApprovalFlow | null> {
    const f = this.flows.get(id);
    return Promise.resolve(f && f.companyId === companyId ? f : null);
  }

  async findActiveByDoc(
    companyId: number,
    docKind: ApprovalDocKind,
    docId: number,
  ): Promise<ApprovalFlow | null> {
    return Promise.resolve(
      [...this.flows.values()].find(
        (f) =>
          f.companyId === companyId &&
          f.docKind === docKind &&
          f.docId === docId &&
          f.status === 'pending',
      ) ?? null,
    );
  }

  async applyDecision(outcome: DecisionOutcome): Promise<void> {
    this.appliedOutcomes.push(outcome);
    this.flows.set(outcome.flow.id, outcome.flow);
    return Promise.resolve();
  }

  async cancel(f: ApprovalFlow): Promise<void> {
    this.flows.set(f.id, f);
    return Promise.resolve();
  }

  async listSummaries(
    _companyId: number,
    _filter?: ListFlowsFilter,
  ): Promise<ReadonlyArray<ApprovalFlowSummary>> {
    return Promise.resolve([]);
  }
  async summaryFor(): Promise<ApprovalFlowSummary | null> {
    return Promise.resolve(null);
  }
  async summariesForDocs(): Promise<ReadonlyArray<ApprovalFlowSummary>> {
    return Promise.resolve([]);
  }
  async listPendingForUser(
    _companyId: number,
    userId: number,
  ): Promise<ReadonlyArray<PendingApprovalRow>> {
    return Promise.resolve(this.pending.filter((p) => p.approverUserId === userId));
  }
  async history(): Promise<ReadonlyArray<ApprovalHistoryRow>> {
    return Promise.resolve([]);
  }
}

describe('ApprovalUseCases', () => {
  let repo: FakeApprovalRepository;
  let clock: FixedClock;
  let events: FakeEventPublisher;

  beforeEach(() => {
    repo = new FakeApprovalRepository();
    clock = new FixedClock(NOW);
    events = new FakeEventPublisher();
  });

  it('onaycısız akış kurulamaz', async () => {
    await assert.rejects(
      () =>
        new StartApprovalFlowUseCase(repo).execute({
          companyId: 1,
          docKind: 'progress',
          docId: 10,
          approvers: [],
        }),
      /en az bir onaycı/,
    );
  });

  it('aynı belgede iki aktif akış kurulamaz', async () => {
    const uc = new StartApprovalFlowUseCase(repo);
    await uc.execute({
      companyId: 1,
      docKind: 'progress',
      docId: 10,
      approvers: [{ approverUserId: 11 }],
    });
    await assert.rejects(
      () =>
        uc.execute({
          companyId: 1,
          docKind: 'progress',
          docId: 10,
          approvers: [{ approverUserId: 22 }],
        }),
      DuplicateApprovalFlowError,
    );
  });

  it('kapanmış akıştan sonra aynı belgede yeni akış kurulabilir', async () => {
    const uc = new StartApprovalFlowUseCase(repo);
    const first = await uc.execute({
      companyId: 1,
      docKind: 'progress',
      docId: 10,
      approvers: [{ approverUserId: 11 }],
    });
    await new CancelApprovalFlowUseCase(repo, clock, events).execute({
      companyId: 1,
      flowId: first.id,
      actorUserId: 99,
    });
    const second = await uc.execute({
      companyId: 1,
      docKind: 'progress',
      docId: 10,
      approvers: [{ approverUserId: 22 }],
    });
    assert.notEqual(second.id, first.id);
  });

  it('gereken onay sayısı onaycı sayısını aşarsa reddedilir', async () => {
    await assert.rejects(
      () =>
        new StartApprovalFlowUseCase(repo).execute({
          companyId: 1,
          docKind: 'expense',
          docId: 1,
          minApprovals: 3,
          approvers: [{ approverUserId: 11 }],
        }),
      ConstructionValidationError,
    );
  });

  it('akış tamamlanınca "approval.completed" olayı yayınlanır', async () => {
    const created = await new StartApprovalFlowUseCase(repo).execute({
      companyId: 1,
      docKind: 'progress',
      docId: 10,
      projectId: 5,
      approvers: [{ approverUserId: 11 }],
    });
    const res = await new DecideApprovalStepUseCase(repo, clock, events).execute({
      companyId: 1,
      flowId: created.id,
      stepId: created.steps[0]!.id,
      approve: true,
      actorUserId: 11,
    });
    assert.equal(res.completed, true);
    assert.equal(res.flow.status, 'approved');
    assert.equal(events.events.length, 1);
    const ev = events.events[0]!;
    assert.equal(ev.topic, 'approval');
    assert.equal(ev.type, 'completed');
    assert.equal(ev.payload.docKind, 'progress');
    assert.equal(ev.payload.docId, 10);
    assert.equal(ev.payload.status, 'approved');
  });

  it('akış tamamlanmadıysa olay YAYINLANMAZ', async () => {
    const created = await new StartApprovalFlowUseCase(repo).execute({
      companyId: 1,
      docKind: 'progress',
      docId: 10,
      approvers: [{ approverUserId: 11 }, { approverUserId: 22 }],
    });
    const res = await new DecideApprovalStepUseCase(repo, clock, events).execute({
      companyId: 1,
      flowId: created.id,
      stepId: created.steps[0]!.id,
      approve: true,
      actorUserId: 11,
    });
    assert.equal(res.completed, false);
    assert.equal(events.events.length, 0);
  });

  describe('bana atanan onaylar', () => {
    const row = (over: Partial<PendingApprovalRow>): PendingApprovalRow => ({
      stepId: 1,
      approverUserId: 11,
      seqNo: 1,
      dueDate: '2026-07-28',
      flowId: 1,
      docKind: 'progress',
      docId: 10,
      projectId: 5,
      mode: 'ordered',
      title: null,
      flowCreatedAt: NOW.toISOString(),
      actionable: true,
      daysOverdue: 0,
      ...over,
    });

    it('actionable / waiting ayrımı ve gecikme kovaları', async () => {
      repo.pending = [
        row({ stepId: 1, actionable: true, daysOverdue: 0 }),
        row({ stepId: 2, actionable: false, daysOverdue: 3 }),
        row({ stepId: 3, actionable: true, daysOverdue: 12 }),
        row({ stepId: 4, actionable: true, dueDate: null, daysOverdue: null }),
      ];
      const res = await new GetMyApprovalsUseCase(repo).execute({ companyId: 1, userId: 11 });
      assert.equal(res.actionable.length, 3);
      assert.equal(res.waiting.length, 1);
      assert.equal(res.overdue.length, 2);
      assert.deepEqual(res.buckets, {
        dueToday: 1,
        overdue1to7: 1,
        overdueOver7: 1,
        noDueDate: 1,
      });
    });

    it('başka kullanıcının onayları görünmez', async () => {
      repo.pending = [row({ approverUserId: 22 })];
      const res = await new GetMyApprovalsUseCase(repo).execute({ companyId: 1, userId: 11 });
      assert.equal(res.actionable.length, 0);
      assert.equal(res.waiting.length, 0);
    });
  });
});
