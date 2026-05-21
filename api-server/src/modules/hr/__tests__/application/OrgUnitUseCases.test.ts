import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OrgCycleDetectedError,
  OrgUnitHasChildrenError,
  OrgUnitNotFoundError,
} from '../../application/errors/HrErrors.js';
import { ArchiveOrgUnitUseCase } from '../../application/useCases/ArchiveOrgUnitUseCase.js';
import { CreateOrgUnitUseCase } from '../../application/useCases/CreateOrgUnitUseCase.js';
import { ListOrgTreeForCompanyUseCase } from '../../application/useCases/ListOrgTreeForCompanyUseCase.js';
import { MoveOrgUnitUseCase } from '../../application/useCases/MoveOrgUnitUseCase.js';
import { UpdateOrgUnitUseCase } from '../../application/useCases/UpdateOrgUnitUseCase.js';

import { makeFakeHrContext } from './fakes.js';

const COMPANY = 1;
const ACTOR = { actorUserId: 99, actorUsername: 'admin' };

describe('CreateOrgUnitUseCase', () => {
  it('happy: root unit oluşur, audit yazılır', async () => {
    const ctx = makeFakeHrContext();
    const uc = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);

    const dto = await uc.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'Genel Müdürlük',
      code: 'HQ',
    });

    assert.equal(dto.name, 'Genel Müdürlük');
    assert.equal(dto.parentId, null);
    assert.equal(dto.code, 'HQ');
    assert.equal(ctx.audit.findByAction('hr.org_unit.created').length, 1);
  });

  it('happy: child unit parent referansıyla oluşur', async () => {
    const ctx = makeFakeHrContext();
    const uc = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const root = await uc.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'HQ',
      code: null,
    });
    const child = await uc.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: root.id,
      name: 'Bölge',
      code: null,
    });
    assert.equal(child.parentId, root.id);
  });

  it('edge: olmayan parentId → OrgUnitNotFoundError', async () => {
    const ctx = makeFakeHrContext();
    const uc = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    await assert.rejects(
      uc.execute({ ...ACTOR, companyId: COMPANY, parentId: 9999, name: 'X', code: null }),
      (e: unknown) => e instanceof OrgUnitNotFoundError,
    );
  });

  it('edge: farklı şirketteki parent → NotFound (izolasyon)', async () => {
    const ctx = makeFakeHrContext();
    const uc = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const otherCompany = await uc.execute({
      ...ACTOR,
      companyId: 2,
      parentId: null,
      name: 'OtherHQ',
      code: null,
    });
    await assert.rejects(
      uc.execute({
        ...ACTOR,
        companyId: COMPANY,
        parentId: otherCompany.id,
        name: 'X',
        code: null,
      }),
      (e: unknown) => e instanceof OrgUnitNotFoundError,
    );
  });
});

describe('UpdateOrgUnitUseCase', () => {
  it('happy: name değişir, audit yazılır', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const update = new UpdateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const created = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'A',
      code: null,
    });
    const updated = await update.execute({
      ...ACTOR,
      companyId: COMPANY,
      id: created.id,
      name: 'B',
    });
    assert.equal(updated.name, 'B');
    assert.equal(ctx.audit.findByAction('hr.org_unit.updated').length, 1);
  });

  it('edge: olmayan id → OrgUnitNotFoundError', async () => {
    const ctx = makeFakeHrContext();
    const update = new UpdateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    await assert.rejects(
      update.execute({ ...ACTOR, companyId: COMPANY, id: 999, name: 'X' }),
      (e: unknown) => e instanceof OrgUnitNotFoundError,
    );
  });

  it('edge: hiçbir alan değişmezse audit eklenmez', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const update = new UpdateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const created = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'A',
      code: null,
    });
    ctx.audit.clear();
    await update.execute({ ...ACTOR, companyId: COMPANY, id: created.id });
    assert.equal(ctx.audit.findByAction('hr.org_unit.updated').length, 0);
  });
});

