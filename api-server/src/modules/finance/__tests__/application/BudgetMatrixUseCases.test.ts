/**
 * Bütçe matrisi use-case testleri.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  BulkSetCellsUseCase,
  GetBudgetMatrixUseCase,
  SetCellValueUseCase,
} from '../../application/useCases/BudgetMatrixUseCases.js';
import { CreateCategoryUseCase } from '../../application/useCases/CategoryUseCases.js';
import { CategoryNotFoundError } from '../../domain/errors/FinanceErrors.js';
import { FixedClock, InMemoryCategoryRepository, InMemoryCellRepository } from '../fakes.js';

describe('BudgetMatrixUseCases', () => {
  let categories: InMemoryCategoryRepository;
  let cells: InMemoryCellRepository;
  let clock: FixedClock;

  beforeEach(() => {
    categories = new InMemoryCategoryRepository();
    cells = new InMemoryCellRepository();
    clock = new FixedClock();
  });

  async function seedCategory(name: string, section: 'inflows' | 'outflows' = 'inflows') {
    return new CreateCategoryUseCase(categories).execute({
      companyId: 100,
      section,
      name,
    });
  }

  describe('SetCellValueUseCase', () => {
    it('happy: hücre yazılır, matriste görünür', async () => {
      const cat = await seedCategory('Satış');
      const set = new SetCellValueUseCase(categories, cells, clock);
      await set.execute({
        companyId: 100,
        categoryId: cat.id,
        fiscalYear: 2026,
        monthIdx: 0,
        value: 1250.5,
        actorUserId: 7,
      });

      const matrix = await new GetBudgetMatrixUseCase(categories, cells).execute({
        companyId: 100,
        fiscalYear: 2026,
      });
      const inflows = matrix.sections.find((s) => s.section === 'inflows')!;
      assert.equal(inflows.rows[0]!.months[0], '1250.50');
      assert.equal(inflows.rows[0]!.rowTotal, '1250.50');
    });

    it('happy: aynı hücreye ikinci yazım üzerine yazar (UPSERT)', async () => {
      const cat = await seedCategory('Satış');
      const set = new SetCellValueUseCase(categories, cells, clock);
      await set.execute({
        companyId: 100,
        categoryId: cat.id,
        fiscalYear: 2026,
        monthIdx: 0,
        value: 1000,
        actorUserId: null,
      });
      await set.execute({
        companyId: 100,
        categoryId: cat.id,
        fiscalYear: 2026,
        monthIdx: 0,
        value: 2000,
        actorUserId: null,
      });
      const all = await cells.findByCompanyYear(100, 2026);
      assert.equal(all.length, 1); // tek hücre — üzerine yazıldı
      assert.equal(all[0]!.value.toDecimalString(), '2000.00');
    });

    it('edge: olmayan kategori → CategoryNotFoundError', async () => {
      const set = new SetCellValueUseCase(categories, cells, clock);
      await assert.rejects(
        set.execute({
          companyId: 100,
          categoryId: 999,
          fiscalYear: 2026,
          monthIdx: 0,
          value: 100,
          actorUserId: null,
        }),
        CategoryNotFoundError,
      );
    });

    it('edge: multi-tenant — başka şirket kategorisine yazamaz', async () => {
      const cat = await seedCategory('Satış');
      const set = new SetCellValueUseCase(categories, cells, clock);
      await assert.rejects(
        set.execute({
          companyId: 200,
          categoryId: cat.id,
          fiscalYear: 2026,
          monthIdx: 0,
          value: 100,
          actorUserId: null,
        }),
        CategoryNotFoundError,
      );
    });
  });

  describe('BulkSetCellsUseCase', () => {
    it('happy: çoklu hücre yazılır', async () => {
      const a = await seedCategory('Satış', 'inflows');
      const b = await seedCategory('Kira', 'outflows');
      const bulk = new BulkSetCellsUseCase(categories, cells, clock);
      await bulk.execute({
        companyId: 100,
        fiscalYear: 2026,
        actorUserId: null,
        entries: [
          { categoryId: a.id, monthIdx: 0, value: 10000 },
          { categoryId: a.id, monthIdx: 1, value: 12000 },
          { categoryId: b.id, monthIdx: 0, value: 3000 },
        ],
      });
      const matrix = await new GetBudgetMatrixUseCase(categories, cells).execute({
        companyId: 100,
        fiscalYear: 2026,
      });
      assert.equal(matrix.pnlNetMonthly[0], '7000.00'); // 10000 inflow - 3000 outflow
      assert.equal(matrix.pnlNetMonthly[1], '12000.00'); // 12000 inflow
      assert.equal(matrix.pnlNetTotal, '19000.00');
    });

    it('edge: entries içinde olmayan kategori → CategoryNotFoundError', async () => {
      const a = await seedCategory('Satış');
      const bulk = new BulkSetCellsUseCase(categories, cells, clock);
      await assert.rejects(
        bulk.execute({
          companyId: 100,
          fiscalYear: 2026,
          actorUserId: null,
          entries: [
            { categoryId: a.id, monthIdx: 0, value: 100 },
            { categoryId: 999, monthIdx: 0, value: 200 },
          ],
        }),
        CategoryNotFoundError,
      );
    });
  });

  describe('GetBudgetMatrixUseCase', () => {
    it('happy: boş veri → 4 section, sıfır toplam', async () => {
      const matrix = await new GetBudgetMatrixUseCase(categories, cells).execute({
        companyId: 100,
        fiscalYear: 2026,
      });
      assert.equal(matrix.sections.length, 4);
      assert.equal(matrix.pnlNetTotal, '0.00');
      assert.equal(matrix.currency, 'TRY');
    });
  });
});
