/**
 * KdvCalculator — KDV ve fatura toplamı hesaplama domain servisi.
 *
 * Fatura aritmetiği (005_invoices.sql ile uyumlu):
 *   kdv   = round(subtotal × kdvRate)
 *   total = subtotal + kdv
 *
 * Tüm tutarlar Money (integer kuruş). Yuvarlama Money.multiply içinde
 * round-half-up ile yapılır — float hatası yok.
 */
import type { KdvRate } from '../valueObjects/KdvRate.js';
import { Money } from '../valueObjects/Money.js';

export interface InvoiceTotals {
  /** KDV hariç ara toplam. */
  subtotal: Money;
  /** Hesaplanan KDV tutarı. */
  kdv: Money;
  /** subtotal + kdv. */
  total: Money;
}

export const KdvCalculator = {
  /**
   * Ara toplam ve orandan KDV + genel toplam üretir.
   */
  fromSubtotal(subtotal: Money, rate: KdvRate): InvoiceTotals {
    const kdv = subtotal.multiply(rate.value);
    return {
      subtotal,
      kdv,
      total: subtotal.plus(kdv),
    };
  },

  /**
   * KDV dahil toplamdan geriye ara toplam ve KDV'yi ayrıştırır.
   *   subtotal = round(total / (1 + rate))
   *   kdv      = total − subtotal
   * (Tersine hesapta yuvarlama farkı KDV'ye yansır; total korunur.)
   */
  fromGrossTotal(total: Money, rate: KdvRate): InvoiceTotals {
    const divisor = 1 + rate.value;
    const subtotalMinor = Math.round(total.minorValue / divisor);
    const subtotal = Money.fromMinor(subtotalMinor, total.currency);
    return {
      subtotal,
      kdv: total.minus(subtotal),
      total,
    };
  },
} as const;
