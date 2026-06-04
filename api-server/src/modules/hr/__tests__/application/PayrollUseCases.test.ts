import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PayrollRunNotDraftError,
  PayrollRunNotFoundError,
  PayrollRunPeriodAlreadyExistsError,
} from '../../application/errors/HrErrors.js';
import { CreateDepartmentUseCase } from '../../application/useCases/CreateDepartmentUseCase.js';
import { CreatePayrollRunUseCase } from '../../application/useCases/CreatePayrollRunUseCase.js';
import { FinalizePayrollRunUseCase } from '../../application/useCases/FinalizePayrollRunUseCase.js';
import { HireEmployeeUseCase } from '../../application/useCases/HireEmployeeUseCase.js';
import {
  DEFAULT_GROSS_SALARY,
  RunPayrollBatchUseCase,
} from '../../application/useCases/RunPayrollBatchUseCase.js';
import { SequentialEmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';
import { PayrollCalculator } from '../../domain/services/PayrollCalculator.js';
import { InvalidPayrollRunTransitionError } from '../../domain/valueObjects/PayrollRunStatus.js';

import { makeFakeHrContext } from './fakes.js';

const COMPANY = 1;
const ACTOR = { actorUserId: 99, actorUsername: 'admin' };
const HIRE_DATE = '2026-01-15';

interface Tools {
  ctx: ReturnType<typeof makeFakeHrContext>;
  create: CreatePayrollRunUseCase;
  runBatch: RunPayrollBatchUseCase;
  finalize: FinalizePayrollRunUseCase;
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
    create: new CreatePayrollRunUseCase(ctx.payroll, ctx.clock, ctx.audit),
    runBatch: new RunPayrollBatchUseCase(
      ctx.payroll,
      ctx.employees,
      ctx.positions,
      ctx.clock,
      ctx.audit,
    ),
    finalize: new FinalizePayrollRunUseCase(ctx.payroll, ctx.clock, ctx.audit),
  };
  return { tools, employeeId: employee.id };
}

describe('CreatePayrollRunUseCase', () => {
  it('happy: draft koşu oluşur + audit', async () => {
    const { tools } = await setup();
    const run = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      periodYear: 2026,
      periodMonth: 5,
      note: 'mayıs',
    });
    assert.equal(run.status, 'draft');
    assert.equal(run.periodYear, 2026);
    assert.equal(run.periodMonth, 5);
    assert.equal(tools.ctx.audit.findByAction('hr.payroll.run_created').length, 1);
  });

  it('edge: aynı dönem ikinci kez → PayrollRunPeriodAlreadyExistsError', async () => {
    const { tools } = await setup();
    await tools.create.execute({ ...ACTOR, companyId: COMPANY, periodYear: 2026, periodMonth: 5 });
    await assert.rejects(
      tools.create.execute({ ...ACTOR, companyId: COMPANY, periodYear: 2026, periodMonth: 5 }),
      (e: unknown) => e instanceof PayrollRunPeriodAlreadyExistsError,
    );
  });

  it('edge: farklı şirket aynı dönem → çakışmaz', async () => {
    const { tools } = await setup();
    await tools.create.execute({ ...ACTOR, companyId: COMPANY, periodYear: 2026, periodMonth: 5 });
    const other = await tools.create.execute({
      ...ACTOR,
      companyId: 2,
      periodYear: 2026,
      periodMonth: 5,
    });
    assert.equal(other.status, 'draft');
  });
});

describe('RunPayrollBatchUseCase', () => {
  it('happy: aktif çalışan için item üretir (varsayılan brüt)', async () => {
    const { tools, employeeId } = await setup();
    const run = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      periodYear: 2026,
      periodMonth: 5,
    });
    const result = await tools.runBatch.execute({
      ...ACTOR,
      companyId: COMPANY,
      payrollRunId: run.id,
    });
    assert.equal(result.items.length, 1);
    const item = result.items[0]!;
    assert.equal(item.employeeId, employeeId);
    const expected = PayrollCalculator.calculate(DEFAULT_GROSS_SALARY);
    assert.equal(item.grossSalary, expected.grossSalary);
    assert.equal(item.netSalary, expected.netSalary);
    assert.equal(tools.ctx.audit.findByAction('hr.payroll.batch_run').length, 1);
  });

  it('happy: idempotent — ikinci çalıştırma satırları değiştirir, çoğaltmaz', async () => {
    const { tools } = await setup();
    const run = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      periodYear: 2026,
      periodMonth: 5,
    });
    await tools.runBatch.execute({ ...ACTOR, companyId: COMPANY, payrollRunId: run.id });
    const second = await tools.runBatch.execute({
      ...ACTOR,
      companyId: COMPANY,
      payrollRunId: run.id,
    });
    assert.equal(second.items.length, 1);
    const persisted = await tools.ctx.payroll.listItemsForRun(run.id, COMPANY);
    assert.equal(persisted.length, 1);
  });

  it('edge: olmayan koşu → PayrollRunNotFoundError', async () => {
    const { tools } = await setup();
    await assert.rejects(
      tools.runBatch.execute({ ...ACTOR, companyId: COMPANY, payrollRunId: 999 }),
      (e: unknown) => e instanceof PayrollRunNotFoundError,
    );
  });

  it('edge: finalized koşu → PayrollRunNotDraftError', async () => {
    const { tools } = await setup();
    const run = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      periodYear: 2026,
      periodMonth: 5,
    });
    await tools.finalize.execute({ ...ACTOR, companyId: COMPANY, payrollRunId: run.id });
    await assert.rejects(
      tools.runBatch.execute({ ...ACTOR, companyId: COMPANY, payrollRunId: run.id }),
      (e: unknown) => e instanceof PayrollRunNotDraftError,
    );
  });
});

describe('FinalizePayrollRunUseCase', () => {
  it('happy: draft → finalized + audit', async () => {
    const { tools } = await setup();
    const run = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      periodYear: 2026,
      periodMonth: 5,
    });
    const finalized = await tools.finalize.execute({
      ...ACTOR,
      companyId: COMPANY,
      payrollRunId: run.id,
    });
    assert.equal(finalized.status, 'finalized');
    assert.ok(finalized.finalizedAt);
    assert.equal(finalized.finalizedByUserId, ACTOR.actorUserId);
    assert.equal(tools.ctx.audit.findByAction('hr.payroll.run_finalized').length, 1);
  });

  it('edge: zaten finalized → InvalidPayrollRunTransitionError', async () => {
    const { tools } = await setup();
    const run = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      periodYear: 2026,
      periodMonth: 5,
    });
    await tools.finalize.execute({ ...ACTOR, companyId: COMPANY, payrollRunId: run.id });
    await assert.rejects(
      tools.finalize.execute({ ...ACTOR, companyId: COMPANY, payrollRunId: run.id }),
      (e: unknown) => e instanceof InvalidPayrollRunTransitionError,
    );
  });

  it('edge: farklı şirketten erişim → NotFound (izolasyon)', async () => {
    const { tools } = await setup();
    const run = await tools.create.execute({
      ...ACTOR,
      companyId: COMPANY,
      periodYear: 2026,
      periodMonth: 5,
    });
    await assert.rejects(
      tools.finalize.execute({ ...ACTOR, companyId: 2, payrollRunId: run.id }),
      (e: unknown) => e instanceof PayrollRunNotFoundError,
    );
  });
});
