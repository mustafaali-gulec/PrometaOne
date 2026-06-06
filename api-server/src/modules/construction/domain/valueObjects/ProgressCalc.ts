/**
 * Hakediş hesap motoru (saf fonksiyonlar).
 *
 * Satır: cumulQty = prevQty + thisQty; thisAmount = thisQty*unitPrice;
 *        cumulAmount = cumulQty*unitPrice (2 ondalık).
 * Toplam: grossThis = Σ thisAmount; grossCumul = Σ cumulAmount;
 *         netPayable = grossThis + priceDiff + Σ(sign*amount).
 */
import { round2 } from './Currency.js';

export interface LineFigures {
  cumulQty: number;
  thisAmount: number;
  cumulAmount: number;
}

export function computeLineFigures(
  prevQty: number,
  thisQty: number,
  unitPrice: number,
): LineFigures {
  const cumulQty = prevQty + thisQty;
  return {
    cumulQty,
    thisAmount: round2(thisQty * unitPrice),
    cumulAmount: round2(cumulQty * unitPrice),
  };
}

export interface TotalsInput {
  thisAmounts: ReadonlyArray<number>;
  cumulAmounts: ReadonlyArray<number>;
  priceDiff: number;
  deductions: ReadonlyArray<{ sign: number; amount: number }>;
}

export interface ProgressTotals {
  grossThis: number;
  grossCumul: number;
  deductionsTot: number;
  netPayable: number;
}

export function computeProgressTotals(input: TotalsInput): ProgressTotals {
  const grossThis = round2(input.thisAmounts.reduce((s, a) => s + a, 0));
  const grossCumul = round2(input.cumulAmounts.reduce((s, a) => s + a, 0));
  const deductionsTot = round2(input.deductions.reduce((s, d) => s + d.amount, 0));
  const signed = input.deductions.reduce((s, d) => s + d.sign * d.amount, 0);
  const netPayable = round2(grossThis + input.priceDiff + signed);
  return { grossThis, grossCumul, deductionsTot, netPayable };
}
