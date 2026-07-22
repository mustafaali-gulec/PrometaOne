import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DepartmentHasActiveEmployeesError,
  DepartmentNotFoundError,
  EmployeeNotFoundError,
  OrgUnitNotFoundError,
} from '../../application/errors/HrErrors.js';
import { ArchiveDepartmentUseCase } from '../../application/useCases/ArchiveDepartmentUseCase.js';
import { AssignDepartmentManagerUseCase } from '../../application/useCases/AssignDepartmentManagerUseCase.js';
import { CreateDepartmentUseCase } from '../../application/useCases/CreateDepartmentUseCase.js';
import { CreateOrgUnitUseCase } from '../../application/useCases/CreateOrgUnitUseCase.js';
import { HireEmployeeUseCase } from '../../application/useCases/HireEmployeeUseCase.js';
import { ListDepartmentsForCompanyUseCase } from '../../application/useCases/ListDepartmentsForCompanyUseCase.js';
import { UpdateDepartmentUseCase } from '../../application/useCases/UpdateDepartmentUseCase.js';
import { SequentialEmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';

import { makeFakeHrContext } from './fakes.js';

const COMPANY = 1;
const ACTOR = { actorUserId: 99, actorUsername: 'admin' };

function setupOrgRoot(ctx: ReturnType<typeof makeFakeHrContext>) {
  return new CreateOrgUnitUseCase(ctx.orgUnits, ctx.clock, ctx.audit).execute({
    ...ACTOR,
    companyId: COMPANY,
    parentId: null,
    name: 'HQ',
    code: null,
  });
}

describe('CreateDepartmentUseCase', () => {
  it('happy: orgUnit altına departman', async () => {
    const ctx = makeFakeHrContext();
    const ou = await setupOrgRoot(ctx);
    const uc = new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    const d = await uc.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: ou.id,
      name: 'Finans',
      code: 'FIN',
    });
    assert.equal(d.name, 'Finans');
    assert.equal(d.orgUnitId, ou.id);
    assert.equal(d.code, 'FIN');
    assert.equal(ctx.audit.findByAction('hr.department.created').length, 1);
  });

  it('happy: orgUnitId=null kabul', async () => {
    const ctx = makeFakeHrContext();
    const uc = new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    const d = await uc.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: null,
      name: 'IT',
      code: null,
    });
    assert.equal(d.orgUnitId, null);
  });

  it('edge: olmayan orgUnitId → OrgUnitNotFoundError', async () => {
    const ctx = makeFakeHrContext();
    const uc = new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    await assert.rejects(
      uc.execute({ ...ACTOR, companyId: COMPANY, orgUnitId: 999, name: 'X', code: null }),
      (e: unknown) => e instanceof OrgUnitNotFoundError,
    );
  });
});

describe('UpdateDepartmentUseCase', () => {
  it('happy: name + code güncellenir', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    const update = new UpdateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    const d = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: null,
      name: 'A',
      code: null,
    });
    const updated = await update.execute({
      ...ACTOR,
      companyId: COMPANY,
      id: d.id,
      name: 'B',
      code: 'BX',
    });
    assert.equal(updated.name, 'B');
    assert.equal(updated.code, 'BX');
  });

  it('edge: olmayan id → NotFound', async () => {
    const ctx = makeFakeHrContext();
    const update = new UpdateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    await assert.rejects(
      update.execute({ ...ACTOR, companyId: COMPANY, id: 999, name: 'X' }),
      (e: unknown) => e instanceof DepartmentNotFoundError,
    );
  });
});

describe('ArchiveDepartmentUseCase', () => {
  it('happy: çalışanı olmayan dept arşivlenir', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    const archive = new ArchiveDepartmentUseCase(ctx.departments, ctx.clock, ctx.audit);
    const d = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: null,
      name: 'A',
      code: null,
    });
    const r = await archive.execute({ ...ACTOR, companyId: COMPANY, id: d.id });
    assert.equal(r.active, false);
  });

  it('edge: aktif çalışanı olan dept arşivlenemez', async () => {
    const ctx = makeFakeHrContext();
    let seq = 0;
    const empNoGen = new SequentialEmployeeNumberGenerator(async () => ++seq);
    const create = new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    const archive = new ArchiveDepartmentUseCase(ctx.departments, ctx.clock, ctx.audit);
    const hire = new HireEmployeeUseCase(
      ctx.employees,
      ctx.departments,
      ctx.positions,
      ctx.users,
      empNoGen,
      ctx.clock,
      ctx.audit,
    );
    const d = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: null,
      name: 'A',
      code: null,
    });
    await hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      positionId: null,
      firstName: 'Ali',
      lastName: 'V.',
      hireDate: '2026-01-15',
    });
    await assert.rejects(
      archive.execute({ ...ACTOR, companyId: COMPANY, id: d.id }),
      (e: unknown) => e instanceof DepartmentHasActiveEmployeesError,
    );
  });

  it('edge: olmayan id → NotFound', async () => {
    const ctx = makeFakeHrContext();
    const archive = new ArchiveDepartmentUseCase(ctx.departments, ctx.clock, ctx.audit);
    await assert.rejects(
      archive.execute({ ...ACTOR, companyId: COMPANY, id: 999 }),
      (e: unknown) => e instanceof DepartmentNotFoundError,
    );
  });
});

