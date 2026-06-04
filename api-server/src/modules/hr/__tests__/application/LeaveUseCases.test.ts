import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EmployeeNotFoundError } from '../../application/errors/HrErrors.js';
import { ApproveLeaveRequestUseCase } from '../../application/useCases/ApproveLeaveRequestUseCase.js';
import { CreateDepartmentUseCase } from '../../application/useCases/CreateDepartmentUseCase.js';
import {
  DEFAULT_ANNUAL_LEAVE_ENTITLEMENT,
  GetLeaveBalanceUseCase,
} from '../../application/useCases/GetLeaveBalanceUseCase.js';
import { HireEmployeeUseCase } from '../../application/useCases/HireEmployeeUseCase.js';
import { RequestLeaveUseCase } from '../../application/useCases/RequestLeaveUseCase.js';
import { SequentialEmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';
import { InvalidLeaveTransitionError } from '../../domain/valueObjects/LeaveStatus.js';

import { makeFakeHrContext } from './fakes.js';

const COMPANY = 1;
const ACTOR = { actorUserId: 99, actorUsername: 'admin' };
const HIRE_DATE = '2026-01-15';

interface Tools {
  ctx: ReturnType<typeof makeFakeHrContext>;
  request: RequestLeaveUseCase;
  approve: ApproveLeaveRequestUseCase;
  balance: GetLeaveBalanceUseCase;
}

async function setup(): Promise<{ tools: Tools; employeeId: number }> {
  const ctx = makeFakeHrContext();
  let seq = 0;
  const empNoGen = new SequentialEmployeeNumberGenerator(async () => ++seq);
  const hire = new HireEmployeeUseCase(
    ctx.employees,
    ctx.departments,
    ctx.positions,
    ctx.users,
    empNoGen,
    ctx.clock,
    ctx.audit,
  );
  const dept = await new CreateDepartmentUseCase(
    ctx.departments,
    ctx.orgUnits,
    ctx.clock,
    ctx.audit,
  ).execute({ ...ACTOR, companyId: COMPANY, orgUnitId: null, name: 'IT', code: null });
  const employee = await hire.execute({
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
    request: new RequestLeaveUseCase(ctx.leaveRequests, ctx.employees, ctx.clock, ctx.audit),
    approve: new ApproveLeaveRequestUseCase(ctx.leaveRequests, ctx.clock, ctx.audit),
    balance: new GetLeaveBalanceUseCase(ctx.leaveRequests, ctx.employees, ctx.clock),
  };
  return { tools, employeeId: employee.id };
}

describe('RequestLeaveUseCase', () => {
  it('happy: pending talep oluşur, gün sayısı inclusive hesaplanır', async () => {
    const { tools, employeeId } = await setup();
    const r = await tools.request.execute({
      ...ACTOR,
      companyId: COMPANY,
      employeeId,
      leaveType: 'annual',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
    assert.equal(r.status, 'pending');
    assert.equal(r.leaveType, 'annual');
    assert.equal(r.days, 5);
    assert.equal(r.startDate, '2026-06-01');
    assert.equal(r.endDate, '2026-06-05');
    assert.equal(tools.ctx.audit.findByAction('hr.leave.requested').length, 1);
  });

  it('happy: tek günlük izin → 1 gün', async () => {
    const { tools, employeeId } = await setup();
    const r = await tools.request.execute({
      ...ACTOR,
      companyId: COMPANY,
      employeeId,
      leaveType: 'sick',
      startDate: '2026-06-10',
      endDate: '2026-06-10',
    });
    assert.equal(r.days, 1);
  });

  it('edge: olmayan employeeId → EmployeeNotFoundError', async () => {
    const { tools } = await setup();
    await assert.rejects(
      tools.request.execute({
        ...ACTOR,
        companyId: COMPANY,
        employeeId: 999,
        leaveType: 'annual',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
      }),
      (e: unknown) => e instanceof EmployeeNotFoundError,
    );
  });
});

describe('ApproveLeaveRequestUseCase', () => {
  it('happy: pending → approved', async () => {
    const { tools, employeeId } = await setup();
    const created = await tools.request.execute({
      ...ACTOR,
      companyId: COMPANY,
      employeeId,
      leaveType: 'annual',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
    const r = await tools.approve.execute({
      ...ACTOR,
      companyId: COMPANY,
      leaveRequestId: created.id,
      note: 'uygun',
    });
    assert.equal(r.status, 'approved');
    assert.equal(r.decidedByUserId, ACTOR.actorUserId);
    assert.ok(r.decidedAt);
    assert.equal(tools.ctx.audit.findByAction('hr.leave.approved').length, 1);
  });

  it('edge: zaten approved → InvalidLeaveTransitionError', async () => {
    const { tools, employeeId } = await setup();
    const created = await tools.request.execute({
      ...ACTOR,
      companyId: COMPANY,
      employeeId,
      leaveType: 'annual',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
    await tools.approve.execute({ ...ACTOR, companyId: COMPANY, leaveRequestId: created.id });
    await assert.rejects(
      tools.approve.execute({ ...ACTOR, companyId: COMPANY, leaveRequestId: created.id }),
      (e: unknown) => e instanceof InvalidLeaveTransitionError,
    );
  });

  it('edge: farklı şirketten erişim → NotFound (izolasyon)', async () => {
    const { tools, employeeId } = await setup();
    const created = await tools.request.execute({
      ...ACTOR,
      companyId: COMPANY,
      employeeId,
      leaveType: 'annual',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
    await assert.rejects(
      tools.approve.execute({ ...ACTOR, companyId: 2, leaveRequestId: created.id }),
      /bulunamadı|not found/i,
    );
  });
});

describe('GetLeaveBalanceUseCase', () => {
  it('happy: hiç izin yoksa remaining = entitlement', async () => {
    const { tools, employeeId } = await setup();
    const b = await tools.balance.execute({ companyId: COMPANY, employeeId });
    assert.equal(b.entitlement, DEFAULT_ANNUAL_LEAVE_ENTITLEMENT);
    assert.equal(b.used, 0);
    assert.equal(b.remaining, DEFAULT_ANNUAL_LEAVE_ENTITLEMENT);
    assert.equal(b.year, tools.ctx.clock.now().getUTCFullYear());
  });

  it('happy: onaylanmış yıllık izin used düşer', async () => {
    const { tools, employeeId } = await setup();
    const created = await tools.request.execute({
      ...ACTOR,
      companyId: COMPANY,
      employeeId,
      leaveType: 'annual',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
    await tools.approve.execute({ ...ACTOR, companyId: COMPANY, leaveRequestId: created.id });
    const b = await tools.balance.execute({ companyId: COMPANY, employeeId });
    assert.equal(b.used, 5);
    assert.equal(b.remaining, DEFAULT_ANNUAL_LEAVE_ENTITLEMENT - 5);
  });

  it("edge: pending izin used'a sayılmaz", async () => {
    const { tools, employeeId } = await setup();
    await tools.request.execute({
      ...ACTOR,
      companyId: COMPANY,
      employeeId,
      leaveType: 'annual',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
    const b = await tools.balance.execute({ companyId: COMPANY, employeeId });
    assert.equal(b.used, 0);
  });

  it('edge: sick izin annual bakiyeden düşmez', async () => {
    const { tools, employeeId } = await setup();
    const created = await tools.request.execute({
      ...ACTOR,
      companyId: COMPANY,
      employeeId,
      leaveType: 'sick',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
    await tools.approve.execute({ ...ACTOR, companyId: COMPANY, leaveRequestId: created.id });
    const b = await tools.balance.execute({ companyId: COMPANY, employeeId });
    assert.equal(b.used, 0);
  });

  it('edge: olmayan employeeId → EmployeeNotFoundError', async () => {
    const { tools } = await setup();
    await assert.rejects(
      tools.balance.execute({ companyId: COMPANY, employeeId: 999 }),
      (e: unknown) => e instanceof EmployeeNotFoundError,
    );
  });
});