describe('MoveOrgUnitUseCase', () => {
  it('happy: parent değişir, audit yazılır', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const move = new MoveOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const a = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'A',
      code: null,
    });
    const b = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'B',
      code: null,
    });

    const moved = await move.execute({ ...ACTOR, companyId: COMPANY, id: b.id, newParentId: a.id });
    assert.equal(moved.parentId, a.id);
    assert.equal(ctx.audit.findByAction('hr.org_unit.moved').length, 1);
  });

  it('edge: cycle dedect → OrgCycleDetectedError', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const move = new MoveOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const a = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'A',
      code: null,
    });
    const b = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: a.id,
      name: 'B',
      code: null,
    });
    // A'yı B'nin altına taşımaya çalış → cycle
    await assert.rejects(
      move.execute({ ...ACTOR, companyId: COMPANY, id: a.id, newParentId: b.id }),
      (e: unknown) => e instanceof OrgCycleDetectedError,
    );
  });

  it('edge: aynı parent ise no-op (audit eklenmez)', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const move = new MoveOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const a = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'A',
      code: null,
    });
    ctx.audit.clear();
    await move.execute({ ...ACTOR, companyId: COMPANY, id: a.id, newParentId: null });
    assert.equal(ctx.audit.findByAction('hr.org_unit.moved').length, 0);
  });
});

describe('ArchiveOrgUnitUseCase', () => {
  it('happy: yaprak unit arşivlenir', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const archive = new ArchiveOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const a = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'A',
      code: null,
    });
    const r = await archive.execute({ ...ACTOR, companyId: COMPANY, id: a.id });
    assert.equal(r.active, false);
    assert.equal(ctx.audit.findByAction('hr.org_unit.archived').length, 1);
  });

  it('edge: alt birimi olan parent arşivlenemez', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const archive = new ArchiveOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const a = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'A',
      code: null,
    });
    await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: a.id,
      name: 'Child',
      code: null,
    });
    await assert.rejects(
      archive.execute({ ...ACTOR, companyId: COMPANY, id: a.id }),
      (e: unknown) => e instanceof OrgUnitHasChildrenError,
    );
  });

  it('edge: olmayan id → NotFound', async () => {
    const ctx = makeFakeHrContext();
    const archive = new ArchiveOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    await assert.rejects(
      archive.execute({ ...ACTOR, companyId: COMPANY, id: 999 }),
      (e: unknown) => e instanceof OrgUnitNotFoundError,
    );
  });
});

describe('ListOrgTreeForCompanyUseCase', () => {
  it('happy: nested ağaç döner', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const list = new ListOrgTreeForCompanyUseCase(ctx.orgUnits);
    const a = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'HQ',
      code: null,
    });
    await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: a.id,
      name: 'Child1',
      code: null,
    });
    await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: a.id,
      name: 'Child2',
      code: null,
    });

    const tree = await list.execute({ companyId: COMPANY });
    assert.equal(tree.length, 1);
    assert.equal(tree[0]!.unit.name, 'HQ');
    assert.equal(tree[0]!.children.length, 2);
  });

  it('edge: hiçbir kayıt yoksa boş ağaç', async () => {
    const ctx = makeFakeHrContext();
    const list = new ListOrgTreeForCompanyUseCase(ctx.orgUnits);
    const tree = await list.execute({ companyId: COMPANY });
    assert.deepEqual(tree, []);
  });

  it('edge: includeInactive=false default — arşivlenmiş dahil edilmez', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const archive = new ArchiveOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit);
    const list = new ListOrgTreeForCompanyUseCase(ctx.orgUnits);
    const a = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      parentId: null,
      name: 'A',
      code: null,
    });
    await archive.execute({ ...ACTOR, companyId: COMPANY, id: a.id });
    const tree = await list.execute({ companyId: COMPANY });
    assert.equal(tree.length, 0);
  });
});
