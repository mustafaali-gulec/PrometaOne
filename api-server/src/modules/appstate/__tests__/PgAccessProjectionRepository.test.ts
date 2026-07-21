/**
 * PgAccessProjectionRepository birim testleri — SQL üretimi mock Pool/Client
 * ile doğrulanır (rol upsert + prune, grant/override delete-then-insert,
 * FK-siz şirket düşürme, rollback).
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import type { AccessProjection } from '../domain/AccessProjection.js';
import {
  PgAccessProjectionRepository,
  type AccessProjectionPool,
  type AccessProjectionPoolClient,
} from '../infrastructure/persistence/PgAccessProjectionRepository.js';

interface RecordedCall {
  sql: string;
  values: readonly unknown[] | undefined;
}

interface FakeOptions {
  companies?: number[];
  /** UPDATE ... WHERE client_id — bu client_id'ler "var" sayılır (rowCount 1). */
  existingRoleClientIds?: string[];
  failOn?: (sql: string) => boolean;
}

function makeFakePool(opts: FakeOptions = {}): {
  pool: AccessProjectionPool;
  calls: RecordedCall[];
  released: () => boolean;
} {
  const calls: RecordedCall[] = [];
  let released = false;
  let nextId = 100;
  const client: AccessProjectionPoolClient = {
    async query(sql: string, values?: readonly unknown[]) {
      calls.push({ sql, values });
      if (opts.failOn?.(sql)) throw new Error('patladı');
      if (sql.includes('SELECT id FROM companies')) {
        return { rows: (opts.companies ?? [1, 2, 3, 7]).map((id) => ({ id })) };
      }
      if (sql.startsWith('UPDATE access_custom_roles')) {
        const clientId = values?.[4];
        const exists = (opts.existingRoleClientIds ?? []).includes(String(clientId));
        return exists ? { rows: [{ id: nextId++ }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO access_custom_roles')) {
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

const projection = (over: Partial<AccessProjection> = {}): AccessProjection => ({
  roles: [],
  grants: [],
  overrides: [],
  ...over,
});

describe('PgAccessProjectionRepository', () => {
  it('happy: rol insert + grant/override delete-then-insert, tek transaction, role_id çözümü', async () => {
    const { pool, calls, released } = makeFakePool();
    const repo = new PgAccessProjectionRepository(pool);

    await repo.replaceAll(
      projection({
        roles: [
          {
            companyId: 1,
            clientId: 'role_1',
            name: 'Muhasebe',
            description: null,
            permissions: ['hr.view'],
          },
        ],
        grants: [
          {
            companyId: 1,
            clientId: 'grant_1',
            roleClientId: 'role_1',
            subjectType: 'user',
            subjectId: 'ali',
            cascade: true,
            validFrom: null,
            validUntil: null,
          },
        ],
        overrides: [
          {
            companyId: 1,
            clientId: 'ovr_1',
            username: 'ali',
            resource: 'hr',
            action: 'view',
            allow: true,
            expiresAt: null,
          },
        ],
      }),
    );

    assert.equal(calls[0]!.sql, 'BEGIN');
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
    assert.ok(released());

    // Rol: önce UPDATE (yok → rowCount 0), sonra INSERT ... ON CONFLICT (company_id, name).
    const roleInsert = calls.find((c) => c.sql.includes('INSERT INTO access_custom_roles'));
    assert.ok(roleInsert);
    assert.ok(roleInsert.sql.includes('ON CONFLICT (company_id, name)'));
    assert.deepEqual(roleInsert.values, [1, 'Muhasebe', null, ['hr.view'], 'role_1']);

    // Rol prune: güncel client_id kümesi dışındakiler silinir.
    const rolePrune = calls.find(
      (c) => c.sql.includes('DELETE FROM access_custom_roles') && c.sql.includes('NOT (client_id'),
    );
    assert.ok(rolePrune);
    assert.deepEqual(rolePrune.values, [['role_1']]);

    // Grant: delete-all-then-insert; role_id, rol upsert'inin RETURNING id'sidir (100).
    const grantDelete = calls.find((c) =>
      c.sql.includes('DELETE FROM access_role_grants WHERE client_id IS NOT NULL'),
    );
    assert.ok(grantDelete);
    const grantInsert = calls.find((c) => c.sql.includes('INSERT INTO access_role_grants'));
    assert.ok(grantInsert);
    assert.deepEqual(grantInsert.values, [1, 100, 'user', 'ali', true, null, null, 'grant_1']);

    // Override: delete-all-then-insert + doğal anahtar devralma.
    const ovrInsert = calls.find((c) => c.sql.includes('INSERT INTO access_permission_overrides'));
    assert.ok(ovrInsert);
    assert.ok(ovrInsert.sql.includes('ON CONFLICT (company_id, username, resource, action)'));
    assert.deepEqual(ovrInsert.values, [1, 'ali', 'hr', 'view', true, null, 'ovr_1']);
  });

  it('mevcut rol UPDATE ile güncellenir (id kararlı); INSERT atılmaz', async () => {
    const { pool, calls } = makeFakePool({ existingRoleClientIds: ['role_1'] });
    const repo = new PgAccessProjectionRepository(pool);

    await repo.replaceAll(
      projection({
        roles: [
          { companyId: 1, clientId: 'role_1', name: 'Yeni Ad', description: 'd', permissions: [] },
        ],
      }),
    );

    const update = calls.find((c) => c.sql.startsWith('UPDATE access_custom_roles'));
    assert.ok(update);
    assert.deepEqual(update.values, [1, 'Yeni Ad', 'd', [], 'role_1']);
    assert.equal(
      calls.some((c) => c.sql.includes('INSERT INTO access_custom_roles')),
      false,
    );
  });

  it('boş projeksiyon → projeksiyon-sahipli satırlar budanır (CRUD satırları dokunulmaz)', async () => {
    const { pool, calls } = makeFakePool();
    const repo = new PgAccessProjectionRepository(pool);

    await repo.replaceAll(projection());

    // Rol prune boş kümeyle → tüm client_id IS NOT NULL satırlar gider.
    const rolePrune = calls.find((c) => c.sql.includes('DELETE FROM access_custom_roles'));
    assert.ok(rolePrune);
    assert.ok(rolePrune.sql.includes('client_id IS NOT NULL'));
    assert.deepEqual(rolePrune.values, [[]]);

    assert.ok(
      calls.some((c) =>
        c.sql.includes('DELETE FROM access_role_grants WHERE client_id IS NOT NULL'),
      ),
    );
    assert.ok(
      calls.some((c) =>
        c.sql.includes('DELETE FROM access_permission_overrides WHERE client_id IS NOT NULL'),
      ),
    );
    // Hiç INSERT üretilmez.
    assert.equal(
      calls.some((c) => c.sql.includes('INSERT INTO')),
      false,
    );
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
  });

  it("companies'te olmayan company_id'li satırlar FK ihlali yerine DÜŞÜRÜLÜR", async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { pool, calls } = makeFakePool({ companies: [1] });
      const repo = new PgAccessProjectionRepository(pool);

      await repo.replaceAll(
        projection({
          roles: [
            { companyId: 1, clientId: 'role_ok', name: 'Var', description: null, permissions: [] },
            {
              companyId: 99,
              clientId: 'role_yok',
              name: 'Şirketi yok',
              description: null,
              permissions: [],
            },
          ],
        }),
      );

      const inserts = calls.filter((c) => c.sql.includes('INSERT INTO access_custom_roles'));
      assert.equal(inserts.length, 1);
      assert.equal(inserts[0]!.values![4], 'role_ok');
      // Prune kümesi de düşürülmüş satırı içermez → eski projeksiyonu varsa silinir.
      const rolePrune = calls.find((c) => c.sql.includes('DELETE FROM access_custom_roles'));
      assert.deepEqual(rolePrune!.values, [['role_ok']]);
      assert.ok(errSpy.mock.calls.length >= 1);
    } finally {
      errSpy.mock.restore();
    }
  });

  it('roleClientId çözülemeyen grant düşürülür (INSERT üretilmez)', async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { pool, calls } = makeFakePool();
      const repo = new PgAccessProjectionRepository(pool);

      await repo.replaceAll(
        projection({
          grants: [
            {
              companyId: 1,
              clientId: 'grant_yetim',
              roleClientId: 'role_bilinmez',
              subjectType: 'user',
              subjectId: 'ali',
              cascade: true,
              validFrom: null,
              validUntil: null,
            },
          ],
        }),
      );

      assert.equal(
        calls.some((c) => c.sql.includes('INSERT INTO access_role_grants')),
        false,
      );
      assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
    } finally {
      errSpy.mock.restore();
    }
  });

  it('hata → ROLLBACK + release; hata çağırana fırlar (use-case yutar)', async () => {
    const { pool, calls, released } = makeFakePool({
      failOn: (sql) => sql.includes('INSERT INTO access_custom_roles'),
    });
    const repo = new PgAccessProjectionRepository(pool);

    await assert.rejects(
      () =>
        repo.replaceAll(
          projection({
            roles: [
              { companyId: 1, clientId: 'role_1', name: 'X', description: null, permissions: [] },
            ],
          }),
        ),
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
