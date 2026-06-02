/**
 * BudgetMatrix — bütçe takvimi matrisini kuran domain servisi.
 *
 * Kategorileri section'a göre gruplar; her kategori için 12 aylık Money
 * dizisi + satır toplamı; her section için aylık sütun toplamları + section
 * toplamı; ve P&L net (inflows − outflows) hesabı üretir.
 *
 * Cell'i olmayan (category × ay) kombinasyonu Money.zero ile doldurulur —
 * matris her zaman tam 12 sütunludur.
 *
 * Tüm aritmetik Money (integer kuruş) üzerinde; float yuvarlama hatası yok.
 */
import type { Category } from '../entities/Category.js';
import type { Cell } from '../entities/Cell.js';
import type { CategorySection } from '../valueObjects/CategorySection.js';
import { ALL_CATEGORY_SECTIONS, isPnlSection } from '../valueObjects/CategorySection.js';
import type { Currency } from '../valueObjects/Currency.js';
import { Money } from '../valueObjects/Money.js';

const MONTHS = 12;

export interface BudgetRow {
  categoryId: number;
  name: string;
  /** 12 aylık değerler (index 0=Ocak … 11=Aralık). */
  months: Money[];
  /** Satır toplamı (12 ayın toplamı). */
  rowTotal: Money;
}

export interface BudgetSectionView {
  section: CategorySection;
  rows: BudgetRow[];
  /** Section'ın aylık sütun toplamları (12 değer). */
  monthlyTotals: Money[];
  /** Section genel toplamı. */
  sectionTotal: Money;
}

export interface BudgetMatrixResult {
  currency: Currency;
  fiscalYear: number;
  sections: BudgetSectionView[];
  /** P&L net: Σ inflows − Σ outflows (aylık 12 değer). */
  pnlNetMonthly: Money[];
  /** P&L net toplam. */
  pnlNetTotal: Money;
}

export interface BuildBudgetMatrixParams {
  currency: Currency;
  fiscalYear: number;
  categories: ReadonlyArray<Category>;
  cells: ReadonlyArray<Cell>;
}

export const BudgetMatrix = {
  build(params: BuildBudgetMatrixParams): BudgetMatrixResult {
    const { currency, fiscalYear, categories, cells } = params;

    // (categoryId, monthIdx) → Money hızlı erişim haritası
    const cellMap = new Map<string, Money>();
    for (const cell of cells) {
      cellMap.set(cellKey(cell.categoryId, cell.monthIdx.value), cell.value);
    }

    const sections: BudgetSectionView[] = [];

    // P&L net biriktiriciler (aylık)
    const pnlNetMonthly = zeroRow(currency);

    for (const section of ALL_CATEGORY_SECTIONS) {
      const sectionCategories = categories
        .filter((c) => c.section === section && c.active)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

      const rows: BudgetRow[] = [];
      const monthlyTotals = zeroRow(currency);

      for (const category of sectionCategories) {
        const months: Money[] = [];
        let rowTotal = Money.zero(currency);
        for (let m = 0; m < MONTHS; m += 1) {
          const value = cellMap.get(cellKey(category.id, m)) ?? Money.zero(currency);
          months.push(value);
          rowTotal = rowTotal.plus(value);
          monthlyTotals[m] = monthlyTotals[m]!.plus(value);
        }
        rows.push({ categoryId: category.id, name: category.name, months, rowTotal });
      }

      const sectionTotal = monthlyTotals.reduce((acc, v) => acc.plus(v), Money.zero(currency));

      // P&L net: inflows ekle, outflows çıkar (nonPnl/kasa hariç)
      if (isPnlSection(section)) {
        for (let m = 0; m < MONTHS; m += 1) {
          pnlNetMonthly[m] =
            section === 'inflows'
              ? pnlNetMonthly[m]!.plus(monthlyTotals[m]!)
              : pnlNetMonthly[m]!.minus(monthlyTotals[m]!);
        }
      }

      sections.push({ section, rows, monthlyTotals, sectionTotal });
    }

    const pnlNetTotal = pnlNetMonthly.reduce((acc, v) => acc.plus(v), Money.zero(currency));

    return { currency, fiscalYear, sections, pnlNetMonthly, pnlNetTotal };
  },
} as const;

function cellKey(categoryId: number, monthIdx: number): string {
  return `${categoryId}:${monthIdx}`;
}

function zeroRow(currency: Currency): Money[] {
  return Array.from({ length: MONTHS }, () => Money.zero(currency));
}
