/**
 * CashPositionCalculator — bir hesabın güncel bakiyesini hesaplayan domain
 * servisi.
 *
 * Bakiye saklanmaz; her zaman hareketlerden türetilir:
 *   balance = openingBalance
 *           + Σ kasaEntries.signedAmount   (in +, out −)
 *           + Σ incomingTransfers.toAmount
 *           − Σ outgoingTransfers.fromAmount
 *
 * Tüm tutarlar hesabın currency'sinde olmalı; aksi halde Money.plus/minus
 * CurrencyMismatchError fırlatır (kasıtlı koruma — çapraz kur dönüşümü Faz 6).
 */
import type { KasaEntry } from '../entities/KasaEntry.js';
import type { Transfer } from '../entities/Transfer.js';
import type { Currency } from '../valueObjects/Currency.js';
import type { Money } from '../valueObjects/Money.js';

export interface CashPositionParams {
  currency: Currency;
  openingBalance: Money;
  /** Bu hesaba ait kasa hareketleri (banka hesabında boş geçilir). */
  kasaEntries?: ReadonlyArray<KasaEntry>;
  /** Bu hesaba gelen transferler (toAmount kullanılır). */
  incomingTransfers?: ReadonlyArray<Transfer>;
  /** Bu hesaptan giden transferler (fromAmount kullanılır). */
  outgoingTransfers?: ReadonlyArray<Transfer>;
}

export const CashPositionCalculator = {
  compute(params: CashPositionParams): Money {
    let balance = params.openingBalance;

    for (const entry of params.kasaEntries ?? []) {
      balance = balance.plus(entry.signedAmount());
    }
    for (const t of params.incomingTransfers ?? []) {
      balance = balance.plus(t.toAmount);
    }
    for (const t of params.outgoingTransfers ?? []) {
      balance = balance.minus(t.fromAmount);
    }

    // Güvenlik: sonuç currency hesap currency'siyle eşleşmeli
    if (balance.currency !== params.currency) {
      throw new Error('CashPosition currency tutarsızlığı');
    }
    return balance;
  },
} as const;
