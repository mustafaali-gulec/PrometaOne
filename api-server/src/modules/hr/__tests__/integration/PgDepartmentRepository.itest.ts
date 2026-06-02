/**
 * PgDepartmentRepository integration test — gerçek PostgreSQL üzerinde.
 *
 * Doğrulanan davranışlar:
 *   - insert/findById/listByCompany/hasActiveEmployees CRUD
 *   - UNIQUE constraint (`uq_departments_company_code`) — 23505
 *   - Manager (employee_id) atama — DEFERRABLE değil FK
 *   - orgUnitId filtreleme
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { PgDepartmentRepository } from '../../infrastructure/persistence/PgDepartmentRepository.js';
import { PgEmployeeRepository } from '../../infrastructure/persistence/PgEmployeeRepository.js';
import { PgOrgUnitRepository } from '../../infrastructure/persistence/PgOrgUnitRepository.js';

import {
  seedCompany,
  startHrPgContainer,
  truncateAuthAndHrTables,
  type HrPgContext,
} from './setup.js';

describe('PgDepartmentRepository [integration]', () => {
  let ctx: HrPgContext;

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
  });

  it('insert: yeni departman ekler', async () => {
    const repo = new PgDepartmentRepository(ctx.pool);
    const orgRepo = new PgOrgUnitRepository(ctx.pool);
    const ou = await orgRepo.insert({
      companyId: 1,
      parentId: null,
      name: 'HQ',
      code: null,
      sortOrder: 0,
      active: true,
    });

    const dept = await repo.insert({
      companyId: 1,
      orgUnitId: ou.id,
      name: 'IT',
      code: 'IT',
      managerEmployeeId: null,
      active: true,
    });

    assert.ok(dept.id > 0);
    assert.equal(dept.name, 'IT');
    assert.equal(dept.code?.value, 'IT');
    assert.equal(dept.orgUnitId, ou.id);
    assert.equal(dept.managerEmployeeId, null);
    assert.equal(dept.active, true);
  });

  it('update: managerEmployeeId atanabilir', async () => {
    const deptRepo = new PgDepartmentRepository(ctx.pool);
    const empRepo = new PgEmployeeRepository(ctx.pool);

    const dept = await deptRepo.insert({
      companyId: 1,
      orgUnitId: null,
      name: 'HR',
      code: null,
      managerEmployeeId: null,
      active: true,
    });
    const emp = await empRepo.insert({
      companyId: 1,
      userId: null,
      departmentId: dept.id,
      positionId: null,
      employeeNo: 'EMP-000001',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      tcKimlik: null,
      email: null,
      phone: null,
      hireDate: '2024-01-01',
      status: 'active',
      employmentType: 'full_time',
      sourceApplicationId: null,
    });

    const updated = dept.assignManager(emp.id, new Date());
    await deptRepo.update(updated);

    const found = await deptRepo.findById(dept.id, 1);
    assert.ok(found);
    assert.equal(found.managerEmployeeId, emp.id);
  });

  it('listByCompany: orgUnitId === null filtresi ile org_unit_id IS NULL kayıtları döner', async () => {
    const repo = new PgDepartmentRepository(ctx.pool);
    const orgRepo = new PgOrgUnitRepository(ctx.pool);
    const ou = await orgRepo.insert({
      companyId: 1,
      parentId: null,
      name: 'HQ',
      code: null,
      sortOrder: 0,
      active: true,
    });

    await repo.insert({
      companyId: 1,
      orgUnitId: ou.id,
      name: 'IT',
      code: null,
      managerEmployeeId: null,
      active: true,
    });
    await repo.insert({
      companyId: 1,
      orgUnitId: null,
      name: 'Floating',
      code: null,
      managerEmployeeId: null,
      active: true,
    });

    const floating = await repo.listByCompany(1, { orgUnitId: null });
    assert.equal(floating.length, 1);
    assert.equal(floating[0]!.name, 'Floating');

    const inOu = await repo.listByCompany(1, { orgUnitId: ou.id });
    assert.equal(inOu.length, 1);
    assert.equal(inOu[0]!.name, 'IT');
  });

  it('UNIQUE: aynı şirkette aynı code iki kez insert edilemez (23505)', async () => {
    const repo = new PgDepartmentRepository(ctx.pool);
    await repo.insert({
      companyId: 1,
      orgUnitId: null,
      name: 'A',
      code: 'DUP',
      managerEmployeeId: null,
      active: true,
    });

    await assert.rejects(
      repo.insert({
        companyId: 1,
        orgUnitId: null,
        name: 'B',
        code: 'DUP',
        managerEmployeeId: null,
        active: true,
      }),
      (err: unknown) => {
        const e = err as { code?: string };
        assert.equal(e.code, '23505');
        return true;
      },
    );
  });

  it('hasActiveEmployees: terminated harici en az 1 çalışan varsa true', async () => {
    const deptRepo = new PgDepartmentRepository(ctx.pool);
    const empRepo = new PgEmployeeRepository(ctx.pool);

    const dept = await deptRepo.insert({
      companyId: 1,
      orgUnitId: null,
      name: 'IT',
      code: null,
      managerEmployeeId: null,
      active: true,
    });

    assert.equal(await deptRepo.hasActiveEmployees(dept.id, 1), false);

    await empRepo.insert({
      companyId: 1,
      userId: null,
      departmentId: dept.id,
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

    assert.equal(await deptRepo.hasActiveEmployees(dept.id, 1), true);
  });

  it('multi-tenant: farklı şirketteki departman görünmez', async () => {
    const repo = new PgDepartmentRepository(ctx.pool);
    await seedCompany(ctx.pool, { id: 2, name: 'Şirket 2' });

    const dept = await repo.insert({
      companyId: 1,
      orgUnitId: null,
      name: 'IT',
      code: null,
      managerEmployeeId: null,
      active: true,
    });

    const otherSide = await repo.findById(dept.id, 2);
    assert.equal(otherSide, null);

    const ownerSide = await repo.findById(dept.id, 1);
    assert.ok(ownerSide);
  });
});
