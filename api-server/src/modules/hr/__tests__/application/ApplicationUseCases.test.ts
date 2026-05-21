import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ApplicationAlreadyTerminalError,
  ApplicationNotFoundError,
  CandidateAlreadyAppliedToPositionError,
  CandidateNotFoundError,
  DepartmentNotFoundError,
  PositionNotFoundError,
  PositionNotOpenError,
} from '../../application/errors/HrErrors.js';
import { CreateDepartmentUseCase } from '../../application/useCases/CreateDepartmentUseCase.js';
import { CreatePositionUseCase } from '../../application/useCases/CreatePositionUseCase.js';
import { GetRecruitmentFunnelUseCase } from '../../application/useCases/GetRecruitmentFunnelUseCase.js';
import { HireFromApplicationUseCase } from '../../application/useCases/HireFromApplicationUseCase.js';
import { ListApplicationsForCandidateUseCase } from '../../application/useCases/ListApplicationsForCandidateUseCase.js';
import { ListApplicationsForPositionUseCase } from '../../application/useCases/ListApplicationsForPositionUseCase.js';
import { MoveApplicationStageUseCase } from '../../application/useCases/MoveApplicationStageUseCase.js';
import { RegisterCandidateUseCase } from '../../application/useCases/RegisterCandidateUseCase.js';
import { RejectApplicationUseCase } from '../../application/useCases/RejectApplicationUseCase.js';
import { SubmitApplicationUseCase } from '../../application/useCases/SubmitApplicationUseCase.js';
import { WithdrawApplicationUseCase } from '../../application/useCases/WithdrawApplicationUseCase.js';
import { SequentialEmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';
import { InvalidStageTransitionError } from '../../domain/valueObjects/RecruitmentStage.js';

import { makeFakeHrContext } from './fakes.js';

const COMPANY = 1;
const ACTOR = { actorUserId: 99, actorUsername: 'admin' };

interface Tools {
  ctx: ReturnType<typeof makeFakeHrContext>;
  register: RegisterCandidateUseCase;
  submit: SubmitApplicationUseCase;
  move: MoveApplicationStageUseCase;
  reject: RejectApplicationUseCase;
  withdraw: WithdrawApplicationUseCase;
  hire: HireFromApplicationUseCase;
  listPos: ListApplicationsForPositionUseCase;
  listCand: ListApplicationsForCandidateUseCase;
  funnel: GetRecruitmentFunnelUseCase;
  /** Convenience helper: open bir Position + bir Candidate kur. */
  setup: () => Promise<{ candidateId: number; positionId: number; departmentId: number }>;
}

function makeTools(): Tools {
  const ctx = makeFakeHrContext();
  let seq = 0;
  const empNoGen = new SequentialEmployeeNumberGenerator(async () => ++seq);

  const tools: Tools = {
    ctx,
    register: new RegisterCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit),
    submit: new SubmitApplicationUseCase(
      ctx.applications,
      ctx.candidates,
      ctx.positions,
      ctx.clock,
      ctx.audit,
    ),
    move: new MoveApplicationStageUseCase(ctx.applications, ctx.clock, ctx.audit),
    reject: new RejectApplicationUseCase(ctx.applications, ctx.clock, ctx.audit),
    withdraw: new WithdrawApplicationUseCase(ctx.applications, ctx.clock, ctx.audit),
    hire: new HireFromApplicationUseCase(
      ctx.applications,
      ctx.candidates,
      ctx.departments,
      ctx.employees,
      empNoGen,
      ctx.clock,
      ctx.audit,
    ),
    listPos: new ListApplicationsForPositionUseCase(ctx.applications),
    listCand: new ListApplicationsForCandidateUseCase(ctx.applications),
    funnel: new GetRecruitmentFunnelUseCase(ctx.applications),
    setup: async () => {
      const createDept = new CreateDepartmentUseCase(
        ctx.departments,
        ctx.orgUnits,
        ctx.clock,
        ctx.audit,
      );
      const createPos = new CreatePositionUseCase(
        ctx.positions,
        ctx.departments,
        ctx.clock,
        ctx.audit,
      );
      const dept = await createDept.execute({
        ...ACTOR,
        companyId: COMPANY,
        orgUnitId: null,
        name: 'IT',
        code: null,
      });
      const pos = await createPos.execute({
        ...ACTOR,
        companyId: COMPANY,
        departmentId: dept.id,
        title: 'Dev',
        status: 'open',
      });
      const cand = await tools.register.execute({
        ...ACTOR,
        companyId: COMPANY,
        firstName: 'Ali',
        lastName: 'Veli',
        email: 'ali@example.com',
        source: 'linkedin',
      });
      return { candidateId: cand.id, positionId: pos.id, departmentId: dept.id };
    },
  };
  return tools;
}

