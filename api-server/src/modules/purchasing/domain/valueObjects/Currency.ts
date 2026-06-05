/**
 * CurrencyCode — DB `currency_code` ENUM ile hizalı para birimi kodu.
 * (Finance Money VO'su cross-module import edilmez; satınalma modülü bağımsız.)
 */
export const CURRENCY_CODES = ['TRY', 'USD', 'EUR'] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return typeof v === 'string' && (CURRENCY_CODES as ReadonlyArray<string>).includes(v);
}

/** Tutarı 2 ondalığa yuvarlar (NUMERIC(20,2) uyumu). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
