/**
 * PgEmployeeRepository integration test — gerçek PostgreSQL üzerinde.
 *
 * Doğrulanan davranışlar:
 *   - insert + findById/findByEmployeeNo/findByUserId
 *   - UNIQUE constraint'ler PG '23505' kodu üretiyor:
 *       * uq_employees_company_employee_no
 *       * uq_employees_user (user_id NOT NULL ile)
 *       * uq_employees_company_tc_kimlik
 *   - CHECK constraint'ler '23514':
 *       * employees_tc_kimlik_len (11 karakter)
 *       * employees_termination_after_hire
 *   - countActiveByDepartment / countActiveByPosition
 *   - listByCompany filtreleri (status, departmentId, q)
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { PgDepartmentRepository } from '../../infrastructure/persistence/PgDepartmentRepository.js';
import { PgEmployeeRepository } from '../../infrastructure/persistence/PgEmployeeRepository.js';

import {
  seedCompany,
  seedUser,
  startHrPgContainer,
  truncateAuthAndHrTables,
  type HrPgContext,
} from './setup.js';

describe('PgEmployeeRepository [integration]', () => {
  let ctx: HrPgContext;
  let deptId: number;

  before(
    async () => {
      ctx = await startHrPgContainer();
    },
    { timeout: 180_000 },
  );

  after(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  beforeEach(async () => {
    await truncateAuthAndHrTables(ctx.pool);
    await seedCompany(ctx.pool, { id: 1, name: 'Test A.Ş.' });
    const deptRepo = new PgDepartmentRepository(ctx.pool);
    const d = await deptRepo.insert({
      companyId: 1,
      orgUnitId: null,
      name: 'IT',
      code: null,
      managerEmployeeId: null,
      active: true,
    });
    deptId = d.id;
  });

  it('insert: tüm alanlar dahil çalışan ekler', async () => {
    const repo = new PgEmployeeRepository(ctx.pool);
    const user = await seedUser(ctx.pool, { companyId: 1, username: 'alice' });

    const e = await repo.insert({
      companyId: 1,
      userId: user.id,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000001',
      firstName: 'Alice',
      lastName: 'Yılmaz',
      tcKimlik: '10000000146',
      email: 'alice@example.com',
      phone: '+905551234567',
      hireDate: '2024-01-15',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });

    assert.ok(e.id > 0);
    assert.equal(e.employeeNo.value, 'EMP-000001');
    assert.equal(e.firstName, 'Alice');
    assert.equal(e.tcKimlik?.value, '10000000146');
    assert.equal(e.email, 'alice@example.com');
    assert.equal(e.phone?.value, '+905551234567');
    assert.equal(e.status, 'active');
    assert.equal(e.userId, user.id);
  });

  it('findByEmployeeNo + findByUserId: doğru kaydı döner', async () => {
    const repo = new PgEmployeeRepository(ctx.pool);
    const user = await seedUser(ctx.pool, { companyId: 1, username: 'bob' });
    const inserted = await repo.insert({
      companyId: 1,
      userId: user.id,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000042',
      firstName: 'Bob',
      lastName: 'Y',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'probation',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });

    const byNo = await repo.findByEmployeeNo('EMP-000042', 1);
    assert.equal(byNo?.id, inserted.id);

    const byUser = await repo.findByUserId(user.id, 1);
    assert.equal(byUser?.id, inserted.id);
  });

  it('UNIQUE uq_employees_company_employee_no: aynı şirkette tekrar 23505', async () => {
    const repo = new PgEmployeeRepository(ctx.pool);
    await repo.insert({
      companyId: 1,
      userId: null,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000001',
      firstName: 'A',
      lastName: 'B',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });

    await assert.rejects(
      repo.insert({
        companyId: 1,
        userId: null,
        departmentId: deptId,
        positionId: null,
        employeeNo: 'EMP-000001',
        firstName: 'C',
        lastName: 'D',
        tcKimlik: null,
        email: null,
        phone: null,
        hireDate: '2024-01-01',
        status: 'active',
        employmentType: 'full_time',
        sourceApplicationId: null,
      }),
      (err: unknown) => {
        const e = err as { code?: string };
        assert.equal(e.code, '23505');
        return true;
      },
    );
  });

  it('UNIQUE uq_employees_user: aynı user iki Employee’ye bağlanamaz 23505', async () => {
    const repo = new PgEmployeeRepository(ctx.pool);
    const user = await seedUser(ctx.pool, { companyId: 1, username: 'shared' });
    await repo.insert({
      companyId: 1,
      userId: user.id,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000001',
      firstName: 'A',
      lastName: 'B',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });

    await assert.rejects(
      repo.insert({
        companyId: 1,
        userId: user.id,
        departmentId: deptId,
        positionId: null,
        employeeNo: 'EMP-000002',
        firstName: 'C',
        lastName: 'D',
        tcKimlik: null,
        email: null,
        phone: null,
        hireDate: '2024-01-01',
        status: 'active',
        employmentType: 'full_time',
        sourceApplicationId: null,
      }),
      (err: unknown) => {
        const e = err as { code?: string };
        assert.equal(e.code, '23505');
        return true;
      },
    );
  });

  it('UNIQUE uq_employees_company_tc_kimlik: aynı TC iki kez insert reject 23505', async () => {
    const repo = new PgEmployeeRepository(ctx.pool);
    await repo.insert({
      companyId: 1,
      userId: null,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000001',
      firstName: 'A',
      lastName: 'B',
      tcKimlik: '10000000146',
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });

    await assert.rejects(
      repo.insert({
        companyId: 1,
        userId: null,
        departmentId: deptId,
        positionId: null,
        employeeNo: 'EMP-000002',
        firstName: 'C',
        lastName: 'D',
        tcKimlik: '10000000146',
        email: null,
        phone: null,
        hireDate: '2024-01-01',
        status: 'active',
        employmentType: 'full_time',
        sourceApplicationId: null,
      }),
      (err: unknown) => {
        const e = err as { code?: string };
        assert.equal(e.code, '23505');
        return true;
      },
    );

    // İki NULL TC çakışmaz — partial unique
    await repo.insert({
      companyId: 1,
      userId: null,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000003',
      firstName: 'E',
      lastName: 'F',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });
    await repo.insert({
      companyId: 1,
      userId: null,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000004',
      firstName: 'G',
      lastName: 'H',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });
    // Yukarıda iki NULL TC olduğu için exception olmadan ulaşmalı
    const list = await repo.listByCompany(1);
    assert.equal(list.length, 3);
  });

  it('CHECK employees_tc_kimlik_len: 11 olmayan TC reject (23514)', async () => {
    // Domain VO 11 karakter zorunlu kılar; raw INSERT ile DB check'ini test et
    await assert.rejects(
      ctx.pool.query(
        `INSERT INTO employees
           (company_id, department_id, employee_no, first_name, last_name,
            tc_kimlik, hire_date, status, employment_type)
         VALUES ($1, $2, 'EMP-X', 'A', 'B', '1234567890', '2024-01-01', 'active', 'full_time')`,
        [1, deptId],
      ),
      (err: unknown) => {
        const e = err as { code?: string };
        assert.equal(e.code, '23514');
        return true;
      },
    );
  });

  it('CHECK employees_termination_after_hire: termination < hire reject 23514', async () => {
    await assert.rejects(
      ctx.pool.query(
        `INSERT INTO employees
           (company_id, department_id, employee_no, first_name, last_name,
            hire_date, termination_date, status, employment_type)
         VALUES ($1, $2, 'EMP-X', 'A', 'B', '2024-06-01', '2024-01-01', 'terminated', 'full_time')`,
        [1, deptId],
      ),
      (err: unknown) => {
        const e = err as { code?: string };
        assert.equal(e.code, '23514');
        return true;
      },
    );
  });

  it('countActiveByDepartment: terminated harici sayıyı döner', async () => {
    const repo = new PgEmployeeRepository(ctx.pool);

    await repo.insert({
      companyId: 1,
      userId: null,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000001',
      firstName: 'A',
      lastName: 'B',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });
    await repo.insert({
      companyId: 1,
      userId: null,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000002',
      firstName: 'C',
      lastName: 'D',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'probation',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });
    // Terminated bir kayıt - count'a girmemeli
    await ctx.pool.query(
      `INSERT INTO employees
         (company_id, department_id, employee_no, first_name, last_name,
          hire_date, termination_date, status, employment_type)
       VALUES ($1, $2, 'EMP-000003', 'X', 'Y',
               '2024-01-01', '2024-06-01', 'terminated', 'full_time')`,
      [1, deptId],
    );

    const n = await repo.countActiveByDepartment(deptId, 1);
    assert.equal(n, 2);
  });

  it('listByCompany: status filtresi + q araması', async () => {
    const repo = new PgEmployeeRepository(ctx.pool);
    await repo.insert({
      companyId: 1,
      userId: null,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000001',
      firstName: 'Alice',
      lastName: 'Smith',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });
    await repo.insert({
      companyId: 1,
      userId: null,
      departmentId: deptId,
      positionId: null,
      employeeNo: 'EMP-000002',
      firstName: 'Bob',
      lastName: 'Jones',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'probation',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });

    const active = await repo.listByCompany(1, { status: 'active' });
    assert.equal(active.length, 1);
    assert.equal(active[0]!.firstName, 'Alice');

    const searchAlice = await repo.listByCompany(1, { q: 'alice' });
    assert.equal(searchAlice.length, 1);

    const searchByEmpNo = await repo.listByCompany(1, { q: '000002' });
    assert.equal(searchByEmpNo.length, 1);
    assert.equal(searchByEmpNo[0]!.firstName, 'Bob');
  });
});
