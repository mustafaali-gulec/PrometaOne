/**
 * PgAdoptHrOrgRepository birim testleri — SQL üretimi mock Pool/Client ile
 * doğrulanır: tek transaction, ON CONFLICT (company_id, client_id) upsert
 * (idempotens), parent/orgUnit iki kademeli çözüm (çağrı-içi + DB'deki önceki
 * adopt), manager employees.client_id bağlama, 23505 → conflict, rollback.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  NormalizedAdoptDepartment,
  NormalizedAdoptOrgUnit,
} from '../../application/dto/AdoptHrOrgDtos.js';
import { HrOrgAdoptConflictError } from '../../application/errors/HrErrors.js';
import {
  PgAdoptHrOrgRepository,
  type AdoptHrOrgPool,
  type AdoptHrOrgPoolClient,
} from '../../infrastructure/persistence/PgAdoptHrOrgRepository.js';

interface RecordedCall {
  sql: string;
  values: readonly unknown[] | undefined;
}

interface FakeOptions {
  /** SELECT ... FROM org_units lookup'ının döneceği satırlar (önceki adopt). */
  dbOrgUnits?: Array<{ id: number; client_id: string }>;
  /** SELECT ... FROM employees lookup'ının döneceği satırlar. */
  dbEmployees?: Array<{ id: number; client_id: string }>;
  failOn?: (sql: string) => boolean;
}

