/**
 * PgCellRepository integration test — gerçek PostgreSQL üzerinde.
 *
 * Doğrulanan davranışlar:
 *   - UPSERT (ON CONFLICT (company_id, category_id, fiscal_year, month_idx))
 *     ikinci yazımda yeni satır oluşturmaz, value'yu günceller.
 *   - NUMERIC(20,2) ↔ Money decimal string yuvarlama korunur.
 *   - findOne / findByCompanyYear doğru filtreler.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Cell } from '../../domain/entities/Cell.js';
import { FiscalYear } from '../../domain/valueObjects/FiscalYear.js';
import { Money } from '../../domain/valueObjects/Money.js';
import { MonthIndex } from '../../domain/valueObjects/MonthIndex.js';
import { PgCategoryRepository } from '../../infrastructure/persistence/PgCategoryRepository.js';
import { PgCellRepository } from '../../infrastructure/persistence/PgCellRepository.js';

import {
  seedCompany,
  seedUser,
  startFinancePgContainer,
  truncateAllFinanceTables,
  type FinancePgContext,
} from './setup.js';

describe('PgCellRepository [integration]', () => {
  let ctx: FinancePgContext;
  let categoryId: number;

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
    await seedUser(ctx.pool, { id: 7, companyId: 1, username: 'cfo' });
    const cat = await new PgCategoryRepository(ctx.pool).insert({
      companyId: 1,
      section: 'inflows',
      name: 'Satış',
      sortOrder: 0,
    });
    categoryId = cat.id;
  });

  function makeCell(value: number, monthIdx = 0): Cell {
    return Cell.create({
      id: null,
      companyId: 1,
      categoryId,
      fiscalYear: FiscalYear.create(2026),
      monthIdx: MonthIndex.create(monthIdx),
      value: Money.fromMajor(value, 'TRY'),
      updatedAt: new Date(),
      updatedBy: 7,
    });
  }

  it('UPSERT: aynı (kategori, yıl, ay) ikinci yazım üzerine yazar — tek satır', async () => {
    const repo = new PgCellRepository(ctx.pool);
    await repo.upsert(makeCell(1000));
    await repo.upsert(makeCell(2500.75));

    const all = await repo.findByCompanyYear(1, 2026);
    assert.equal(all.length, 1); // ON CONFLICT → tek satır
    assert.equal(all[0]!.value.toDecimalString(), '2500.75');
  });

  it('findOne: yazılan hücre bulunur, olmayan ay null döner', async () => {
    const repo = new PgCellRepository(ctx.pool);
    await repo.upsert(makeCell(1250.5, 3));

    const found = await repo.findOne(1, categoryId, 2026, 3);
    assert.ok(found);
    assert.equal(found.value.toDecimalString(), '1250.50');

    const missing = await repo.findOne(1, categoryId, 2026, 5);
    assert.equal(missing, null);
  });

  it('findByCompanyYear: yalnızca ilgili yılın hücreleri döner', async () => {
    const repo = new PgCellRepository(ctx.pool);
    await repo.upsert(makeCell(100, 0));
    await repo.upsert(
      Cell.create({
        id: null,
        companyId: 1,
        categoryId,
        fiscalYear: FiscalYear.create(2025),
        monthIdx: MonthIndex.create(0),
        value: Money.fromMajor(999, 'TRY'),
        updatedAt: new Date(),
        updatedBy: 7,
      }),
    );

    const y2026 = await repo.findByCompanyYear(1, 2026);
    assert.equal(y2026.length, 1);
    assert.equal(y2026[0]!.value.toDecimalString(), '100.00');
  });
});
