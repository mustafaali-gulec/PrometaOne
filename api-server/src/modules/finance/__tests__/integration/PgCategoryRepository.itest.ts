/**
 * PgCategoryRepository integration test — gerçek PostgreSQL üzerinde.
 *
 * Doğrulanan davranışlar:
 *   - insert/findById/listByCompany CRUD
 *   - `active` kolonu (015 migration) — arşivleme + includeArchived filtresi
 *   - UNIQUE(company_id, section, name) — 23505
 *   - existsByName case-insensitive (LOWER)
 *   - multi-tenant izolasyon
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { PgCategoryRepository } from '../../infrastructure/persistence/PgCategoryRepository.js';

import {
  seedCompany,
  startFinancePgContainer,
  truncateAllFinanceTables,
  type FinancePgContext,
} from './setup.js';

describe('PgCategoryRepository [integration]', () => {
  let ctx: FinancePgContext;

  before(
    async () => {
      ctx = await startFinancePgContainer();
    },
    { timeout: 180_000 },
  );

  after(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  beforeEach(async () => {
    await truncateAllFinanceTables(ctx.pool);
    await seedCompany(ctx.pool, { id: 1, name: 'Test A.Ş.' });
  });

  it('insert: active varsayılan TRUE döner (015 kolonu)', async () => {
    const repo = new PgCategoryRepository(ctx.pool);
    const cat = await repo.insert({
      companyId: 1,
      section: 'inflows',
      name: 'Satış',
      sortOrder: 0,
    });
    assert.ok(cat.id > 0);
    assert.equal(cat.name, 'Satış');
    assert.equal(cat.section, 'inflows');
    assert.equal(cat.active, true);
  });

  it('archive: active=FALSE update edilir, default listede görünmez', async () => {
    const repo = new PgCategoryRepository(ctx.pool);
    const cat = await repo.insert({
      companyId: 1,
      section: 'outflows',
      name: 'Kira',
      sortOrder: 0,
    });

    await repo.update(cat.archive(new Date()));

    const activeOnly = await repo.listByCompany(1);
    assert.equal(activeOnly.length, 0);

    const withArchived = await repo.listByCompany(1, { includeArchived: true });
    assert.equal(withArchived.length, 1);
    assert.equal(withArchived[0]!.active, false);
  });

  it('listByCompany: section filtresi + sortOrder sıralaması', async () => {
    const repo = new PgCategoryRepository(ctx.pool);
    await repo.insert({ companyId: 1, section: 'inflows', name: 'B', sortOrder: 1 });
    await repo.insert({ companyId: 1, section: 'inflows', name: 'A', sortOrder: 0 });
    await repo.insert({ companyId: 1, section: 'outflows', name: 'C', sortOrder: 0 });

    const inflows = await repo.listByCompany(1, { section: 'inflows' });
    assert.equal(inflows.length, 2);
    assert.equal(inflows[0]!.name, 'A'); // sortOrder 0 önce
    assert.equal(inflows[1]!.name, 'B');
  });

  it('UNIQUE: aynı şirket+section+isim iki kez insert edilemez (23505)', async () => {
    const repo = new PgCategoryRepository(ctx.pool);
    await repo.insert({ companyId: 1, section: 'inflows', name: 'Satış', sortOrder: 0 });

    await assert.rejects(
      repo.insert({ companyId: 1, section: 'inflows', name: 'Satış', sortOrder: 0 }),
      (err: unknown) => {
        assert.equal((err as { code?: string }).code, '23505');
        return true;
      },
    );
  });

  it('existsByName: case-insensitive (LOWER) eşleşir, excludeId hariç tutar', async () => {
    // NOT: ASCII isim kullanılıyor — 'Satış'/'SATIŞ' gibi Türkçe i/ı casing,
    // PG'nin LOWER() davranışı DB lokaline (collation) bağlı olduğundan testi
    // kırılgan yapardı. Case-insensitive davranışın kendisi burada doğrulanıyor.
    const repo = new PgCategoryRepository(ctx.pool);
    const cat = await repo.insert({
      companyId: 1,
      section: 'inflows',
      name: 'Sales',
      sortOrder: 0,
    });

    assert.equal(await repo.existsByName(1, 'inflows', 'sales'), true);
    assert.equal(await repo.existsByName(1, 'inflows', 'SALES'), true);
    assert.equal(await repo.existsByName(1, 'outflows', 'sales'), false);
    // kendi id'sini hariç tutunca çakışma yok
    assert.equal(await repo.existsByName(1, 'inflows', 'Sales', cat.id), false);
  });

  it('multi-tenant: başka şirketin kategorisi görünmez', async () => {
    const repo = new PgCategoryRepository(ctx.pool);
    await seedCompany(ctx.pool, { id: 2, name: 'Şirket 2' });
    const cat = await repo.insert({
      companyId: 1,
      section: 'inflows',
      name: 'Satış',
      sortOrder: 0,
    });

    assert.equal(await repo.findById(cat.id, 2), null);
    assert.ok(await repo.findById(cat.id, 1));
  });
});
