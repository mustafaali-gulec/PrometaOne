import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CandidateHasActiveApplicationsError,
  CandidateNotFoundError,
} from '../../application/errors/HrErrors.js';
import { CreateDepartmentUseCase } from '../../application/useCases/CreateDepartmentUseCase.js';
import { CreatePositionUseCase } from '../../application/useCases/CreatePositionUseCase.js';
import { DeleteCandidateUseCase } from '../../application/useCases/DeleteCandidateUseCase.js';
import { ListCandidatesUseCase } from '../../application/useCases/ListCandidatesUseCase.js';
import { RegisterCandidateUseCase } from '../../application/useCases/RegisterCandidateUseCase.js';
import { SubmitApplicationUseCase } from '../../application/useCases/SubmitApplicationUseCase.js';
import { UpdateCandidateUseCase } from '../../application/useCases/UpdateCandidateUseCase.js';

import { makeFakeHrContext } from './fakes.js';

const COMPANY = 1;
const ACTOR = { actorUserId: 99, actorUsername: 'admin' };

describe('RegisterCandidateUseCase', () => {
  it('happy: aday kaydolur', async () => {
    const ctx = makeFakeHrContext();
    const uc = new RegisterCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    const c = await uc.execute({
      ...ACTOR,
      companyId: COMPANY,
      firstName: 'Ali',
      lastName: 'Veli',
      email: 'ali@example.com',
      source: 'linkedin',
    });
    assert.equal(c.fullName, 'Ali Veli');
    assert.equal(c.source, 'linkedin');
    assert.equal(ctx.audit.findByAction('hr.candidate.registered').length, 1);
  });

  it('happy: phone normalize edilir', async () => {
    const ctx = makeFakeHrContext();
    const uc = new RegisterCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    const c = await uc.execute({
      ...ACTOR,
      companyId: COMPANY,
      firstName: 'A',
      lastName: 'B',
      phone: '0532 999 88 77',
    });
    assert.equal(c.phone, '+905329998877');
  });

  it('default source = direct', async () => {
    const ctx = makeFakeHrContext();
    const uc = new RegisterCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    const c = await uc.execute({ ...ACTOR, companyId: COMPANY, firstName: 'A', lastName: 'B' });
    assert.equal(c.source, 'direct');
  });
});

describe('UpdateCandidateUseCase', () => {
  it('happy: source güncellenir', async () => {
    const ctx = makeFakeHrContext();
    const reg = new RegisterCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    const update = new UpdateCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    const c = await reg.execute({ ...ACTOR, companyId: COMPANY, firstName: 'A', lastName: 'B' });
    const r = await update.execute({
      ...ACTOR,
      companyId: COMPANY,
      id: c.id,
      source: 'referral',
    });
    assert.equal(r.source, 'referral');
  });

  it('edge: olmayan id → CandidateNotFoundError', async () => {
    const ctx = makeFakeHrContext();
    const update = new UpdateCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    await assert.rejects(
      update.execute({ ...ACTOR, companyId: COMPANY, id: 999, firstName: 'X' }),
      (e: unknown) => e instanceof CandidateNotFoundError,
    );
  });
});

describe('DeleteCandidateUseCase', () => {
  it('happy: aktif başvurusu olmayan aday silinir', async () => {
    const ctx = makeFakeHrContext();
    const reg = new RegisterCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    const del = new DeleteCandidateUseCase(ctx.candidates, ctx.applications, ctx.clock, ctx.audit);
    const c = await reg.execute({ ...ACTOR, companyId: COMPANY, firstName: 'A', lastName: 'B' });
    await del.execute({ ...ACTOR, companyId: COMPANY, id: c.id });
    assert.equal(ctx.audit.findByAction('hr.candidate.deleted').length, 1);
  });

  it('edge: aktif başvurusu olan aday silinemez', async () => {
    const ctx = makeFakeHrContext();
    const reg = new RegisterCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    const del = new DeleteCandidateUseCase(ctx.candidates, ctx.applications, ctx.clock, ctx.audit);
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
    const submit = new SubmitApplicationUseCase(
      ctx.applications,
      ctx.candidates,
      ctx.positions,
      ctx.clock,
      ctx.audit,
    );

    const c = await reg.execute({ ...ACTOR, companyId: COMPANY, firstName: 'A', lastName: 'B' });
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
    await submit.execute({
      ...ACTOR,
      companyId: COMPANY,
      candidateId: c.id,
      positionId: pos.id,
    });

    await assert.rejects(
      del.execute({ ...ACTOR, companyId: COMPANY, id: c.id }),
      (e: unknown) => e instanceof CandidateHasActiveApplicationsError,
    );
  });

  it('edge: olmayan id → NotFound', async () => {
    const ctx = makeFakeHrContext();
    const del = new DeleteCandidateUseCase(ctx.candidates, ctx.applications, ctx.clock, ctx.audit);
    await assert.rejects(
      del.execute({ ...ACTOR, companyId: COMPANY, id: 999 }),
      (e: unknown) => e instanceof CandidateNotFoundError,
    );
  });
});

describe('ListCandidatesUseCase', () => {
  it('happy: q ile arama', async () => {
    const ctx = makeFakeHrContext();
    const reg = new RegisterCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    const list = new ListCandidatesUseCase(ctx.candidates);
    await reg.execute({
      ...ACTOR,
      companyId: COMPANY,
      firstName: 'Mehmet',
      lastName: 'Demir',
    });
    await reg.execute({
      ...ACTOR,
      companyId: COMPANY,
      firstName: 'Ayşe',
      lastName: 'Yıldız',
    });
    const r = await list.execute({ companyId: COMPANY, q: 'demir' });
    assert.equal(r.length, 1);
    assert.equal(r[0]!.fullName, 'Mehmet Demir');
  });

  it('happy: source filter', async () => {
    const ctx = makeFakeHrContext();
    const reg = new RegisterCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    const list = new ListCandidatesUseCase(ctx.candidates);
    await reg.execute({
      ...ACTOR,
      companyId: COMPANY,
      firstName: 'A',
      lastName: 'B',
      source: 'linkedin',
    });
    await reg.execute({
      ...ACTOR,
      companyId: COMPANY,
      firstName: 'C',
      lastName: 'D',
      source: 'referral',
    });
    const onlyLinkedin = await list.execute({ companyId: COMPANY, source: 'linkedin' });
    assert.equal(onlyLinkedin.length, 1);
  });

  it('edge: izolasyon — farklı şirket görünmez', async () => {
    const ctx = makeFakeHrContext();
    const reg = new RegisterCandidateUseCase(ctx.candidates, ctx.clock, ctx.audit);
    const list = new ListCandidatesUseCase(ctx.candidates);
    await reg.execute({ ...ACTOR, companyId: 2, firstName: 'Other', lastName: 'Co' });
    const ours = await list.execute({ companyId: COMPANY });
    assert.equal(ours.length, 0);
  });
});
