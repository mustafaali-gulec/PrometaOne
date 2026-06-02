/**
 * Kategori use-case'leri (Faz 5 / PR 2).
 *
 * CreateCategory, RenameCategory, ReorderCategories, ArchiveCategory.
 * Aynı section'da isim benzersizliği use-case seviyesinde + DB UNIQUE
 * (003: UNIQUE(company_id, section, name)) ile çift korumalı.
 */
import {
  CategoryNotFoundError,
  DuplicateCategoryNameError,
} from '../../domain/errors/FinanceErrors.js';
import type { CategorySection } from '../../domain/valueObjects/CategorySection.js';
import { toCategoryDto, type CategoryDto } from '../dto/BudgetDtos.js';
import type { CategoryRepository } from '../ports/CategoryRepository.js';
import type { Clock } from '../ports/Clock.js';

export interface CreateCategoryInput {
  companyId: number;
  section: CategorySection;
  name: string;
  sortOrder?: number;
}

export class CreateCategoryUseCase {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: CreateCategoryInput): Promise<CategoryDto> {
    const name = input.name.trim();
    if (await this.categories.existsByName(input.companyId, input.section, name)) {
      throw new DuplicateCategoryNameError(input.section, name);
    }
    const created = await this.categories.insert({
      companyId: input.companyId,
      section: input.section,
      name,
      sortOrder: input.sortOrder ?? 0,
    });
    return toCategoryDto(created);
  }
}

export interface RenameCategoryInput {
  companyId: number;
  categoryId: number;
  name: string;
}

export class RenameCategoryUseCase {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RenameCategoryInput): Promise<CategoryDto> {
    const category = await this.categories.findById(input.categoryId, input.companyId);
    if (!category) {
      throw new CategoryNotFoundError(input.categoryId);
    }
    const name = input.name.trim();
    if (await this.categories.existsByName(input.companyId, category.section, name, category.id)) {
      throw new DuplicateCategoryNameError(category.section, name);
    }
    const renamed = category.rename(name, this.clock.now());
    await this.categories.update(renamed);
    return toCategoryDto(renamed);
  }
}

export interface ReorderCategoriesInput {
  companyId: number;
  /** Sırasıyla kategori id'leri — index sortOrder olur. */
  orderedIds: number[];
}

export class ReorderCategoriesUseCase {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ReorderCategoriesInput): Promise<void> {
    const now = this.clock.now();
    for (let i = 0; i < input.orderedIds.length; i += 1) {
      const id = input.orderedIds[i]!;
      const category = await this.categories.findById(id, input.companyId);
      if (!category) {
        throw new CategoryNotFoundError(id);
      }
      const reordered = category.reorder(i, now);
      if (reordered !== category) {
        await this.categories.update(reordered);
      }
    }
  }
}

export interface ArchiveCategoryInput {
  companyId: number;
  categoryId: number;
}

export class ArchiveCategoryUseCase {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ArchiveCategoryInput): Promise<CategoryDto> {
    const category = await this.categories.findById(input.categoryId, input.companyId);
    if (!category) {
      throw new CategoryNotFoundError(input.categoryId);
    }
    const archived = category.archive(this.clock.now());
    await this.categories.update(archived);
    return toCategoryDto(archived);
  }
}

export interface ListCategoriesInput {
  companyId: number;
  section?: CategorySection;
  includeArchived?: boolean;
}

export class ListCategoriesUseCase {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: ListCategoriesInput): Promise<CategoryDto[]> {
    const list = await this.categories.listByCompany(input.companyId, {
      ...(input.section !== undefined ? { section: input.section } : {}),
      ...(input.includeArchived !== undefined ? { includeArchived: input.includeArchived } : {}),
    });
    return list.map(toCategoryDto);
  }
}
