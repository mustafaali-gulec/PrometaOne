/**
 * Kategori use-case testleri.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  ArchiveCategoryUseCase,
  CreateCategoryUseCase,
  ListCategoriesUseCase,
  RenameCategoryUseCase,
  ReorderCategoriesUseCase,
} from '../../application/useCases/CategoryUseCases.js';
import {
  CategoryNotFoundError,
  DuplicateCategoryNameError,
} from '../../domain/errors/FinanceErrors.js';
import { FixedClock, InMemoryCategoryRepository } from '../fakes.js';

describe('CategoryUseCases', () => {
  let repo: InMemoryCategoryRepository;
  let clock: FixedClock;

  beforeEach(() => {
    repo = new InMemoryCategoryRepository();
    clock = new FixedClock();
  });

  describe('CreateCategoryUseCase', () => {
    it('happy: kategori oluşur', async () => {
      const uc = new CreateCategoryUseCase(repo);
      const dto = await uc.execute({ companyId: 100, section: 'inflows', name: 'Satış' });
      assert.equal(dto.name, 'Satış');
      assert.equal(dto.section, 'inflows');
      assert.ok(dto.active);
    });

    it('edge: aynı section + isim → DuplicateCategoryNameError', async () => {
      const uc = new CreateCategoryUseCase(repo);
      await uc.execute({ companyId: 100, section: 'inflows', name: 'Satış' });
      await assert.rejects(
        uc.execute({ companyId: 100, section: 'inflows', name: 'satış' }), // case-insensitive
        DuplicateCategoryNameError,
      );
    });

    it('happy: farklı section aynı isim serbest', async () => {
      const uc = new CreateCategoryUseCase(repo);
      await uc.execute({ companyId: 100, section: 'inflows', name: 'Diğer' });
      const dto = await uc.execute({ companyId: 100, section: 'outflows', name: 'Diğer' });
      assert.equal(dto.section, 'outflows');
    });
  });

  describe('RenameCategoryUseCase', () => {
    it('happy: isim güncellenir', async () => {
      const create = new CreateCategoryUseCase(repo);
      const c = await create.execute({ companyId: 100, section: 'inflows', name: 'Eski' });
      const rename = new RenameCategoryUseCase(repo, clock);
      const dto = await rename.execute({ companyId: 100, categoryId: c.id, name: 'Yeni' });
      assert.equal(dto.name, 'Yeni');
    });

    it('edge: olmayan kategori → CategoryNotFoundError', async () => {
      const rename = new RenameCategoryUseCase(repo, clock);
      await assert.rejects(
        rename.execute({ companyId: 100, categoryId: 999, name: 'X' }),
        CategoryNotFoundError,
      );
    });

    it("edge: aynı section'da çakışan isme rename → Duplicate", async () => {
      const create = new CreateCategoryUseCase(repo);
      await create.execute({ companyId: 100, section: 'inflows', name: 'A' });
      const b = await create.execute({ companyId: 100, section: 'inflows', name: 'B' });
      const rename = new RenameCategoryUseCase(repo, clock);
      await assert.rejects(
        rename.execute({ companyId: 100, categoryId: b.id, name: 'A' }),
        DuplicateCategoryNameError,
      );
    });

    it('edge: multi-tenant — başka şirketin kategorisine erişemez', async () => {
      const create = new CreateCategoryUseCase(repo);
      const c = await create.execute({ companyId: 100, section: 'inflows', name: 'X' });
      const rename = new RenameCategoryUseCase(repo, clock);
      await assert.rejects(
        rename.execute({ companyId: 200, categoryId: c.id, name: 'Y' }),
        CategoryNotFoundError,
      );
    });
  });

  describe('ReorderCategoriesUseCase', () => {
    it("happy: sortOrder index'e göre güncellenir", async () => {
      const create = new CreateCategoryUseCase(repo);
      const a = await create.execute({ companyId: 100, section: 'inflows', name: 'A' });
      const b = await create.execute({ companyId: 100, section: 'inflows', name: 'B' });
      const c = await create.execute({ companyId: 100, section: 'inflows', name: 'C' });
      const reorder = new ReorderCategoriesUseCase(repo, clock);
      await reorder.execute({ companyId: 100, orderedIds: [c.id, a.id, b.id] });

      const list = new ListCategoriesUseCase(repo);
      const result = await list.execute({ companyId: 100, section: 'inflows' });
      const byId = new Map(result.map((r) => [r.id, r.sortOrder]));
      assert.equal(byId.get(c.id), 0);
      assert.equal(byId.get(a.id), 1);
      assert.equal(byId.get(b.id), 2);
    });

    it('edge: olmayan id → CategoryNotFoundError', async () => {
      const reorder = new ReorderCategoriesUseCase(repo, clock);
      await assert.rejects(
        reorder.execute({ companyId: 100, orderedIds: [999] }),
        CategoryNotFoundError,
      );
    });
  });

  describe('ArchiveCategoryUseCase', () => {
    it('happy: arşivlenir, default listede görünmez', async () => {
      const create = new CreateCategoryUseCase(repo);
      const c = await create.execute({ companyId: 100, section: 'inflows', name: 'X' });
      const archive = new ArchiveCategoryUseCase(repo, clock);
      const dto = await archive.execute({ companyId: 100, categoryId: c.id });
      assert.equal(dto.active, false);

      const list = new ListCategoriesUseCase(repo);
      const active = await list.execute({ companyId: 100 });
      assert.equal(active.length, 0);
      const all = await list.execute({ companyId: 100, includeArchived: true });
      assert.equal(all.length, 1);
    });

    it('edge: olmayan id → CategoryNotFoundError', async () => {
      const archive = new ArchiveCategoryUseCase(repo, clock);
      await assert.rejects(
        archive.execute({ companyId: 100, categoryId: 999 }),
        CategoryNotFoundError,
      );
    });
  });
});