describe('SubmitApplicationUseCase', () => {
  it('happy: open pozisyona başvuru, stage new', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    const app = await t.submit.execute({
      ...ACTOR,
      companyId: COMPANY,
      candidateId,
      positionId,
    });
    assert.equal(app.stage, 'new');
    assert.equal(app.candidateId, candidateId);
    assert.equal(app.positionId, positionId);
    assert.equal(t.ctx.audit.findByAction('hr.application.submitted').length, 1);
  });

  it('edge: olmayan candidate → CandidateNotFoundError', async () => {
    const t = makeTools();
    const { positionId } = await t.setup();
    await assert.rejects(
      t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId: 999, positionId }),
      (e: unknown) => e instanceof CandidateNotFoundError,
    );
  });

  it('edge: olmayan pozisyon → PositionNotFoundError', async () => {
    const t = makeTools();
    const { candidateId } = await t.setup();
    await assert.rejects(
      t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId: 999 }),
      (e: unknown) => e instanceof PositionNotFoundError,
    );
  });

  it('edge: draft pozisyona başvuru → PositionNotOpenError', async () => {
    const t = makeTools();
    const ctx = t.ctx;
    const createDept = new CreateDepartmentUseCase(
      ctx.departments,
      ctx.orgUnits,
      ctx.clock,
      ctx.audit,
    );
    const createPos = new CreatePositionUseCase(
      ctx.positions,
      ctx.departments,
      ctx.clock,
      ctx.audit,
    );
    const dept = await createDept.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: null,
      name: 'IT',
      code: null,
    });
    const pos = await createPos.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: dept.id,
      title: 'Dev',
      status: 'draft',
    });
    const cand = await t.register.execute({
      ...ACTOR,
      companyId: COMPANY,
      firstName: 'A',
      lastName: 'B',
    });
    await assert.rejects(
      t.submit.execute({
        ...ACTOR,
        companyId: COMPANY,
        candidateId: cand.id,
        positionId: pos.id,
      }),
      (e: unknown) => e instanceof PositionNotOpenError,
    );
  });

  it('edge: aynı candidate aynı pozisyona iki kez aktif başvuramaz', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    await assert.rejects(
      t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId }),
      (e: unknown) => e instanceof CandidateAlreadyAppliedToPositionError,
    );
  });
});

describe('MoveApplicationStageUseCase', () => {
  it('happy: new → screening → interview → offer', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    let r = await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'screening',
    });
    assert.equal(r.stage, 'screening');
    r = await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'interview',
    });
    assert.equal(r.stage, 'interview');
    r = await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'offer',
    });
    assert.equal(r.stage, 'offer');
  });

  it('edge: yasal olmayan geçiş → InvalidStageTransitionError', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    await assert.rejects(
      t.move.execute({
        ...ACTOR,
        companyId: COMPANY,
        applicationId: app.id,
        newStage: 'hired',
      }),
      (e: unknown) => e instanceof InvalidStageTransitionError,
    );
  });

  it('edge: olmayan id → ApplicationNotFoundError', async () => {
    const t = makeTools();
    await assert.rejects(
      t.move.execute({ ...ACTOR, companyId: COMPANY, applicationId: 999, newStage: 'screening' }),
      (e: unknown) => e instanceof ApplicationNotFoundError,
    );
  });

  it('history kaydı oluşur (trigger taklidi)', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'screening',
    });
    const history = await t.ctx.stageHistory.findByApplication(app.id);
    // 1: INSERT (null→new), 2: screening (new→screening)
    assert.equal(history.length, 2);
    assert.equal(history[0]!.toStage, 'new');
    assert.equal(history[1]!.fromStage, 'new');
    assert.equal(history[1]!.toStage, 'screening');
  });
});

