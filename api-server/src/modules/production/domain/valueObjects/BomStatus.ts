/**
 * BomStatus — reçete (ürün ağacı) durumu.
 *   active   → kullanımda
 *   draft    → taslak
 *   passive  → pasife alınmış
 */
export const BOM_STATUSES = ['active', 'draft', 'passive'] as const;
export type BomStatus = (typeof BOM_STATUSES)[number];

export function isBomStatus(value: unknown): value is BomStatus {
  return typeof value === 'string' && (BOM_STATUSES as readonly string[]).includes(value);
}
