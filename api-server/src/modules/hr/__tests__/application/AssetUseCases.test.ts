import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AssetNotAssignedError,
  AssetNotAvailableError,
  AssetNotFoundError,
  EmployeeNotFoundError,
} from '../../application/errors/HrErrors.js';
import { AssignAssetUseCase } from '../../application/useCases/AssignAssetUseCase.js';
import { CreateAssetUseCase } from '../../application/useCases/CreateAssetUseCase.js';
import { CreateDepartmentUseCase } from '../../application/useCases/CreateDepartmentUseCase.js';
import { GetAssetUseCase } from '../../application/useCases/GetAssetUseCase.js';
import { HireEmployeeUseCase } from '../../application/useCases/HireEmployeeUseCase.js';
import { ListAssetsUseCase } from '../../application/useCases/ListAssetsUseCase.js';
import { ReturnAssetUseCase } from '../../application/useCases/ReturnAssetUseCase.js';
import { UpdateAssetUseCase } from '../../application/useCases/UpdateAssetUseCase.js';
import { SequentialEmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';

import { makeFakeHrContext } from './fakes.js';

const COMPANY = 1;
const ACTOR = { actorUserId: 99, actorUsername: 'admin' };
const HIRE_DATE = '2026-01-15';

interface Tools {
  ctx: ReturnType<typeof makeFakeHrContext>;
  create: CreateAssetUseCase;
  update: UpdateAssetUseCase;
  assign: AssignAssetUseCase;
  ret: ReturnAssetUseCase;
  list: ListAssetsUseCase;
  get: GetAssetUseCase;
}

async function setup(): Promise<{ tools: Tools; employeeId: number }> {
  const ctx = makeFakeHrContext();
  let seq = 0;
  const empNoGen = new SequentialEmployeeNumberGenerator(async () => ++seq);
  const dept = await new CreateDepartmentUseCase(
    ctx.departments,
    ctx.orgUnits,
    ctx.clock,
    ctx.audit,
  ).execute({ ...ACTOR, companyId: COMPANY, orgUnitId: null, name: 'IT', code: null });
  const employee = await new HireEmployeeUseCase(
    ctx.employees,
    ctx.departments,
    ctx.positions,
    ctx.users,
    empNoGen,
    ctx.clock,
    ctx.audit,
  ).execute({
    ...ACTOR,
    companyId: COMPANY,
    departmentId: dept.id,
    positionId: null,
    firstName: 'Ali',
    lastName: 'Veli',
    hireDate: HIRE_DATE,
  });
  const tools: Tools = {
    ctx,
    create: new CreateAssetUseCase(ctx.assets, ctx.clock, ctx.audit),
    update: new UpdateAssetUseCase(ctx.assets, ctx.clock, ctx.audit),
    assign: new AssignAssetUseCase(ctx.assets, ctx.employees, ctx.clock, ctx.audit),
    ret: new ReturnAssetUseCase(ctx.assets, ctx.clock, ctx.audit),
    list: new ListAssetsUseCase(ctx.assets),
    get: new GetAssetUseCase(ctx.assets),
  };
  return { tools, employeeId: employee.id };
}

describe('CreateAssetUseCase', () => {
  it('happy: in_stock + atanmamış olarak oluşur + audit', async () => {
    const { tools } = await setup();
    const asset = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'MacBook Pro 14',
      brand: 'Apple',
    });
    assert.equal(asset.status, 'in_stock');
    assert.equal(asset.assignedEmployeeId, null);
    assert.equal(asset.assetType, 'laptop');
    assert.equal(asset.brand, 'Apple');
    assert.equal(tools.ctx.audit.findByAction('hr.asset.created').length, 1);
  });
});

describe('UpdateAssetUseCase', () => {
  it('happy: metadata değişir + audit', async () => {
    const { tools } = await setup();
    const created = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'Eski ad',
    });
    const updated = await tools.update.execute({
      ...ACTOR,
      companyId: COMPANY,
      id: created.id,
      name: 'Yeni ad',
      notes: 'kontrol edildi',
    });
    assert.equal(updated.name, 'Yeni ad');
    assert.equal(updated.notes, 'kontrol edildi');
    assert.equal(tools.ctx.audit.findByAction('hr.asset.updated').length, 1);
  });

  it('edge: değişiklik yoksa audit yazmaz', async () => {
    const { tools } = await setup();
    const created = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'Sabit',
    });
    await tools.update.execute({ ...ACTOR, companyId: COMPANY, id: created.id, name: 'Sabit' });
    assert.equal(tools.ctx.audit.findByAction('hr.asset.updated').length, 0);
  });

  it('edge: olmayan varlık → AssetNotFoundError', async () => {
    const { tools } = await setup();
    await assert.rejects(
      tools.update.execute({ ...ACTOR, companyId: COMPANY, id: 999, name: 'X' }),
      (e: unknown) => e instanceof AssetNotFoundError,
    );
  });
});

