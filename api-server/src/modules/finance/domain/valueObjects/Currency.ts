/**
 * Currency — desteklenen para birimleri.
 *
 * DB ENUM `currency_code` ile birebir (004_banks_kasa_transfers.sql):
 * TRY / USD / EUR.
 *
 * Faz 6 (E-Fatura + TCMB) döviz kuru tarihçesini ekleyecek; bu VO sadece
 * birim kimliğini taşır, kur dönüşümü içermez.
 */
import { InvalidCurrencyError } from '../errors/FinanceErrors.js';

export type Currency = 'TRY' | 'USD' | 'EUR';

export const ALL_CURRENCIES: ReadonlyArray<Currency> = ['TRY', 'USD', 'EUR'];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (ALL_CURRENCIES as ReadonlyArray<string>).includes(value);
}

/**
 * Bilinmeyen değeri Currency'ye çevirir; geçersizse fırlatır.
 * DB'den / API'den gelen string'leri güvenli daraltmak için.
 */
export function toCurrency(value: unknown): Currency {
  if (!isCurrency(value)) {
    throw new InvalidCurrencyError(value);
  }
  return value;
}

/** Her para biriminin sembolü (UI / formatlama için). */
export const CURRENCY_SYMBOLS: Readonly<Record<Currency, string>> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
};
