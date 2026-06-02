/**
 * KdvRate — KDV oranı value object (0–1 arası ondalık).
 *
 * DB: invoices.kdv_rate NUMERIC(5,4), default 0.20 (%20).
 * Türkiye yaygın oranları: 0.00, 0.01, 0.10, 0.20.
 *
 * Money.multiply ile KDV tutarı hesaplanır (KdvCalculator servisi).
 */
import { InvalidKdvRateError } from '../errors/FinanceErrors.js';

export class KdvRate {
  private constructor(private readonly rate: number) {}

  /** @param rate 0 ile 1 arası (örn. 0.20 = %20). */
  static create(rate: number): KdvRate {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      throw new InvalidKdvRateError(rate);
    }
    return new KdvRate(rate);
  }

  /** Yüzdeden kurar: fromPercent(20) → 0.20. */
  static fromPercent(percent: number): KdvRate {
    return KdvRate.create(percent / 100);
  }

  /** Türkiye default %20. */
  static default(): KdvRate {
    return new KdvRate(0.2);
  }

  get value(): number {
    return this.rate;
  }

  toPercent(): number {
    return this.rate * 100;
  }

  equals(other: KdvRate): boolean {
    return this.rate === other.rate;
  }

  toJSON(): number {
    return this.rate;
  }
}
