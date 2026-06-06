/**
 * Kesinti/ilave türleri (cs_deduction_kind aynası) + işaret varsayılanı.
 *
 * sign: -1 kesinti (hakedişten düşülür), +1 ilave (eklenir). Çoğu kalem
 * kesintidir; price_diff varsayılan ilave (+1).
 */
export const DEDUCTION_KINDS = [
  'retention', // teminat kesintisi
  'advance_offset', // avans mahsubu
  'sgk', // SGK kesintisi
  'income_tax', // gelir vergisi
  'stoppage', // stopaj
  'penalty', // gecikme cezası
  'price_diff', // fiyat farkı (ilave)
  'other',
] as const;
export type DeductionKind = (typeof DEDUCTION_KINDS)[number];

export function isDeductionKind(v: unknown): v is DeductionKind {
  return typeof v === 'string' && (DEDUCTION_KINDS as ReadonlyArray<string>).includes(v);
}

export function defaultSignFor(kind: DeductionKind): number {
  return kind === 'price_diff' ? 1 : -1;
}
