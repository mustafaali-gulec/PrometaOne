/**
 * PgHrProjectionRepository birim testleri — SQL üretimi mock Pool/Client ile
 * doğrulanır (üst entite upsert + prune, detay delete-then-insert, FK serial
 * çözümü, FK-siz şirket düşürme, rollback) + MEZUNİYET: org_units/departments
 * tablolarına ASLA yazılmaz/prune edilmez; çalışan/pozisyon departman bağları
 * DB'deki geçerli kümeden (client_id haritası + sayısal id doğrulaması) çözülür.
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

interface FakeDeptRow {
  id: number;
  company_id: number;
  client_id: string | null;
}

interface FakeOptions {
  companies?: number[];
  /** Departman çözücü SELECT'inin döneceği satırlar (MEZUN tablo içeriği). */
  departments?: FakeDeptRow[];
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
      if (sql.includes('SELECT id, company_id, client_id FROM departments')) {
        return { rows: opts.departments ?? [] };
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

const employee = (
  clientId: string,
  departmentClientId: string,
  over: Partial<HrProjection['employees'][number]> = {},
): HrProjection['employees'][number] => ({
  companyId: 2,
  clientId,
  departmentClientId,
  employeeNo: `S-${clientId}`,
  firstName: 'Ali',
  lastName: 'Veli',
  tcKimlik: null,
  email: null,
  phone: null,
  hireDate: '2025-03-01',
  terminationDate: null,
  status: 'active',
  employmentType: 'full_time',
  ...over,
});

/** Tam FK zincirli örnek projeksiyon (pos/emp → detaylar; org/dept MEZUN → boş). */
const fullProjection = (): HrProjection =>
  emptyProjection({
    positions: [
      {
        companyId: 2,
        clientId: 'pos_1',
        departmentClientId: 'dept_1', // DB client_id haritasından çözülür
        title: 'Dev',
        description: null,
        status: 'open',
        headcountTarget: 1,
        minSalary: null,
        maxSalary: null,
      },
    ],
    employees: [employee('emp_1', 'dept_1', { employeeNo: 'S-1' })],
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

/** fullProjection'ın çözülmesi için MEZUN departments tablosu içeriği. */
const deptRows: FakeDeptRow[] = [{ id: 12, company_id: 2, client_id: 'dept_1' }];

describe('PgHrProjectionRepository', () => {
  it('happy: tek transaction; FK zinciri serial id haritalarıyla çözülür; departman DB kümesinden', async () => {
    const { pool, calls, released } = makeFakePool({ departments: deptRows });
    const repo = new PgHrProjectionRepository(pool);

    await repo.replaceAll(fullProjection());

    assert.equal(calls[0]!.sql, 'BEGIN');
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
    assert.ok(released());

    // positions (100): department_id MEZUN tablodan client_id haritasıyla = 12.
    const posInsert = calls.find((c) => c.sql.includes('INSERT INTO positions'));
    assert.ok(posInsert);
    assert.equal(posInsert.values![1], 12);

    // employees (101): department_id = 12, doğal anahtar devralma arbiter'ı.
    const empInsert = calls.find((c) => c.sql.includes('INSERT INTO employees'));
    assert.ok(empInsert);
    assert.ok(empInsert.sql.includes('ON CONFLICT (company_id, employee_no)'));
    assert.equal(empInsert.values![1], 12);
    assert.equal(empInsert.values![12], 'emp_1');

    // applications: candidate_id (102) + position_id (100).
    const appInsert = calls.find((c) => c.sql.includes('INSERT INTO applications'));
    assert.ok(appInsert);
    assert.equal(appInsert.values![1], 102);
    assert.equal(appInsert.values![2], 100);
    assert.equal(appInsert.values![3], 'interview');

    // leave: employee_id = 101.
    const leaveInsert = calls.find((c) => c.sql.includes('INSERT INTO hr_leave_requests'));
    assert.ok(leaveInsert);
    assert.equal(leaveInsert.values![1], 101);
    assert.equal(leaveInsert.values![2], 'annual');

    // payroll run devralma arbiter'ı + item run/employee çözümü.
    const runInsert = calls.find((c) => c.sql.includes('INSERT INTO hr_payroll_runs'));
    assert.ok(runInsert);
    assert.ok(runInsert.sql.includes('ON CONFLICT (company_id, period_year, period_month)'));
    const itemInsert = calls.find((c) => c.sql.includes('INSERT INTO hr_payroll_items'));
    assert.ok(itemInsert);
    assert.equal(itemInsert.values![1], 103); // run serial
    assert.equal(itemInsert.values![2], 101); // employee serial
    assert.ok(itemInsert.sql.includes('ON CONFLICT (run_id, employee_id)'));

    // asset: assigned_employee_id = 101; atama asset (104) + employee (101).
    const assetInsert = calls.find((c) => c.sql.includes('INSERT INTO hr_assets'));
    assert.ok(assetInsert);
    assert.equal(assetInsert.values![7], 101);
    const asgInsert = calls.find((c) => c.sql.includes('INSERT INTO hr_asset_assignments'));
    assert.ok(asgInsert);
    assert.equal(asgInsert.values![1], 104);
    assert.equal(asgInsert.values![2], 101);
  });

  it('MEZUNİYET: org_units tablosuna HİÇ dokunulmaz; departments yalnız SALT-OKUNUR çözücü SELECT görür', async () => {
    const { pool, calls } = makeFakePool({ departments: deptRows });
    const repo = new PgHrProjectionRepository(pool);

    await repo.replaceAll(fullProjection());

    assert.equal(
      calls.some((c) => c.sql.includes('org_units')),
      false,
      'org_units SQL üretilmemeli',
    );
    const deptCalls = calls.filter((c) => c.sql.includes('departments'));
    assert.equal(deptCalls.length, 1, 'departments yalnız 1 kez (çözücü SELECT) görülmeli');
    assert.ok(deptCalls[0]!.sql.includes('SELECT id, company_id, client_id FROM departments'));
  });

  it('detaylar delete-then-insert: 4 detay tablosu client_id IS NOT NULL guard ile silinir; prune çocuktan ebeveyne, org/dept prune YOK', async () => {
    const { pool, calls } = makeFakePool({ departments: deptRows });
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
    const posPrune = pruneIndex('positions');
    assert.ok(empPrune >= 0 && posPrune >= 0);
    assert.ok(empPrune < posPrune, 'çocuktan ebeveyne prune sırası');
    assert.deepEqual(calls[empPrune]!.values, [['emp_1']]);

    // MEZUN tablolar prune edilmez (adopt edilen satırlar silinmesin!).
    assert.equal(pruneIndex('departments'), -1);
    assert.equal(pruneIndex('org_units'), -1);
  });

  it('çalışan departman referansı SAYISAL sunucu id: şirketin geçerli kümesindeyse doğrudan kullanılır', async () => {
    const { pool, calls } = makeFakePool({
      departments: [{ id: 34, company_id: 2, client_id: null }], // CRUD/adopt satırı
    });
    const repo = new PgHrProjectionRepository(pool);

    await repo.replaceAll(emptyProjection({ employees: [employee('emp_num', '34')] }));

    const empInsert = calls.find((c) => c.sql.includes('INSERT INTO employees'));
    assert.ok(empInsert);
    assert.equal(empInsert.values![1], 34);
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
  });

  it('çalışan departman referansı geçersiz sayısal id (yabancı şirket/yok): FK ihlali yerine DÜŞER, COMMIT eder', async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { pool, calls } = makeFakePool({
        departments: [{ id: 34, company_id: 9, client_id: null }], // başka şirketin id'si
      });
      const repo = new PgHrProjectionRepository(pool);

      await repo.replaceAll(
        emptyProjection({
          employees: [employee('emp_a', '34'), employee('emp_b', '999')],
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

  it('pozisyon departman referansı çözülemezse NULL yazılır (nullable FK); geçerli sayısal id ise kullanılır', async () => {
    const { pool, calls } = makeFakePool({
      departments: [{ id: 34, company_id: 2, client_id: null }],
    });
    const repo = new PgHrProjectionRepository(pool);

    await repo.replaceAll(
      emptyProjection({
        positions: [
          {
            companyId: 2,
            clientId: 'pos_num',
            departmentClientId: '34',
            title: 'A',
            description: null,
            status: 'open',
            headcountTarget: 1,
            minSalary: null,
            maxSalary: null,
          },
          {
            companyId: 2,
            clientId: 'pos_kayip',
            departmentClientId: 'dept_bilinmez',
            title: 'B',
            description: null,
            status: 'draft',
            headcountTarget: 1,
            minSalary: null,
            maxSalary: null,
          },
        ],
      }),
    );

    const inserts = calls.filter((c) => c.sql.includes('INSERT INTO positions'));
    assert.equal(inserts.length, 2);
    const byClient = new Map(inserts.map((c) => [c.values![8], c.values![1]]));
    assert.equal(byClient.get('pos_num'), 34);
    assert.equal(byClient.get('pos_kayip'), null);
  });

  it('mevcut satır UPDATE ile güncellenir (serial id kararlı); INSERT atılmaz', async () => {
    const { pool, calls } = makeFakePool({
      departments: deptRows,
      existingClientIds: ['pos_1'],
    });
    const repo = new PgHrProjectionRepository(pool);

    await repo.replaceAll(
      emptyProjection({
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
      }),
    );

    const update = calls.find(
      (c) => c.sql.trimStart().startsWith('UPDATE positions') && c.sql.includes('WHERE client_id'),
    );
    assert.ok(update);
    assert.equal(update.values![1], 12); // department_id çözüldü
    assert.equal(update.values![8], 'pos_1');
    assert.equal(
      calls.some((c) => c.sql.includes('INSERT INTO positions')),
      false,
    );
  });

  it('boş projeksiyon → projeksiyon-sahipli satırlar budanır (org/dept HARİÇ), hiç INSERT üretilmez', async () => {
    const { pool, calls } = makeFakePool();
    const repo = new PgHrProjectionRepository(pool);

    await repo.replaceAll(emptyProjection());

    for (const table of ['employees', 'candidates', 'positions', 'hr_assets', 'hr_payroll_runs']) {
      const prune = calls.find(
        (c) => c.sql.includes(`DELETE FROM ${table}`) && c.sql.includes('client_id IS NOT NULL'),
      );
      assert.ok(prune, `${table} prune`);
      assert.deepEqual(prune.values, [[]]);
    }
    // MEZUN tablolar boş kümede bile prune edilmez.
    assert.equal(
      calls.some((c) => c.sql.includes('DELETE FROM departments')),
      false,
    );
    assert.equal(
      calls.some((c) => c.sql.includes('org_units')),
      false,
    );
    assert.equal(
      calls.some((c) => c.sql.includes('INSERT INTO')),
      false,
    );
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
  });

  it("companies'te olmayan company_id'li satırlar FK ihlali yerine DÜŞÜRÜLÜR (bağlı detaylar dahil)", async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { pool, calls } = makeFakePool({ companies: [1], departments: deptRows });
      const repo = new PgHrProjectionRepository(pool);

      const p = fullProjection(); // hepsi companyId 2 → hepsi düşer
      p.candidates.push({
        companyId: 1,
        clientId: 'cand_ok',
        firstName: 'Var',
        lastName: 'Olan',
        email: null,
        phone: null,
        source: 'direct',
        cvUrl: null,
        notes: null,
      });
      await repo.replaceAll(p);

      const inserts = calls.filter((c) => c.sql.includes('INSERT INTO'));
      assert.equal(inserts.length, 1); // yalnız cand_ok
      assert.equal(inserts[0]!.values![8], 'cand_ok');
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

  it('haritada çözülemeyen departman referansı: çalışan düşürülür (INSERT üretilmez), transaction COMMIT eder', async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { pool, calls } = makeFakePool(); // departments tablosu boş
      const repo = new PgHrProjectionRepository(pool);

      await repo.replaceAll(
        emptyProjection({ employees: [employee('emp_yetim', 'dept_hic_yok')] }),
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
      departments: deptRows,
      failOn: (sql) => sql.includes('INSERT INTO positions'),
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