describe('RejectApplicationUseCase', () => {
  it('happy: rejection reason kaydedilir', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    const r = await t.reject.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      reason: 'pozisyon uygun değil',
    });
    assert.equal(r.stage, 'rejected');
    assert.equal(r.rejectionReason, 'pozisyon uygun değil');
  });

  it('edge: olmayan id', async () => {
    const t = makeTools();
    await assert.rejects(
      t.reject.execute({ ...ACTOR, companyId: COMPANY, applicationId: 999, reason: 'x' }),
      (e: unknown) => e instanceof ApplicationNotFoundError,
    );
  });
});

describe('WithdrawApplicationUseCase', () => {
  it('happy: withdrawn olur', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    const r = await t.withdraw.execute({ ...ACTOR, companyId: COMPANY, applicationId: app.id });
    assert.equal(r.stage, 'withdrawn');
  });

  it('happy: withdrawn sonrası aynı pozisyona yeniden başvuru mümkün', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    await t.withdraw.execute({ ...ACTOR, companyId: COMPANY, applicationId: app.id });
    // İkinci başvuru: aktif başvuru yok artık
    const app2 = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    assert.equal(app2.stage, 'new');
    assert.notEqual(app.id, app2.id);
  });
});

describe('HireFromApplicationUseCase (ATOMIK)', () => {
  it('happy: offer → hired + Employee otomatik üretilir', async () => {
    const t = makeTools();
    const { candidateId, positionId, departmentId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'screening',
    });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'interview',
    });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'offer',
    });

    const emp = await t.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      departmentId,
      hireDate: '2026-06-01',
    });

    // Employee oluştu
    assert.equal(emp.firstName, 'Ali');
    assert.equal(emp.lastName, 'Veli');
    assert.equal(emp.positionId, positionId);
    assert.equal(emp.departmentId, departmentId);
    assert.equal(emp.email, 'ali@example.com');
    assert.equal(emp.sourceApplicationId, app.id);

    // Application 'hired'a geçti
    const after = await t.ctx.applications.findById(app.id, COMPANY);
    assert.equal(after?.stage, 'hired');
    assert.equal(after?.isTerminal(), true);

    // Audit
    assert.equal(t.ctx.audit.findByAction('hr.application.hired').length, 1);
  });

  it('edge: stage offer değil → InvalidStageTransitionError', async () => {
    const t = makeTools();
    const { candidateId, positionId, departmentId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    // hâlâ 'new' stage'inde
    await assert.rejects(
      t.hire.execute({
        ...ACTOR,
        companyId: COMPANY,
        applicationId: app.id,
        departmentId,
        hireDate: '2026-06-01',
      }),
      (e: unknown) => e instanceof InvalidStageTransitionError,
    );
  });

  it('edge: terminal application → ApplicationAlreadyTerminalError', async () => {
    const t = makeTools();
    const { candidateId, positionId, departmentId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    await t.reject.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      reason: 'x',
    });
    await assert.rejects(
      t.hire.execute({
        ...ACTOR,
        companyId: COMPANY,
        applicationId: app.id,
        departmentId,
        hireDate: '2026-06-01',
      }),
      (e: unknown) => e instanceof ApplicationAlreadyTerminalError,
    );
  });

  it('edge: olmayan department → DepartmentNotFoundError', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'screening',
    });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'interview',
    });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'offer',
    });
    await assert.rejects(
      t.hire.execute({
        ...ACTOR,
        companyId: COMPANY,
        applicationId: app.id,
        departmentId: 999,
        hireDate: '2026-06-01',
      }),
      (e: unknown) => e instanceof DepartmentNotFoundError,
    );
  });

  it('atomik: Employee insert hata fırlatırsa Application "hired" rollback olur', async () => {
    const t = makeTools();
    const { candidateId, positionId, departmentId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'screening',
    });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'interview',
    });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'offer',
    });

    // Aynı employeeNo'yu önceden başka birine ver — çakışma yarat
    const otherCand = await t.register.execute({
      ...ACTOR,
      companyId: COMPANY,
      firstName: 'X',
      lastName: 'Y',
    });
    const otherApp = await t.submit.execute({
      ...ACTOR,
      companyId: COMPANY,
      candidateId: otherCand.id,
      positionId,
    });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: otherApp.id,
      newStage: 'screening',
    });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: otherApp.id,
      newStage: 'interview',
    });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: otherApp.id,
      newStage: 'offer',
    });
    await t.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: otherApp.id,
      departmentId,
      employeeNo: 'PRM-001',
      hireDate: '2026-06-01',
    });

    // Şimdi `app`'i aynı employeeNo ile hire etmeye çalış → çakışma → rollback
    await assert.rejects(
      t.hire.execute({
        ...ACTOR,
        companyId: COMPANY,
        applicationId: app.id,
        departmentId,
        employeeNo: 'PRM-001',
        hireDate: '2026-06-01',
      }),
    );

    // app rollback: hâlâ offer aşamasında olmalı
    const after = await t.ctx.applications.findById(app.id, COMPANY);
    assert.equal(after?.stage, 'offer', 'Employee oluşamadıysa Application rollback');
  });
});

