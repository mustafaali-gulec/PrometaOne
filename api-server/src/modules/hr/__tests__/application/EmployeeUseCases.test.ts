import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DepartmentNotFoundError,
  EmployeeAlreadyLinkedError,
  EmployeeAlreadyTerminatedError,
  EmployeeNotFoundError,
  EmployeeNumberAlreadyExistsError,
  UserAlreadyLinkedToEmployeeError,
  UserNotFoundForLinkError,
} from '../../application/errors/HrErrors.js';
import { CreateDepartmentUseCase } from '../../application/useCases/CreateDepartmentUseCase.js';
import { HireEmployeeUseCase } from '../../application/useCases/HireEmployeeUseCase.js';
import { LinkEmployeeToUserUseCase } from '../../application/useCases/LinkEmployeeToUserUseCase.js';
import { ListEmployeesUseCase } from '../../application/useCases/ListEmployeesUseCase.js';
import { TerminateEmployeeUseCase } from '../../application/useCases/TerminateEmployeeUseCase.js';
import { TransferEmployeeUseCase } from '../../application/useCases/TransferEmployeeUseCase.js';
import { UnlinkEmployeeFromUserUseCase } from '../../application/useCases/UnlinkEmployeeFromUserUseCase.js';
import { UpdateEmployeeProfileUseCase } from '../../application/useCases/UpdateEmployeeProfileUseCase.js';
import { SequentialEmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';

import { makeFakeHrContext } from './fakes.js';

const COMPANY = 1;
const ACTOR = { actorUserId: 99, actorUsername: 'admin' };
const HIRE_DATE = '2026-01-15';

interface Tools {
  ctx: ReturnType<typeof makeFakeHrContext>;
  hire: HireEmployeeUseCase;
  update: UpdateEmployeeProfileUseCase;
  transfer: TransferEmployeeUseCase;
  terminate: TerminateEmployeeUseCase;
  link: LinkEmployeeToUserUseCase;
  unlink: UnlinkEmployeeFromUserUseCase;
  list: ListEmployeesUseCase;
}

async function setup(): Promise<{ tools: Tools; deptId: number }> {
  const ctx = makeFakeHrContext();
  let seq = 0;
  const empNoGen = new SequentialEmployeeNumberGenerator(async () => ++seq);
  const tools: Tools = {
    ctx,
    hire: new HireEmployeeUseCase(
      ctx.employees,
      ctx.departments,
      ctx.positions,
      ctx.users,
      empNoGen,
      ctx.clock,
      ctx.audit,
    ),
    update: new UpdateEmployeeProfileUseCase(ctx.employees, ctx.clock, ctx.audit),
    transfer: new TransferEmployeeUseCase(
      ctx.employees,
      ctx.departments,
      ctx.positions,
      ctx.clock,
      ctx.audit,
    ),
    terminate: new TerminateEmployeeUseCase(ctx.employees, ctx.clock, ctx.audit),
    link: new LinkEmployeeToUserUseCase(ctx.employees, ctx.users, ctx.clock, ctx.audit),
    unlink: new UnlinkEmployeeFromUserUseCase(ctx.employees, ctx.clock, ctx.audit),
    list: new ListEmployeesUseCase(ctx.employees),
  };
  const dept = await new CreateDepartmentUseCase(
    ctx.departments,
    ctx.orgUnits,
    ctx.clock,
    ctx.audit,
  ).execute({ ...ACTOR, companyId: COMPANY, orgUnitId: null, name: 'IT', code: null });
  return { tools, deptId: dept.id };
}

describe('HireEmployeeUseCase', () => {
  it('happy: minimal alanlarla işe alır, generator ile employeeNo üretir', async () => {
    const { tools, deptId } = await setup();
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'Ali',
      lastName: 'Veli',
      hireDate: HIRE_DATE,
    });
    assert.equal(e.firstName, 'Ali');
    assert.equal(e.status, 'probation');
    assert.equal(e.employmentType, 'full_time');
    assert.match(e.employeeNo, /^EMP-\d{6}$/);
    assert.equal(tools.ctx.audit.findByAction('hr.employee.hired').length, 1);
  });

  it('happy: explicit employeeNo + TC kimlik + telefon normalize', async () => {
    const { tools, deptId } = await setup();
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'PRM-001',
      firstName: 'Ayşe',
      lastName: 'Yıldız',
      tcKimlik: '10000000146',
      phone: '0532 123 45 67',
      hireDate: HIRE_DATE,
    });
    assert.equal(e.employeeNo, 'PRM-001');
    assert.equal(e.tcKimlik, '10000000146');
    assert.equal(e.phone, '+905321234567');
  });

  it('edge: olmayan departmentId → DepartmentNotFoundError', async () => {
    const { tools } = await setup();
    await assert.rejects(
      tools.hire.execute({
        ...ACTOR,
        companyId: COMPANY,
        departmentId: 999,
        positionId: null,
        firstName: 'X',
        lastName: 'Y',
        hireDate: HIRE_DATE,
      }),
      (e: unknown) => e instanceof DepartmentNotFoundError,
    );
  });

  it('edge: çakışan employeeNo → EmployeeNumberAlreadyExistsError', async () => {
    const { tools, deptId } = await setup();
    await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'PRM-001',
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    await assert.rejects(
      tools.hire.execute({
        ...ACTOR,
        companyId: COMPANY,
        departmentId: deptId,
        positionId: null,
        employeeNo: 'PRM-001',
        firstName: 'X',
        lastName: 'Y',
        hireDate: HIRE_DATE,
      }),
      (e: unknown) => e instanceof EmployeeNumberAlreadyExistsError,
    );
  });

  it('edge: userId verildi ama User aktif değil → UserNotFoundForLinkError', async () => {
    const { tools, deptId } = await setup();
    tools.ctx.users.seed({ id: 5, username: 'pasif', fullName: null, email: null, active: false });
    await assert.rejects(
      tools.hire.execute({
        ...ACTOR,
        companyId: COMPANY,
        departmentId: deptId,
        positionId: null,
        firstName: 'A',
        lastName: 'B',
        hireDate: HIRE_DATE,
        userId: 5,
      }),
      (e: unknown) => e instanceof UserNotFoundForLinkError,
    );
  });
});

