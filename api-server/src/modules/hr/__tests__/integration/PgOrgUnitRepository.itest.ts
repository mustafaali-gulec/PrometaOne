/**
 * PgOrgUnitRepository integration test — gerçek PostgreSQL üzerinde.
 *
 * Doğrulanan davranışlar:
 *   - insert/findById/listByCompany/hasChildren CRUD path'leri
 *   - 012_hr.sql'deki cycle-önleyici trigger (`trg_org_units_no_cycle`)
 *   - UNIQUE constraint (`uq_org_units_company_code`) — PG hata kodu 23505
 *   - Multi-tenant izolasyonu (companyId filtreleme)
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { PgOrgUnitRepository } from '../../infrastructure/persistence/PgOrgUnitRepository.js';

import {
  seedCompany,
  startHrPgContainer,
  truncateAuthAndHrTables,
  type HrPgContext,
} from './setup.js';

describe('PgOrgUnitRepository [integration]', () => {
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

  it('insert: yeni root unit ekler, id ve timestamp DB üretir', async () => {
    const repo = new PgOrgUnitRepository(ctx.pool);

    const unit = await repo.insert({
      companyId: 1,
      parentId: null,
      name: 'Genel Müdürlük',
      code: 'HQ',
      sortOrder: 0,
      active: true,
    });

    assert.ok(unit.id > 0, 'id pozitif olmalı');
    assert.equal(unit.name, 'Genel Müdürlük');
    assert.equal(unit.code?.value, 'HQ');
    assert.equal(unit.parentId, null);
    assert.equal(unit.active, true);
    assert.ok(unit.createdAt instanceof Date);
  });

  it('findById: aynı şirketten bulur, farklı şirketten null döner', async () => {
    const repo = new PgOrgUnitRepository(ctx.pool);
    const inserted = await repo.insert({
      companyId: 1,
      parentId: null,
      name: 'HQ',
      code: null,
      sortOrder: 0,
      active: true,
    });

    const found = await repo.findById(inserted.id, 1);
    assert.ok(found);
    assert.equal(found.id, inserted.id);

    // Farklı şirket için null
    await seedCompany(ctx.pool, { id: 2, name: 'Diğer A.Ş.' });
    const otherCompany = await repo.findById(inserted.id, 2);
    assert.equal(otherCompany, null);
  });

  it('listByCompany: sort_order ASC, id ASC sıralı döner; active filtresi çalışır', async () => {
    const repo = new PgOrgUnitRepository(ctx.pool);
    const u1 = await repo.insert({
      companyId: 1,
      parentId: null,
      name: 'B',
      code: null,
      sortOrder: 2,
      active: true,
    });
    const u2 = await repo.insert({
      companyId: 1,
      parentId: null,
      name: 'A',
      code: null,
      sortOrder: 1,
      active: true,
    });
    const u3 = await repo.insert({
      companyId: 1,
      parentId: null,
      name: 'C',
      code: null,
      sortOrder: 3,
      active: false,
    });

    const activeOnly = await repo.listByCompany(1);
    assert.equal(activeOnly.length, 2);
    assert.equal(activeOnly[0]!.id, u2.id);
    assert.equal(activeOnly[1]!.id, u1.id);

    const all = await repo.listByCompany(1, { includeInactive: true });
    assert.equal(all.length, 3);
    assert.equal(all[2]!.id, u3.id);
  });

  it('hasChildren: parent altında child varsa true, yoksa false', async () => {
    const repo = new PgOrgUnitRepository(ctx.pool);
    const root = await repo.insert({
      companyId: 1,
      parentId: null,
      name: 'HQ',
      code: null,
      sortOrder: 0,
      active: true,
    });

    assert.equal(await repo.hasChildren(root.id, 1), false);

    await repo.insert({
      companyId: 1,
      parentId: root.id,
      name: 'IT',
      code: null,
      sortOrder: 0,
      active: true,
    });

    assert.equal(await repo.hasChildren(root.id, 1), true);
  });

  it('trigger: A → B → A cycle UPDATE PG tarafından reddedilir (check_violation)', async () => {
    const repo = new PgOrgUnitRepository(ctx.pool);
    const a = await repo.insert({
      companyId: 1,
      parentId: null,
      name: 'A',
      code: null,
      sortOrder: 0,
      active: true,
    });
    const b = await repo.insert({
      companyId: 1,
      parentId: a.id,
      name: 'B',
      code: null,
      sortOrder: 0,
      active: true,
    });

    // a.parent_id = b.id yapılırsa → a → b → a cycle
    await assert.rejects(
      ctx.pool.query(`UPDATE org_units SET parent_id = $1 WHERE id = $2`, [b.id, a.id]),
      (err: unknown) => {
        const e = err as { code?: string; message?: string };
        // ERRCODE check_violation = '23514'
        assert.equal(e.code, '23514', `beklenen check_violation, gelen: ${e.code} ${e.message}`);
        return true;
      },
    );
  });

  it('trigger: self-cycle (A parent = A) DB CHECK constraint ile reddedilir', async () => {
    const repo = new PgOrgUnitRepository(ctx.pool);
    const a = await repo.insert({
      companyId: 1,
      parentId: null,
      name: 'A',
      code: null,
      sortOrder: 0,
      active: true,
    });

    await assert.rejects(
      ctx.pool.query(`UPDATE org_units SET parent_id = $1 WHERE id = $1`, [a.id]),
      (err: unknown) => {
        const e = err as { code?: string };
        // org_units_no_self_parent CHECK → 23514
        assert.equal(e.code, '23514');
        return true;
      },
    );
  });

  it('UNIQUE: aynı şirkette aynı code iki kez insert edilemez (23505)', async () => {
    const repo = new PgOrgUnitRepository(ctx.pool);
    await repo.insert({
      companyId: 1,
      parentId: null,
      name: 'A',
      code: 'DUP',
      sortOrder: 0,
      active: true,
    });

    await assert.rejects(
      repo.insert({
        companyId: 1,
        parentId: null,
        name: 'B',
        code: 'DUP',
        sortOrder: 0,
        active: true,
      }),
      (err: unknown) => {
        const e = err as { code?: string };
        assert.equal(e.code, '23505');
        return true;
      },
    );
  });

  it('UNIQUE: farklı şirketlerde aynı code kabul edilir', async () => {
    const repo = new PgOrgUnitRepository(ctx.pool);
    await seedCompany(ctx.pool, { id: 2, name: 'Şirket 2' });

    await repo.insert({
      companyId: 1,
      parentId: null,
      name: 'A',
      code: 'SAME',
      sortOrder: 0,
      active: true,
    });
    // Hata fırlatmamalı
    await repo.insert({
      companyId: 2,
      parentId: null,
      name: 'A',
      code: 'SAME',
      sortOrder: 0,
      active: true,
    });

    assert.equal((await repo.listByCompany(1)).length, 1);
    assert.equal((await repo.listByCompany(2)).length, 1);
  });
});
