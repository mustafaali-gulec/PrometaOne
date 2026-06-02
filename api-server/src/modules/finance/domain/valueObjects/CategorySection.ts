/**
 * CategorySection — nakit akış kategori bölümü.
 *
 * DB ENUM `category_section` (003):
 *   inflows         — tahsil edilen nakit (P&L geliri)
 *   outflows        — ödenen nakit (P&L gideri)
 *   nonPnlOutflows  — ödenen nakit ama kar/zarar dışı (örn. vergi, kredi anapara)
 *   kasaCategories  — kasa hareketi kategorileri
 *
 * Bütçe matrisi bölümlere göre gruplanır.
 */
export type CategorySection = 'inflows' | 'outflows' | 'nonPnlOutflows' | 'kasaCategories';

export const ALL_CATEGORY_SECTIONS: ReadonlyArray<CategorySection> = [
  'inflows',
  'outflows',
  'nonPnlOutflows',
  'kasaCategories',
];

export function isCategorySection(value: unknown): value is CategorySection {
  return (
    typeof value === 'string' && (ALL_CATEGORY_SECTIONS as ReadonlyArray<string>).includes(value)
  );
}

/** P&L'e giren bölümler (nonPnl ve kasa hariç). */
export function isPnlSection(section: CategorySection): boolean {
  return section === 'inflows' || section === 'outflows';
}