describe('UpdateEmployeeProfileUseCase', () => {
  it('happy: firstName + phone normalize edilir', async () => {
    const { tools, deptId } = await setup();
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    const r = await tools.update.execute({
      ...ACTOR,
      companyId: COMPANY,
      id: e.id,
      firstName: 'Yeni',
      phone: '0532 999 99 99',
    });
    assert.equal(r.firstName, 'Yeni');
    assert.equal(r.phone, '+905329999999');
  });

  it('happy: phone=null bağı koparır', async () => {
    const { tools, deptId } = await setup();
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
      phone: '05321234567',
    });
    const r = await tools.update.execute({ ...ACTOR, companyId: COMPANY, id: e.id, phone: null });
    assert.equal(r.phone, null);
  });

  it('edge: olmayan id → NotFound', async () => {
    const { tools } = await setup();
    await assert.rejects(
      tools.update.execute({ ...ACTOR, companyId: COMPANY, id: 999, firstName: 'X' }),
      (e: unknown) => e instanceof EmployeeNotFoundError,
    );
  });
});

describe('TransferEmployeeUseCase', () => {
  it('happy: yeni departmana transfer', async () => {
    const { tools, deptId } = await setup();
    const dept2 = await new CreateDepartmentUseCase(
      tools.ctx.departments,
      tools.ctx.orgUnits,
      tools.ctx.clock,
      tools.ctx.audit,
    ).execute({ ...ACTOR, companyId: COMPANY, orgUnitId: null, name: 'HR', code: null });
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    const r = await tools.transfer.execute({
      ...ACTOR,
      companyId: COMPANY,
      employeeId: e.id,
      newDepartmentId: dept2.id,
      newPositionId: null,
    });
    assert.equal(r.departmentId, dept2.id);
  });

  it('edge: terminated employee transfer edilemez', async () => {
    const { tools, deptId } = await setup();
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    await tools.terminate.execute({ ...ACTOR, companyId: COMPANY, employeeId: e.id });
    await assert.rejects(
      tools.transfer.execute({
        ...ACTOR,
        companyId: COMPANY,
        employeeId: e.id,
        newDepartmentId: deptId,
        newPositionId: null,
      }),
      /terminated/,
    );
  });

  it('edge: olmayan hedef departman → NotFound', async () => {
    const { tools, deptId } = await setup();
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    await assert.rejects(
      tools.transfer.execute({
        ...ACTOR,
        companyId: COMPANY,
        employeeId: e.id,
        newDepartmentId: 999,
        newPositionId: null,
      }),
      (e: unknown) => e instanceof DepartmentNotFoundError,
    );
  });
});

