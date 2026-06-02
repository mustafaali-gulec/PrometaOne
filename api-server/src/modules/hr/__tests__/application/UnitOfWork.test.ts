/**
 * UnitOfWork (InMemoryUnitOfWork) — semantik testler.
 *
 * Bu testler in-memory UoW fake'inin production PG UoW ile aynı
 * commit/rollback semantiğini taşıdığını doğrular. PG implementasyonu
 * için ayrı integration testleri var (testcontainers altyapısı).
 *
 * Karar dokümanı: docs/adr/0006-unit-of-work-pattern.md
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { makeFakeHrContext } from './fakes.js';

const COMPANY = 1;

describe('InMemoryUnitOfWork', () => {
  it('commit: fn normal döner → yazımlar kalıcı', async () => {
    const ctx = makeFakeHrContext();
    const result = await ctx.uow.withTransaction(async (repos) => {
      const orgUnit = await repos.orgUnits.insert({
        companyId: COMPANY,
        parentId: null,
        name: 'HQ',
        code: null,
        sortOrder: 0,
        active: true,
      });
      return orgUnit.id;
    });

    // fn dönüş değeri çağırana geçer
    assert.equal(typeof result, 'number');
    // Yazım kalıcı: uow dışından da görünür
    const list = await ctx.orgUnits.listByCompany(COMPANY);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.name, 'HQ');
  });

  it('rollback: fn throw ederse tüm yazımlar geri alınır', async () => {
    const ctx = makeFakeHrContext();
    // Önceden bir kayıt seedle — rollback bunu etkilemediğini doğrula
    await ctx.orgUnits.insert({
      companyId: COMPANY,
      parentId: null,
      name: 'PreExisting',
      code: null,
      sortOrder: 0,
      active: true,
    });
    const beforeCount = (await ctx.orgUnits.listByCompany(COMPANY)).length;
    assert.equal(beforeCount, 1);

    await assert.rejects(
      ctx.uow.withTransaction(async (repos) => {
        await repos.orgUnits.insert({
          companyId: COMPANY,
          parentId: null,
          name: 'Doomed-1',
          code: null,
          sortOrder: 0,
          active: true,
        });
        await repos.orgUnits.insert({
          companyId: COMPANY,
          parentId: null,
          name: 'Doomed-2',
          code: null,
          sortOrder: 1,
          active: true,
        });
        throw new Error('boom');
      }),
      /boom/,
    );

    // Hiçbir yazım kalmamalı — önceden seedlenmiş kayıt korunur
    const afterCount = (await ctx.orgUnits.listByCompany(COMPANY)).length;
    assert.equal(afterCount, 1, "rollback önceki state'i geri yüklemeli");
    const list = await ctx.orgUnits.listByCompany(COMPANY);
    assert.equal(list[0]!.name, 'PreExisting');
  });

  it('rollback: cross-repo yazımlar tutarlı şekilde geri alınır', async () => {
    const ctx = makeFakeHrContext();

    await assert.rejects(
      ctx.uow.withTransaction(async (repos) => {
        await repos.orgUnits.insert({
          companyId: COMPANY,
          parentId: null,
          name: 'OU',
          code: null,
          sortOrder: 0,
          active: true,
        });
        await repos.departments.insert({
          companyId: COMPANY,
          orgUnitId: null,
          name: 'Dept',
          code: null,
          managerEmployeeId: null,
          active: true,
        });
        throw new Error('cross-fail');
      }),
      /cross-fail/,
    );

    // İki repo da temizlenmiş olmalı
    const ou = await ctx.orgUnits.listByCompany(COMPANY);
    const dept = await ctx.departments.listByCompany(COMPANY);
    assert.equal(ou.length, 0);
    assert.equal(dept.length, 0);
  });

  it("return value: fn dönüş değeri withTransaction'dan döner", async () => {
    const ctx = makeFakeHrContext();
    const out = await ctx.uow.withTransaction(async () => {
      return { ok: true, n: 42 } as const;
    });
    assert.equal(out.ok, true);
    assert.equal(out.n, 42);
  });
});