describe('ListApplicationsForPosition / ListApplicationsForCandidate', () => {
  it('listPos: pozisyon bazlı', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    const list = await t.listPos.execute({ companyId: COMPANY, positionId });
    assert.equal(list.length, 1);
  });

  it('listPos: stage filter', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    const app = await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: app.id,
      newStage: 'screening',
    });
    const newOnly = await t.listPos.execute({ companyId: COMPANY, positionId, stage: 'new' });
    assert.equal(newOnly.length, 0);
    const screening = await t.listPos.execute({
      companyId: COMPANY,
      positionId,
      stage: 'screening',
    });
    assert.equal(screening.length, 1);
  });

  it('listCand: candidate bazlı', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    const list = await t.listCand.execute({ companyId: COMPANY, candidateId });
    assert.equal(list.length, 1);
  });
});

describe('GetRecruitmentFunnelUseCase', () => {
  it('happy: stage başına sayım', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    // 1 başvuru new'de bırak
    await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    // İkinci aday → screening
    const c2 = await t.register.execute({
      ...ACTOR,
      companyId: COMPANY,
      firstName: 'B',
      lastName: 'C',
    });
    const a2 = await t.submit.execute({
      ...ACTOR,
      companyId: COMPANY,
      candidateId: c2.id,
      positionId,
    });
    await t.move.execute({
      ...ACTOR,
      companyId: COMPANY,
      applicationId: a2.id,
      newStage: 'screening',
    });

    const funnel = await t.funnel.execute({ companyId: COMPANY, positionId });
    assert.equal(funnel.counts.new, 1);
    assert.equal(funnel.counts.screening, 1);
    assert.equal(funnel.positionId, positionId);
  });

  it('happy: positionId verilmezse genel sayım', async () => {
    const t = makeTools();
    const { candidateId, positionId } = await t.setup();
    await t.submit.execute({ ...ACTOR, companyId: COMPANY, candidateId, positionId });
    const funnel = await t.funnel.execute({ companyId: COMPANY });
    assert.equal(funnel.positionId, null);
    assert.equal(funnel.counts.new, 1);
  });
});