describe('TerminateEmployeeUseCase', () => {
  it('happy: probation → terminated', async () => {
    const { tools, deptId } = await setup();
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    const r = await tools.terminate.execute({ ...ACTOR, companyId: COMPANY, employeeId: e.id });
    assert.equal(r.status, 'terminated');
    assert.ok(r.terminationDate);
  });

  it('edge: zaten terminated → AlreadyTerminated', async () => {
    const { tools, deptId } = await setup();
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    await tools.terminate.execute({ ...ACTOR, companyId: COMPANY, employeeId: e.id });
    await assert.rejects(
      tools.terminate.execute({ ...ACTOR, companyId: COMPANY, employeeId: e.id }),
      (e: unknown) => e instanceof EmployeeAlreadyTerminatedError,
    );
  });

  it('edge: olmayan id → NotFound', async () => {
    const { tools } = await setup();
    await assert.rejects(
      tools.terminate.execute({ ...ACTOR, companyId: COMPANY, employeeId: 999 }),
      (e: unknown) => e instanceof EmployeeNotFoundError,
    );
  });
});

describe('LinkEmployeeToUserUseCase', () => {
  it('happy: aktif User bağlanır', async () => {
    const { tools, deptId } = await setup();
    tools.ctx.users.seed({ id: 7, username: 'ali', fullName: null, email: null, active: true });
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    const r = await tools.link.execute({
      ...ACTOR,
      companyId: COMPANY,
      employeeId: e.id,
      userId: 7,
    });
    assert.equal(r.userId, 7);
  });

  it('edge: employee zaten bağlı → AlreadyLinked', async () => {
    const { tools, deptId } = await setup();
    tools.ctx.users.seed({ id: 7, username: 'ali', fullName: null, email: null, active: true });
    tools.ctx.users.seed({ id: 8, username: 'veli', fullName: null, email: null, active: true });
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    await tools.link.execute({ ...ACTOR, companyId: COMPANY, employeeId: e.id, userId: 7 });
    await assert.rejects(
      tools.link.execute({ ...ACTOR, companyId: COMPANY, employeeId: e.id, userId: 8 }),
      (e: unknown) => e instanceof EmployeeAlreadyLinkedError,
    );
  });

  it("edge: User başka employee'ye bağlı → UserAlreadyLinked", async () => {
    const { tools, deptId } = await setup();
    tools.ctx.users.seed({ id: 7, username: 'ali', fullName: null, email: null, active: true });
    const e1 = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    const e2 = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'C',
      lastName: 'D',
      hireDate: HIRE_DATE,
    });
    await tools.link.execute({ ...ACTOR, companyId: COMPANY, employeeId: e1.id, userId: 7 });
    await assert.rejects(
      tools.link.execute({ ...ACTOR, companyId: COMPANY, employeeId: e2.id, userId: 7 }),
      (e: unknown) => e instanceof UserAlreadyLinkedToEmployeeError,
    );
  });

  it('edge: olmayan User → UserNotFoundForLink', async () => {
    const { tools, deptId } = await setup();
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    await assert.rejects(
      tools.link.execute({ ...ACTOR, companyId: COMPANY, employeeId: e.id, userId: 999 }),
      (e: unknown) => e instanceof UserNotFoundForLinkError,
    );
  });
});