describe('AssignDepartmentManagerUseCase', () => {
  it('happy: aktif Employee manager olur', async () => {
    const ctx = makeFakeHrContext();
    let seq = 0;
    const empNoGen = new SequentialEmployeeNumberGenerator(async () => ++seq);
    const create = new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    const hire = new HireEmployeeUseCase(
      ctx.employees,
      ctx.departments,
      ctx.positions,
      ctx.users,
      empNoGen,
      ctx.clock,
      ctx.audit,
    );
    const assign = new AssignDepartmentManagerUseCase(
      ctx.departments,
      ctx.employees,
      ctx.clock,
      ctx.audit,
    );
    const d = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: null,
      name: 'A',
      code: null,
    });
    const e = await hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      positionId: null,
      firstName: 'Mgr',
      lastName: 'X',
      hireDate: '2026-01-15',
    });
    const result = await assign.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      employeeId: e.id,
    });
    assert.equal(result.managerEmployeeId, e.id);
    assert.equal(ctx.audit.findByAction('hr.department.manager_assigned').length, 1);
  });

  it('edge: olmayan employee → EmployeeNotFoundError', async () => {
    const ctx = makeFakeHrContext();
    const create = new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    const assign = new AssignDepartmentManagerUseCase(
      ctx.departments,
      ctx.employees,
      ctx.clock,
      ctx.audit,
    );
    const d = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: null,
      name: 'A',
      code: null,
    });
    await assert.rejects(
      assign.execute({ ...ACTOR, companyId: COMPANY, departmentId: d.id, employeeId: 999 }),
      (e: unknown) => e instanceof EmployeeNotFoundError,
    );
  });

  it('happy: employeeId=null → manager bağı kopar', async () => {
    const ctx = makeFakeHrContext();
    let seq = 0;
    const empNoGen = new SequentialEmployeeNumberGenerator(async () => ++seq);
    const create = new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    const hire = new HireEmployeeUseCase(
      ctx.employees,
      ctx.departments,
      ctx.positions,
      ctx.users,
      empNoGen,
      ctx.clock,
      ctx.audit,
    );
    const assign = new AssignDepartmentManagerUseCase(
      ctx.departments,
      ctx.employees,
      ctx.clock,
      ctx.audit,
    );
    const d = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: null,
      name: 'A',
      code: null,
    });
    const e = await hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      positionId: null,
      firstName: 'Mgr',
      lastName: 'X',
      hireDate: '2026-01-15',
    });
    await assign.execute({ ...ACTOR, companyId: COMPANY, departmentId: d.id, employeeId: e.id });
    const cleared = await assign.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: d.id,
      employeeId: null,
    });
    assert.equal(cleared.managerEmployeeId, null);
  });
});

describe('ListDepartmentsForCompanyUseCase', () => {
  async function seedThree(ctx: ReturnType<typeof makeFakeHrContext>) {
    const ou = await setupOrgRoot(ctx);
    const create = new CreateDepartmentUseCase(ctx.departments, ctx.orgUnits, ctx.clock, ctx.audit);
    const d1 = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: ou.id,
      name: 'Finans',
      code: 'FIN',
    });
    const d2 = await create.execute({
      ...ACTOR,
      companyId: COMPANY,
      orgUnitId: null,
      name: 'IT',
      code: null,
    });
    // Başka şirketin departmanı listeye SIZMAMALI.
    const yabanci = await create.execute({
      ...ACTOR,
      companyId: COMPANY + 1,
      orgUnitId: null,
      name: 'Yabancı',
      code: null,
    });
    return { ou, d1, d2, yabanci };
  }

  it('şirket-scoped liste: DepartmentDto alanları (orgUnitId + managerEmployeeId dahil) döner', async () => {
    const ctx = makeFakeHrContext();
    const { ou, d1 } = await seedThree(ctx);
    const uc = new ListDepartmentsForCompanyUseCase(ctx.departments);

    const list = await uc.execute({ companyId: COMPANY });

    assert.equal(list.length, 2); // yabancı şirket dışarıda
    const fin = list.find((d) => d.id === d1.id)!;
    assert.equal(fin.name, 'Finans');
    assert.equal(fin.code, 'FIN');
    assert.equal(fin.orgUnitId, ou.id);
    assert.equal(fin.managerEmployeeId, null);
    assert.equal(fin.companyId, COMPANY);
    assert.equal(fin.active, true);
    assert.equal(typeof fin.createdAt, 'string');
  });

  it('öndeğer yalnız aktifler; includeInactive=true arşivlileri de döner; orgUnitId filtresi uygulanır', async () => {
    const ctx = makeFakeHrContext();
    const { ou, d1, d2 } = await seedThree(ctx);
    const archive = new ArchiveDepartmentUseCase(ctx.departments, ctx.clock, ctx.audit);
    await archive.execute({ ...ACTOR, companyId: COMPANY, id: d2.id });
    const uc = new ListDepartmentsForCompanyUseCase(ctx.departments);

    const actives = await uc.execute({ companyId: COMPANY });
    assert.deepEqual(
      actives.map((d) => d.id),
      [d1.id],
    );

    const all = await uc.execute({ companyId: COMPANY, includeInactive: true });
    assert.equal(all.length, 2);

    const scoped = await uc.execute({ companyId: COMPANY, orgUnitId: ou.id });
    assert.deepEqual(
      scoped.map((d) => d.id),
      [d1.id],
    );
  });
});
