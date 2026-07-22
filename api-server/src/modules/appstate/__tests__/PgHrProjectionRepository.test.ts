/**
 * PgHrProjectionRepository birim testleri — SQL üretimi mock Pool/Client ile
 * doğrulanır (üst entite upsert + prune, detay delete-then-insert, FK serial
 * çözümü, FK-siz şirket düşürme, rollback).
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import type { HrProjection } from '../domain/HrProjection.js';
import {
  PgHrProjectionRepository,
  type HrProjectionPool,
  type HrProjectionPoolClient,
} from '../infrastructure/persistence/PgHrProjectionRepository.js';

interface RecordedCall {
  sql: string;
  values: readonly unknown[] | undefined;
}

interface FakeOptions {
  companies?: number[];
  /** UPDATE ... WHERE client_id — bu client_id'ler "var" sayılır (rowCount 1). */
  existingClientIds?: string[];
  failOn?: (sql: string) => boolean;
}

function makeFakePool(opts: FakeOptions = {}): {
  pool: HrProjectionPool;
  calls: RecordedCall[];
  released: () => boolean;
} {
  const calls: RecordedCall[] = [];
  let released = false;
  let nextId = 100;
  const client: HrProjectionPoolClient = {
    async query(sql: string, values?: readonly unknown[]) {
      calls.push({ sql, values });
      if (opts.failOn?.(sql)) throw new Error('patladı');
      if (sql.includes('SELECT id FROM companies')) {
        return { rows: (opts.companies ?? [1, 2, 3, 7]).map((id) => ({ id })) };
      }
      if (sql.trimStart().startsWith('UPDATE') && sql.includes('WHERE client_id = $')) {
        const clientId = values?.[values.length - 1];
        const exists = (opts.existingClientIds ?? []).includes(String(clientId));
        return exists ? { rows: [{ id: nextId++ }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO') && sql.includes('RETURNING id')) {
        return { rows: [{ id: nextId++ }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {
      released = true;
    },
  };
  return { pool: { connect: async () => client }, calls, released: () => released };
}

const emptyProjection = (over: Partial<HrProjection> = {}): HrProjection => ({
  orgUnits: [],
  departments: [],
  positions: [],
  employees: [],
  candidates: [],
  applications: [],
  leaveRequests: [],
  payrollRuns: [],
  payrollItems: [],
  assets: [],
  assetAssignments: [],
  dropped: {},
  ...over,
});

/** Tam FK zincirli örnek projeksiyon (org → dept → pos/emp → detaylar). */
const fullProjection = (): HrProjection =>
  emptyProjection({
    orgUnits: [
      { companyId: 2, clientId: 'ou_1', parentClientId: null, name: 'GM', code: 'GM' },
      { companyId: 2, clientId: 'ou_2', parentClientId: 'ou_1', name: 'Şube', code: null },
    ],
    departments: [
      {
        companyId: 2,
        clientId: 'dept_1',
        orgUnitClientId: 'ou_1',
        name: 'Yazılım',
        code: 'YZL',
        managerEmployeeClientId: 'emp_1',
      },
    ],
    positions: [
      {
        companyId: 2,
        clientId: 'pos_1',
        departmentClientId: 'dept_1',
        title: 'Dev',
        description: null,
        status: 'open',
        headcountTarget: 1,
        minSalary: null,
        maxSalary: null,
      },
    ],
    employees: [
      {
        companyId: 2,
        clientId: 'emp_1',
        departmentClientId: 'dept_1',
        employeeNo: 'S-1',
        firstName: 'Ali',
        lastName: 'Veli',
        tcKimlik: null,
        email: null,
        phone: null,
        hireDate: '2025-03-01',
        terminationDate: null,
        status: 'active',
        employmentType: 'full_time',
      },
    ],
    candidates: [
      {
        companyId: 2,
        clientId: 'cand_1',
        firstName: 'Ayşe',
        lastName: 'Kaya',
        email: null,
        phone: null,
        source: 'direct',
        cvUrl: null,
        notes: null,
      },
    ],
    applications: [
      {
        companyId: 2,
        clientId: 'app_1',
        candidateClientId: 'cand_1',
        positionClientId: 'pos_1',
        stage: 'interview',
        stageChangedAt: null,
        rejectionReason: null,
        salaryExpectation: null,
        notes: null,
      },
    ],
    leaveRequests: [
      {
        companyId: 2,
        clientId: 'lr_1',
        employeeClientId: 'emp_1',
        leaveType: 'annual',
        startDate: '2026-07-01',
        endDate: '2026-07-05',
        days: 3,
        reason: null,
        status: 'approved',
        decidedAt: null,
        decisionNote: null,
      },
    ],
    payrollRuns: [
      {
        companyId: 2,
        clientId: 'pr_1',
        periodYear: 2026,
        periodMonth: 6,
        status: 'finalized',
        finalizedAt: '2026-07-01T00:00:00Z',
      },
    ],
    payrollItems: [
      {
        companyId: 2,
        clientId: 'pr_1:emp_1',
        runClientId: 'pr_1',
        employeeClientId: 'emp_1',
        grossSalary: 1000,
        sgkEmployee: 140,
        unemployment: 10,
        incomeTax: 90,
        stampTax: 10,
        otherDeductions: 50,
        netSalary: 700,
      },
    ],
    assets: [
      {
        companyId: 2,
        clientId: 'as_1',
        assetType: 'laptop',
        name: 'Dell XPS',
        brand: 'Dell',
        model: 'XPS',
        serialNo: null,
        status: 'assigned',
        assignedEmployeeClientId: 'emp_1',
        notes: null,
      },
    ],
    assetAssignments: [
      {
        companyId: 2,
        clientId: 'as_1',
        assetClientId: 'as_1',
        employeeClientId: 'emp_1',
        assignedAt: '2026-05-01',
      },
    ],
  });

describe('PgHrProjectionRepository', () => {
  it('happy: tek transaction; FK zinciri serial id haritalarıyla çözülür (org→dept→pos/emp→detay)', async () => {
    const { pool, calls, released } = makeFakePool();
    const repo = new PgHrProjectionRepository(pool);

    await repo.replaceAll(fullProjection());

    assert.equal(calls[0]!.sql, 'BEGIN');
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
    assert.ok(released());

    // org_units: 2 insert (100, 101); ou_2'nin parent'ı 2. geçişte 100'e bağlanır.
    const ouParent = calls.find((c) =>
      c.sql.includes('UPDATE org_units SET parent_id = $1 WHERE id = $2'),
    );
    assert.ok(ouParent);
    assert.deepEqual(ouParent.values, [100, 101]);

    // departments: org_unit_id = 100 (ou_1 serial'ı).
    const deptInsert = calls.find((c) => c.sql.includes('INSERT INTO departments'));
    assert.ok(deptInsert);
    assert.equal(deptInsert.values![1], 100);
    assert.equal(deptInsert.values![4], 'dept_1'); // client_id

    // positions: department_id = 102 (dept_1 serial'ı).
    const posInsert = calls.find((c) => c.sql.includes('INSERT INTO positions'));
    assert.ok(posInsert);
    assert.equal(posInsert.values![1], 102);

    // employees: department_id = 102, doğal anahtar devralma arbiter'ı.
    const empInsert = calls.find((c) => c.sql.includes('INSERT INTO employees'));
    assert.ok(empInsert);
    assert.ok(empInsert.sql.includes('ON CONFLICT (company_id, employee_no)'));
    assert.equal(empInsert.values![1], 102);
    assert.equal(empInsert.values![12], 'emp_1');

    // departman yöneticisi 2. geçişte çalışan serial'ına (104) bağlanır.
    const mgr = calls.find((c) => c.sql.includes('SET manager_employee_id = $1'));
    assert.ok(mgr);
    assert.deepEqual(mgr.values, [104, 'dept_1']);

    // applications: candidate_id (105) + position_id (103).
    const appInsert = calls.find((c) => c.sql.includes('INSERT INTO applications'));
    assert.ok(appInsert);
    assert.equal(appInsert.values![1], 105);
    assert.equal(appInsert.values![2], 103);
    assert.equal(appInsert.values![3], 'interview');

    // leave: employee_id = 104.
    const leaveInsert = calls.find((c) => c.sql.includes('INSERT INTO hr_leave_requests'));
    assert.ok(leaveInsert);
    assert.equal(leaveInsert.values![1], 104);
    assert.equal(leaveInsert.values![2], 'annual');

    // payroll run devralma arbiter'ı + item run/employee çözümü.
    const runInsert = calls.find((c) => c.sql.includes('INSERT INTO hr_payroll_runs'));
    assert.ok(runInsert);
    assert.ok(runInsert.sql.includes('ON CONFLICT (company_id, period_year, period_month)'));
    const itemInsert = calls.find((c) => c.sql.includes('INSERT INTO hr_payroll_items'));
    assert.ok(itemInsert);
    assert.equal(itemInsert.values![1], 106); // run serial
    assert.equal(itemInsert.values![2], 104); // employee serial
    assert.ok(itemInsert.sql.includes('ON CONFLICT (run_id, employee_id)'));

    // asset: assigned_employee_id = 104; atama asset (107) + employee (104).
    const assetInsert = calls.find((c) => c.sql.includes('INSERT INTO hr_assets'));
    assert.ok(assetInsert);
    assert.equal(assetInsert.values![7], 104);
    const asgInsert = calls.find((c) => c.sql.includes('INSERT INTO hr_asset_assignments'));
    assert.ok(asgInsert);
    assert.equal(asgInsert.values![1], 107);
    assert.equal(asgInsert.values![2], 104);
  });

  it('detaylar delete-then-insert: 4 detay tablosu client_id IS NOT NULL guard ile silinir; prune sırası çocuktan ebeveyne', async () => {
    const { pool, calls } = makeFakePool();
    const repo = new PgHrProjectionRepository(pool);

    await repo.replaceAll(fullProjection());

    for (const table of [
      'hr_asset_assignments',
      'hr_payroll_items',
      'applications',
      'hr_leave_requests',
    ]) {
      assert.ok(
        calls.some((c) => c.sql.includes(`DELETE FROM ${table} WHERE client_id IS NOT NULL`)),
        `${table} delete-then-insert guard`,
      );
    }

    // Prune'lar: yalnız projeksiyon-sahipli satırlar + güncel küme dışındakiler.
    const pruneIndex = (table: string): number =>
      calls.findIndex(
        (c) => c.sql.includes(`DELETE FROM ${table}`) && c.sql.includes('NOT (client_id'),
      );
    const empPrune = pruneIndex('employees');
    const deptPrune = pruneIndex('departments');
    const ouPrune = pruneIndex('org_units');
    assert.ok(empPrune >= 0 && deptPrune >= 0 && ouPrune >= 0);
    assert.ok(empPrune < deptPrune && deptPrune < ouPrune, 'çocuktan ebeveyne prune sırası');
    assert.deepEqual(calls[empPrune]!.values, [['emp_1']]);

    // org_units prune'undan önce doomed parent bağları kesilir.
    const detach = calls.findIndex(
      (c) => c.sql.includes('UPDATE org_units SET parent_id = NULL') && c.sql.includes('NOT ('),
    );
    assert.ok(detach >= 0 && detach < ouPrune);
  });

  it('mevcut satır UPDATE ile güncellenir (serial id kararlı); INSERT atılmaz', async () => {
    const { pool, calls } = makeFakePool({ existingClientIds: ['ou_1'] });
    const repo = new PgHrProjectionRepository(pool);

    await repo.replaceAll(
      emptyProjection({
        orgUnits: [
          { companyId: 2, clientId: 'ou_1', parentClientId: null, name: 'GM', code: null },
        ],
      }),
    );

    const update = calls.find(
      (c) => c.sql.trimStart().startsWith('UPDATE org_units') && c.sql.includes('WHERE client_id'),
    );
    assert.ok(update);
    assert.deepEqual(update.values, [2, 'GM', null, 'ou_1']);
    assert.equal(
      calls.some((c) => c.sql.includes('INSERT INTO org_units')),
      false,
    );
  });

  it('boş projeksiyon → tüm projeksiyon-sahipli satırlar budanır, hiç INSERT üretilmez', async () => {
    const { pool, calls } = makeFakePool();
    const repo = new PgHrProjectionRepository(pool);

    await repo.replaceAll(emptyProjection());

    for (const table of [
      'employees',
      'candidates',
      'positions',
      'hr_assets',
      'departments',
      'org_units',
      'hr_payroll_runs',
    ]) {
      const prune = calls.find(
        (c) => c.sql.includes(`DELETE FROM ${table}`) && c.sql.includes('client_id IS NOT NULL'),
      );
      assert.ok(prune, `${table} prune`);
      assert.deepEqual(prune.values, [[]]);
    }
    assert.equal(
      calls.some((c) => c.sql.includes('INSERT INTO')),
      false,
    );
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
  });

  it("companies'te olmayan company_id'li satırlar FK ihlali yerine DÜŞÜRÜLÜR (bağlı detaylar dahil)", async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { pool, calls } = makeFakePool({ companies: [1] });
      const repo = new PgHrProjectionRepository(pool);

      const p = fullProjection(); // hepsi companyId 2 → hepsi düşer
      p.orgUnits.push({
        companyId: 1,
        clientId: 'ou_ok',
        parentClientId: null,
        name: 'Var',
        code: null,
      });
      await repo.replaceAll(p);

      const inserts = calls.filter((c) => c.sql.includes('INSERT INTO'));
      assert.equal(inserts.length, 1); // yalnız ou_ok
      assert.equal(inserts[0]!.values![3], 'ou_ok');
      // Prune kümeleri düşürülen satırları içermez → eski projeksiyonları silinir.
      const empPrune = calls.find(
        (c) => c.sql.includes('DELETE FROM employees') && c.sql.includes('NOT (client_id'),
      );
      assert.deepEqual(empPrune!.values, [[]]);
      assert.ok(errSpy.mock.calls.length >= 1);
    } finally {
      errSpy.mock.restore();
    }
  });

  it('haritada çözülemeyen FK: çalışan düşürülür (INSERT üretilmez), transaction COMMIT eder', async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { pool, calls } = makeFakePool();
      const repo = new PgHrProjectionRepository(pool);

      await repo.replaceAll(
        emptyProjection({
          employees: [
            {
              companyId: 2,
              clientId: 'emp_yetim',
              departmentClientId: 'dept_hic_yok', // departman projeksiyonda yok
              employeeNo: 'S-9',
              firstName: 'X',
              lastName: 'Y',
              tcKimlik: null,
              email: null,
              phone: null,
              hireDate: '2025-01-01',
              terminationDate: null,
              status: 'active',
              employmentType: 'full_time',
            },
          ],
        }),
      );

      assert.equal(
        calls.some((c) => c.sql.includes('INSERT INTO employees')),
        false,
      );
      assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
      assert.ok(errSpy.mock.calls.length >= 1);
    } finally {
      errSpy.mock.restore();
    }
  });

  it('hata → ROLLBACK + release; hata çağırana fırlar (use-case yutar)', async () => {
    const { pool, calls, released } = makeFakePool({
      failOn: (sql) => sql.includes('INSERT INTO departments'),
    });
    const repo = new PgHrProjectionRepository(pool);

    await assert.rejects(() => repo.replaceAll(fullProjection()), /patladı/);
    assert.ok(calls.some((c) => c.sql === 'ROLLBACK'));
    assert.equal(
      calls.some((c) => c.sql === 'COMMIT'),
      false,
    );
    assert.ok(released());
  });
});