describe('UnlinkEmployeeFromUserUseCase', () => {
  it('happy: bağlı user bağı koparılır', async () => {
    const { tools, deptId } = await setup();
    tools.ctx.users.seed({ id: 7, username: 'ali', fullName: null, email: null, active: true });
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    await tools.link.execute({ ...ACTOR, companyId: COMPANY, employeeId: e.id, userId: 7 });
    const r = await tools.unlink.execute({ ...ACTOR, companyId: COMPANY, employeeId: e.id });
    assert.equal(r.userId, null);
  });

  it('edge: zaten bağlı değil → no-op', async () => {
    const { tools, deptId } = await setup();
    const e = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    const r = await tools.unlink.execute({ ...ACTOR, companyId: COMPANY, employeeId: e.id });
    assert.equal(r.userId, null);
    assert.equal(tools.ctx.audit.findByAction('hr.employee.user_unlinked').length, 0);
  });

  it('edge: olmayan id → NotFound', async () => {
    const { tools } = await setup();
    await assert.rejects(
      tools.unlink.execute({ ...ACTOR, companyId: COMPANY, employeeId: 999 }),
      (e: unknown) => e instanceof EmployeeNotFoundError,
    );
  });
});

describe('ListEmployeesUseCase', () => {
  it('happy: q ile arama', async () => {
    const { tools, deptId } = await setup();
    await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'Mehmet',
      lastName: 'Demir',
      hireDate: HIRE_DATE,
    });
    await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'Ayşe',
      lastName: 'Yıldız',
      hireDate: HIRE_DATE,
    });
    const r = await tools.list.execute({ companyId: COMPANY, q: 'demir' });
    assert.equal(r.length, 1);
    assert.equal(r[0]!.fullName, 'Mehmet Demir');
  });

  it('happy: status filtresi', async () => {
    const { tools, deptId } = await setup();
    const e1 = await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'A',
      lastName: 'B',
      hireDate: HIRE_DATE,
    });
    await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'C',
      lastName: 'D',
      hireDate: HIRE_DATE,
    });
    await tools.terminate.execute({ ...ACTOR, companyId: COMPANY, employeeId: e1.id });

    const probation = await tools.list.execute({ companyId: COMPANY, status: 'probation' });
    assert.equal(probation.length, 1);
    const terminated = await tools.list.execute({ companyId: COMPANY, status: 'terminated' });
    assert.equal(terminated.length, 1);
  });

  it('edge: izolasyon — farklı şirket çalışanları görünmez', async () => {
    const { tools, deptId } = await setup();
    await tools.hire.execute({
      ...ACTOR,
      companyId: COMPANY,
      departmentId: deptId,
      positionId: null,
      firstName: 'Ours',
      lastName: 'X',
      hireDate: HIRE_DATE,
    });
    const otherDept = await new CreateDepartmentUseCase(
      tools.ctx.departments,
      tools.ctx.orgUnits,
      tools.ctx.clock,
      tools.ctx.audit,
    ).execute({ ...ACTOR, companyId: 2, orgUnitId: null, name: 'Other', code: null });
    await tools.hire.execute({
      ...ACTOR,
      companyId: 2,
      departmentId: otherDept.id,
      positionId: null,
      firstName: 'Other',
      lastName: 'Y',
      hireDate: HIRE_DATE,
    });
    const ours = await tools.list.execute({ companyId: COMPANY });
    assert.equal(ours.length, 1);
    assert.equal(ours[0]!.firstName, 'Ours');
  });
});
