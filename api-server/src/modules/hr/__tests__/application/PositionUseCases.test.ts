import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DepartmentNotFoundError,
  PositionNotFoundError,
} from '../../application/errors/HrErrors.js';
import { ClosePositionUseCase } from '../../application/useCases/ClosePositionUseCase.js';
import { CreateDepartmentUseCase } from '../../application/useCases/CreateDepartmentUseCase.js';
import { CreatePositionUseCase } from '../../application/useCases/CreatePositionUseCase.js';
import { ListPositionsUseCase } from '../../application/useCases/ListPositionsUseCase.js';
import { UpdatePositionUseCase } from '../../application/useCases/UpdatePositionUseCase.js';
import { InvalidPositionTransitionError } from '../../domain/valueObjects/PositionStatus.js';

import { makeFakeHrContext } from './fakes.js';

const COMPANY = 1;
const ACTOR = { actorUserId: 99, actorUsername: 'admin' };

async function setupDept(ctx: ReturnType<typeof makeFakeHrContext>) {
  return new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit).execute({
    ...ACTOR,
    companyId: COMPANY,
    orgUnitId: null,
    name: 'IT',
    code: null,
  });
}

describe('CreatePositionUseCase', () => {
  it('happy: draft default ile pozisyon oluşur', async () => {
    const ctx = makeFakeHrContext();
    const d = await setupDept(ctx);
    const uc = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const p = await uc.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      title: 'Dev',
    });
    assert.equal(p.title, 'Dev');
    assert.equal(p.status, 'draft');
    assert.equal(p.headcountTarget, 1);
    assert.equal(ctx.audit.findByAction('hr.position.created').length, 1);
  });

  it('happy: departmentId=null kabul (organizasyon-bağımsız)', async () => {
    const ctx = makeFakeHrContext();
    const uc = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const p = await uc.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: null,
      title: 'Generic',
    });
    assert.equal(p.departmentId, null);
  });

  it('edge: olmayan departmentId → DepartmentNotFoundError', async () => {
    const ctx = makeFakeHrContext();
    const uc = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    await assert.rejects(
      uc.execute({ ...ACTOR, companyId: COMPANY, departmentId: 999, title: 'X' }),
      (e: unknown) => e instanceof DepartmentNotFoundError,
    );
  });
});

describe('UpdatePositionUseCase', () => {
  it('happy: title + headcount güncellenir', async () => {
    const ctx = makeFakeHrContext();
    const d = await setupDept(ctx);
    const create = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const update = new UpdatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const p = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      title: 'A',
    });
    const r = await update.execute({
      ...ACTOR,
      companyId: COMPANY,
      id: p.id,
      title: 'B',
      headcountTarget: 3,
    });
    assert.equal(r.title, 'B');
    assert.equal(r.headcountTarget, 3);
  });

  it('happy: draft → open transition', async () => {
    const ctx = makeFakeHrContext();
    const d = await setupDept(ctx);
    const create = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const update = new UpdatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const p = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      title: 'X',
    });
    const r = await update.execute({ ...ACTOR, companyId: COMPANY, id: p.id, status: 'open' });
    assert.equal(r.status, 'open');
  });

  it('edge: open → draft YASAK', async () => {
    const ctx = makeFakeHrContext();
    const d = await setupDept(ctx);
    const create = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const update = new UpdatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const p = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      title: 'X',
      status: 'open',
    });
    await assert.rejects(
      update.execute({ ...ACTOR, companyId: COMPANY, id: p.id, status: 'draft' }),
      (e: unknown) => e instanceof InvalidPositionTransitionError,
    );
  });

  it('edge: olmayan id → NotFound', async () => {
    const ctx = makeFakeHrContext();
    const update = new UpdatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    await assert.rejects(
      update.execute({ ...ACTOR, companyId: COMPANY, id: 999, title: 'X' }),
      (e: unknown) => e instanceof PositionNotFoundError,
    );
  });
});

describe('ClosePositionUseCase', () => {
  it('happy: open → closed', async () => {
    const ctx = makeFakeHrContext();
    const d = await setupDept(ctx);
    const create = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const close = new ClosePositionUseCase(ctx.positions, ctx.clock, ctx.audit);
    const p = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      title: 'X',
      status: 'open',
    });
    const r = await close.execute({ ...ACTOR, companyId: COMPANY, id: p.id });
    assert.equal(r.status, 'closed');
  });

  it('edge: zaten closed ise no-op', async () => {
    const ctx = makeFakeHrContext();
    const d = await setupDept(ctx);
    const create = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const close = new ClosePositionUseCase(ctx.positions, ctx.clock, ctx.audit);
    const p = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      title: 'X',
      status: 'closed',
    });
    ctx.audit.clear();
    await close.execute({ ...ACTOR, companyId: COMPANY, id: p.id });
    assert.equal(ctx.audit.findByAction('hr.position.closed').length, 0);
  });

  it('edge: olmayan id → NotFound', async () => {
    const ctx = makeFakeHrContext();
    const close = new ClosePositionUseCase(ctx.positions, ctx.clock, ctx.audit);
    await assert.rejects(
      close.execute({ ...ACTOR, companyId: COMPANY, id: 999 }),
      (e: unknown) => e instanceof PositionNotFoundError,
    );
  });
});

describe('ListPositionsUseCase', () => {
  it('happy: filter status=open', async () => {
    const ctx = makeFakeHrContext();
    const d = await setupDept(ctx);
    const create = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const list = new ListPositionsUseCase(ctx.positions);

    await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      title: 'A',
      status: 'open',
    });
    await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      title: 'B',
      status: 'draft',
    });
    await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      title: 'C',
      status: 'open',
    });

    const opens = await list.execute({ companyId: COMPANY, status: 'open' });
    assert.equal(opens.length, 2);
    assert.ok(opens.every((p) => p.status === 'open'));
  });

  it('happy: filter yoksa hepsi döner', async () => {
    const ctx = makeFakeHrContext();
    const d = await setupDept(ctx);
    const create = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const list = new ListPositionsUseCase(ctx.positions);

    await create.execute({ ...ACTOR, companyId: COMPANY, departmentId: d.id, title: 'A' });
    await create.execute({ ...ACTOR, companyId: COMPANY, departmentId: d.id, title: 'B' });

    const all = await list.execute({ companyId: COMPANY });
    assert.equal(all.length, 2);
  });

  it('edge: farklı şirket pozisyonları görünmez (izolasyon)', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreatePositionUseCase(ctx.positions, ctx.departments, ctx.clock, ctx.audit);
    const list = new ListPositionsUseCase(ctx.positions);

    await create.execute({ ...ACTOR, companyId: 2, departmentId: null, title: 'Other' });
    const ours = await list.execute({ companyId: COMPANY });
    assert.equal(ours.length, 0);
  });
});
