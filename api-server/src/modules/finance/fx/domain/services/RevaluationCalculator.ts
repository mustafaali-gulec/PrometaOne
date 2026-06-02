/**
 * RevaluationCalculator — UFRS 21 kur farkı değerleme (saf domain).
 *
 * Döviz cinsinden bakiyeler iki tarih (referans → değerleme) arasındaki kur
 * değişimiyle TRY değerini değiştirir. Pozitif delta → 646 Kambiyo Kârı,
 * negatif → 656 Kambiyo Zararı.
 *
 * Kuruş-kesin: TRY değeri = round(dövizMinor × kur) minor olarak hesaplanır
 * (1 döviz cent = kur TRY cent). Float yuvarlama yalnız round adımında.
 */
import type { Currency } from '../../../domain/valueObjects/Currency.js';
import { Money } from '../../../domain/valueObjects/Money.js';

export interface RevaluationPosition {
  label: string;
  currency: Currency;
  /** Döviz cinsinden bakiye (currency ile eşleşmeli). */
  foreignAmount: Money;
}

export interface RevaluationRates {
  usd1: number;
  usd2: number;
  eur1: number;
  eur2: number;
}

export interface RevaluationLineResult {
  label: string;
  currency: Currency;
  foreignAmount: string;
  tryValueBefore: string;
  tryValueAfter: string;
  delta: string;
}

export interface RevaluationResult {
  gainTotal: Money;
  lossTotal: Money;
  net: Money;
  lines: RevaluationLineResult[];
}

function toTry(foreign: Money, rate: number): Money {
  return Money.fromMinor(Math.round(foreign.minorValue * rate), 'TRY');
}

function ratesFor(currency: Currency, rates: RevaluationRates): { r1: number; r2: number } {
  if (currency === 'USD') return { r1: rates.usd1, r2: rates.usd2 };
  if (currency === 'EUR') return { r1: rates.eur1, r2: rates.eur2 };
  return { r1: 1, r2: 1 }; // TRY → kur farkı yok
}

export const RevaluationCalculator = {
  compute(
    positions: ReadonlyArray<RevaluationPosition>,
    rates: RevaluationRates,
  ): RevaluationResult {
    let gain = Money.zero('TRY');
    let loss = Money.zero('TRY');
    const lines: RevaluationLineResult[] = [];

    for (const pos of positions) {
      const { r1, r2 } = ratesFor(pos.currency, rates);
      const before = toTry(pos.foreignAmount, r1);
      const after = toTry(pos.foreignAmount, r2);
      const delta = after.minus(before);
      if (delta.isPositive()) {
        gain = gain.plus(delta);
      } else if (delta.isNegative()) {
        loss = loss.plus(delta.abs());
      }
      lines.push({
        label: pos.label,
        currency: pos.currency,
        foreignAmount: pos.foreignAmount.toDecimalString(),
        tryValueBefore: before.toDecimalString(),
        tryValueAfter: after.toDecimalString(),
        delta: delta.toDecimalString(),
      });
    }

    return { gainTotal: gain, lossTotal: loss, net: gain.minus(loss), lines };
  },
} as const;