describe('AssignAssetUseCase', () => {
  it('happy: in_stock → assigned + ledger açılır + audit', async () => {
    const { tools, employeeId } = await setup();
    const created = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'Dizüstü',
    });
    const assigned = await tools.assign.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetId: created.id,
      employeeId,
    });
    assert.equal(assigned.status, 'assigned');
    assert.equal(assigned.assignedEmployeeId, employeeId);
    const ledger = await tools.ctx.assets.listAssignments({
      companyId: COMPANY,
      assetId: created.id,
    });
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]!.returnedAt, null);
    assert.equal(tools.ctx.audit.findByAction('hr.asset.assigned').length, 1);
  });

  it('edge: zaten zimmetli varlık → AssetNotAvailableError', async () => {
    const { tools, employeeId } = await setup();
    const created = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'Dizüstü',
    });
    await tools.assign.execute({ ...ACTOR, companyId: COMPANY, assetId: created.id, employeeId });
    await assert.rejects(
      tools.assign.execute({ ...ACTOR, companyId: COMPANY, assetId: created.id, employeeId }),
      (e: unknown) => e instanceof AssetNotAvailableError,
    );
  });

  it('edge: olmayan çalışan → EmployeeNotFoundError', async () => {
    const { tools } = await setup();
    const created = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'Dizüstü',
    });
    await assert.rejects(
      tools.assign.execute({ ...ACTOR, companyId: COMPANY, assetId: created.id, employeeId: 999 }),
      (e: unknown) => e instanceof EmployeeNotFoundError,
    );
  });

  it('edge: olmayan varlık → AssetNotFoundError', async () => {
    const { tools, employeeId } = await setup();
    await assert.rejects(
      tools.assign.execute({ ...ACTOR, companyId: COMPANY, assetId: 999, employeeId }),
      (e: unknown) => e instanceof AssetNotFoundError,
    );
  });
});

describe('ReturnAssetUseCase', () => {
  it('happy: assigned → in_stock + ledger kapanır + audit', async () => {
    const { tools, employeeId } = await setup();
    const created = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'Dizüstü',
    });
    await tools.assign.execute({ ...ACTOR, companyId: COMPANY, assetId: created.id, employeeId });
    const returned = await tools.ret.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetId: created.id,
      returnNote: 'sağlam',
    });
    assert.equal(returned.status, 'in_stock');
    assert.equal(returned.assignedEmployeeId, null);
    const ledger = await tools.ctx.assets.listAssignments({
      companyId: COMPANY,
      assetId: created.id,
    });
    assert.equal(ledger.length, 1);
    assert.notEqual(ledger[0]!.returnedAt, null);
    assert.equal(ledger[0]!.returnNote, 'sağlam');
    assert.equal(tools.ctx.audit.findByAction('hr.asset.returned').length, 1);
  });

  it('edge: in_stock varlığı iade → AssetNotAssignedError', async () => {
    const { tools } = await setup();
    const created = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'Dizüstü',
    });
    await assert.rejects(
      tools.ret.execute({ ...ACTOR, companyId: COMPANY, assetId: created.id }),
      (e: unknown) => e instanceof AssetNotAssignedError,
    );
  });

  it('happy: assign → return → tekrar assign akışı çalışır (ledger 2 satır)', async () => {
    const { tools, employeeId } = await setup();
    const created = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'Dizüstü',
    });
    await tools.assign.execute({ ...ACTOR, companyId: COMPANY, assetId: created.id, employeeId });
    await tools.ret.execute({ ...ACTOR, companyId: COMPANY, assetId: created.id });
    const reassigned = await tools.assign.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetId: created.id,
      employeeId,
    });
    assert.equal(reassigned.status, 'assigned');
    const ledger = await tools.ctx.assets.listAssignments({
      companyId: COMPANY,
      assetId: created.id,
    });
    assert.equal(ledger.length, 2);
    const open = await tools.ctx.assets.findOpenAssignmentForAsset(created.id, COMPANY);
    assert.notEqual(open, null);
  });
});

describe('ListAssetsUseCase', () => {
  it('happy: status filtresi ile süzer', async () => {
    const { tools, employeeId } = await setup();
    const a1 = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'A1',
    });
    await tools.create.execute({ ...ACTOR, companyId: COMPANY, assetType: 'phone', name: 'A2' });
    await tools.assign.execute({ ...ACTOR, companyId: COMPANY, assetId: a1.id, employeeId });

    const inStock = await tools.list.execute({ companyId: COMPANY, status: 'in_stock' });
    assert.equal(inStock.length, 1);
    assert.equal(inStock[0]!.name, 'A2');

    const assigned = await tools.list.execute({ companyId: COMPANY, status: 'assigned' });
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0]!.name, 'A1');
  });

  it('edge: şirket izolasyonu — başka şirketin varlığını listelemez', async () => {
    const { tools } = await setup();
    await tools.create.execute({ ...ACTOR, companyId: COMPANY, assetType: 'laptop', name: 'A1' });
    const other = await tools.list.execute({ companyId: 2 });
    assert.equal(other.length, 0);
  });
});

describe('GetAssetUseCase', () => {
  it('happy: varlık + atama geçmişini döner', async () => {
    const { tools, employeeId } = await setup();
    const created = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      assetType: 'laptop',
      name: 'Dizüstü',
    });
    await tools.assign.execute({ ...ACTOR, companyId: COMPANY, assetId: created.id, employeeId });
    const result = await tools.get.execute({ companyId: COMPANY, assetId: created.id });
    assert.equal(result.asset.id, created.id);
    assert.equal(result.assignments.length, 1);
    assert.equal(result.assignments[0]!.employeeId, employeeId);
  });

  it('edge: olmayan varlık → AssetNotFoundError', async () => {
    const { tools } = await setup();
    await assert.rejects(
      tools.get.execute({ companyId: COMPANY, assetId: 999 }),
      (e: unknown) => e instanceof AssetNotFoundError,
    );
  });
});