function makeFakePool(opts: FakeOptions = {}): {
  pool: AdoptHrOrgPool;
  calls: RecordedCall[];
  released: () => boolean;
} {
  const calls: RecordedCall[] = [];
  let released = false;
  let nextId = 100;
  const client: AdoptHrOrgPoolClient = {
    async query(sql: string, values?: readonly unknown[]) {
      calls.push({ sql, values });
      if (opts.failOn?.(sql)) throw new Error('patladı');
      if (sql.includes('FROM org_units')) {
        return { rows: opts.dbOrgUnits ?? [] };
      }
      if (sql.includes('FROM employees')) {
        return { rows: opts.dbEmployees ?? [] };
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

const ou = (
  clientId: string,
  over: Partial<NormalizedAdoptOrgUnit> = {},
): NormalizedAdoptOrgUnit => ({
  clientId,
  name: `Birim ${clientId}`,
  code: null,
  parentClientId: null,
  ...over,
});

const dept = (
  clientId: string,
  over: Partial<NormalizedAdoptDepartment> = {},
): NormalizedAdoptDepartment => ({
  clientId,
  name: `Departman ${clientId}`,
  code: null,
  orgUnitClientId: null,
  managerEmployeeClientId: null,
  ...over,
});

describe('PgAdoptHrOrgRepository', () => {
  it('happy: tek transaction; ON CONFLICT (company_id, client_id) upsert; çağrı-içi parent/orgUnit çözümü; manager bağlanır', async () => {
    const { pool, calls, released } = makeFakePool({
      dbEmployees: [{ id: 77, client_id: 'emp_ali' }],
    });
    const repo = new PgAdoptHrOrgRepository(pool);

    const outcome = await repo.adoptAll(1, {
      orgUnits: [ou('ou_gm', { code: 'GM' }), ou('ou_sube', { parentClientId: 'ou_gm' })],
      departments: [
        dept('dept_yzl', { orgUnitClientId: 'ou_sube', managerEmployeeClientId: 'emp_ali' }),
      ],
    });

    assert.equal(calls[0]!.sql, 'BEGIN');
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
    assert.ok(released());

    // Upsert'ler idempotens anahtarıyla: ON CONFLICT (company_id, client_id).
    const ouInserts = calls.filter((c) => c.sql.includes('INSERT INTO org_units'));
    assert.equal(ouInserts.length, 2);
    for (const c of ouInserts) {
      assert.ok(c.sql.includes('ON CONFLICT (company_id, client_id)'));
      assert.ok(c.sql.includes('DO UPDATE'));
    }
    // 1. geçişte parent_id NULL; 2. geçişte çağrı-içi haritayla bağlanır.
    const parentLink = calls.find((c) =>
      c.sql.includes('UPDATE org_units SET parent_id = $1 WHERE id = $2'),
    );
    assert.ok(parentLink);
    assert.deepEqual(parentLink.values, [100, 101]); // ou_gm=100 ← ou_sube=101

    // Departman: org_unit_id çağrı-içi (101), manager employees.client_id'den (77).
    const deptInsert = calls.find((c) => c.sql.includes('INSERT INTO departments'));
    assert.ok(deptInsert);
    assert.ok(deptInsert.sql.includes('ON CONFLICT (company_id, client_id)'));
    assert.deepEqual(deptInsert.values, [1, 101, 'Departman dept_yzl', null, 77, 'dept_yzl']);

    // idMap: clientId → serverId.
    assert.deepEqual(outcome.orgUnitIdByClient, { ou_gm: 100, ou_sube: 101 });
    assert.deepEqual(outcome.departmentIdByClient, { dept_yzl: 102 });

    // Manager lookup şirket kapsamlıdır.
    const empLookup = calls.find((c) => c.sql.includes('FROM employees'));
    assert.ok(empLookup);
    assert.equal(empLookup.values![0], 1);
    assert.deepEqual(empLookup.values![1], ['emp_ali']);
  });

  it("DB-önceki çözüm: çağrıda olmayan parent/orgUnit referansları org_units.client_id'den bulunur", async () => {
    const { pool, calls } = makeFakePool({
      dbOrgUnits: [{ id: 55, client_id: 'ou_onceki' }],
    });
    const repo = new PgAdoptHrOrgRepository(pool);

    await repo.adoptAll(1, {
      orgUnits: [ou('ou_yeni', { parentClientId: 'ou_onceki' })],
      departments: [dept('dept_d', { orgUnitClientId: 'ou_onceki' })],
    });

    // Parent DB'den (55) çözüldü; yeni birim 100.
    const parentLink = calls.find((c) =>
      c.sql.includes('UPDATE org_units SET parent_id = $1 WHERE id = $2'),
    );
    assert.ok(parentLink);
    assert.deepEqual(parentLink.values, [55, 100]);

    // Departmanın org_unit_id'si de DB'den 55.
    const deptInsert = calls.find((c) => c.sql.includes('INSERT INTO departments'));
    assert.ok(deptInsert);
    assert.equal(deptInsert.values![1], 55);

    // Lookup şirket kapsamlı ve yalnız eksik client_id'lerle yapılır.
    const lookups = calls.filter((c) => c.sql.includes('SELECT id, client_id FROM org_units'));
    assert.ok(lookups.length >= 1);
    for (const l of lookups) {
      assert.equal(l.values![0], 1);
      assert.deepEqual(l.values![1], ['ou_onceki']);
    }
  });

  it('çözülemeyen referanslar NULL kalır: parent bağlanmaz, org_unit_id/manager NULL', async () => {
    const { pool, calls } = makeFakePool(); // DB boş
    const repo = new PgAdoptHrOrgRepository(pool);

    await repo.adoptAll(1, {
      orgUnits: [ou('ou_yetim', { parentClientId: 'ou_yok' })],
      departments: [
        dept('dept_yetim', { orgUnitClientId: 'ou_yok', managerEmployeeClientId: 'emp_yok' }),
      ],
    });

    assert.equal(
      calls.some((c) => c.sql.includes('UPDATE org_units SET parent_id')),
      false,
    );
    const deptInsert = calls.find((c) => c.sql.includes('INSERT INTO departments'));
    assert.ok(deptInsert);
    assert.equal(deptInsert.values![1], null); // org_unit_id
    assert.equal(deptInsert.values![4], null); // manager_employee_id
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
  });

  it('boş payload: DB sorgusu üretmeden BEGIN/COMMIT ile boş sonuç döner', async () => {
    const { pool, calls } = makeFakePool();
    const repo = new PgAdoptHrOrgRepository(pool);

    const outcome = await repo.adoptAll(1, { orgUnits: [], departments: [] });

    assert.deepEqual(outcome, { orgUnitIdByClient: {}, departmentIdByClient: {} });
    assert.deepEqual(
      calls.map((c) => c.sql),
      ['BEGIN', 'COMMIT'],
    );
  });

  it('23505 (CRUD koduyla çakışma) → HrOrgAdoptConflictError (409) + ROLLBACK', async () => {
    const calls: RecordedCall[] = [];
    let released = false;
    const client: AdoptHrOrgPoolClient = {
      async query(sql: string, values?: readonly unknown[]) {
        calls.push({ sql, values });
        if (sql.includes('INSERT INTO org_units')) {
          const err = new Error('duplicate key') as Error & { code: string; detail: string };
          err.code = '23505';
          err.detail = 'Key (company_id, code)=(1, GM) already exists.';
          throw err;
        }
        return { rows: [], rowCount: 0 };
      },
      release() {
        released = true;
      },
    };
    const repo = new PgAdoptHrOrgRepository({ connect: async () => client });

    await assert.rejects(
      () => repo.adoptAll(1, { orgUnits: [ou('ou_1', { code: 'GM' })], departments: [] }),
      HrOrgAdoptConflictError,
    );
    assert.ok(calls.some((c) => c.sql === 'ROLLBACK'));
    assert.equal(
      calls.some((c) => c.sql === 'COMMIT'),
      false,
    );
    assert.ok(released);
  });

  it('beklenmeyen hata → ROLLBACK + release; hata çağırana fırlar', async () => {
    const { pool, calls, released } = makeFakePool({
      failOn: (sql) => sql.includes('INSERT INTO departments'),
    });
    const repo = new PgAdoptHrOrgRepository(pool);

    await assert.rejects(
      () => repo.adoptAll(1, { orgUnits: [], departments: [dept('dept_1')] }),
      /patladı/,
    );
    assert.ok(calls.some((c) => c.sql === 'ROLLBACK'));
    assert.equal(
      calls.some((c) => c.sql === 'COMMIT'),
      false,
    );
    assert.ok(released());
  });
});
