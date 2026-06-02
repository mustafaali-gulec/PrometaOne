/**
 * Budget DTO'ları — REST sınırında kullanılan düz tipler.
 *
 * Money daima `decimal` string (NUMERIC(20,2) uyumlu) olarak serileşir;
 * frontend `Money.fromDecimalString` ile geri kurar.
 */
import type { Category } from '../../domain/entities/Category.js';
import type { BudgetMatrixResult, BudgetSectionView } from '../../domain/services/BudgetMatrix.js';
import type { CategorySection } from '../../domain/valueObjects/CategorySection.js';
import type { Currency } from '../../domain/valueObjects/Currency.js';

export interface CategoryDto {
  id: number;
  companyId: number;
  section: CategorySection;
  name: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toCategoryDto(c: Category): CategoryDto {
  const j = c.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    section: j.section,
    name: j.name,
    sortOrder: j.sortOrder,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export interface CategoriesResponse {
  categories: CategoryDto[];
}

export interface BudgetRowDto {
  categoryId: number;
  name: string;
  /** 12 aylık değer (decimal string). */
  months: string[];
  rowTotal: string;
}

export interface BudgetSectionDto {
  section: CategorySection;
  rows: BudgetRowDto[];
  monthlyTotals: string[];
  sectionTotal: string;
}

export interface BudgetMatrixDto {
  currency: Currency;
  fiscalYear: number;
  sections: BudgetSectionDto[];
  pnlNetMonthly: string[];
  pnlNetTotal: string;
}

function toSectionDto(s: BudgetSectionView): BudgetSectionDto {
  return {
    section: s.section,
    rows: s.rows.map((r) => ({
      categoryId: r.categoryId,
      name: r.name,
      months: r.months.map((m) => m.toDecimalString()),
      rowTotal: r.rowTotal.toDecimalString(),
    })),
    monthlyTotals: s.monthlyTotals.map((m) => m.toDecimalString()),
    sectionTotal: s.sectionTotal.toDecimalString(),
  };
}

export function toBudgetMatrixDto(result: BudgetMatrixResult): BudgetMatrixDto {
  return {
    currency: result.currency,
    fiscalYear: result.fiscalYear,
    sections: result.sections.map(toSectionDto),
    pnlNetMonthly: result.pnlNetMonthly.map((m) => m.toDecimalString()),
    pnlNetTotal: result.pnlNetTotal.toDecimalString(),
  };
}
