/**
 * Money — para tutarı value object (immutable).
 *
 * ÖNEMLİ — integer "kuruş" (minor unit) aritmetiği:
 *   Float aritmetiği finansal hata üretir (0.1 + 0.2 !== 0.3). Money tutarı
 *   DAİMA tam sayı kuruş olarak saklar (12.50 TL → 1250). Tüm aritmetik
 *   integer üzerinde yapılır; yalnız dışarı verirken (toMajor / toString)
 *   ondalığa çevrilir.
 *
 * DB tarafı NUMERIC(20,2) — 2 ondalık. Money de 2 ondalık (100 kuruş = 1 birim)
 * varsayar. fromMajor/fromMinor ile kurulur.
 *
 * Currency mismatch'te aritmetik fırlatır (CurrencyMismatchError). Farklı
 * para birimlerini toplamak domain hatasıdır — kur dönüşümü Faz 6'da ayrı
 * servis olacak.
 */
import {
  CurrencyMismatchError,
  InvalidAllocationError,
  InvalidMoneyError,
} from '../errors/FinanceErrors.js';

import { toCurrency, type Currency, CURRENCY_SYMBOLS } from './Currency.js';

/** 1 birim = 100 kuruş (minor unit). NUMERIC(20,2) ile uyumlu. */
const MINOR_PER_MAJOR = 100;

export class Money {
  /**
   * @param minor Tam sayı kuruş (örn. 1250 = 12.50). NEGATIF olabilir
   *   (örn. gider, ters kayıt). Sıfır geçerli.
   * @param currency Para birimi.
   */
  private constructor(
    private readonly minor: number,
    private readonly _currency: Currency,
  ) {}

  // ---------------------------------------------------------------------------
  // Factory'ler
  // ---------------------------------------------------------------------------

  /**
   * "Major" birimden kurar: fromMajor(12.5, 'TRY') → 1250 kuruş.
   * Ondalık girişte 2 hanenin ötesi round-half-up ile yuvarlanır.
   */
  static fromMajor(value: number, currency: Currency): Money {
    if (!Number.isFinite(value)) {
      throw new InvalidMoneyError(`sonlu sayı değil: ${value}`);
    }
    const minor = Math.round(value * MINOR_PER_MAJOR);
    return new Money(minor, toCurrency(currency));
  }

  /** Doğrudan kuruş (minor) tam sayıdan kurar. */
  static fromMinor(minor: number, currency: Currency): Money {
    if (!Number.isInteger(minor)) {
      throw new InvalidMoneyError(`minor değer tam sayı olmalı: ${minor}`);
    }
    return new Money(minor, toCurrency(currency));
  }

  /** Verilen para biriminde sıfır tutar. */
  static zero(currency: Currency): Money {
    return new Money(0, toCurrency(currency));
  }

  /**
   * DB'den gelen NUMERIC string/number değerini (örn. "1250.00" veya 1250.5)
   * güvenli Money'ye çevirir.
   */
  static fromDecimalString(value: string | number, currency: Currency): Money {
    const num = typeof value === 'string' ? Number(value) : value;
    return Money.fromMajor(num, currency);
  }

  // ---------------------------------------------------------------------------
  // Erişimciler
  // ---------------------------------------------------------------------------

  get currency(): Currency {
    return this._currency;
  }

  /** Tam sayı kuruş değeri. */
  get minorValue(): number {
    return this.minor;
  }

  /** "Major" ondalık değer: 1250 → 12.5. */
  toMajor(): number {
    return this.minor / MINOR_PER_MAJOR;
  }

  isZero(): boolean {
    return this.minor === 0;
  }

  isNegative(): boolean {
    return this.minor < 0;
  }

  isPositive(): boolean {
    return this.minor > 0;
  }

  // ---------------------------------------------------------------------------
  // Aritmetik (immutable — yeni instance döner)
  // ---------------------------------------------------------------------------

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor + other.minor, this._currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor - other.minor, this._currency);
  }

  /**
   * Skaler ile çarpar (örn. KDV oranı, adet). Sonuç round-half-up ile
   * en yakın kuruşa yuvarlanır.
   */
  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new InvalidMoneyError(`çarpan sonlu değil: ${factor}`);
    }
    return new Money(roundHalfUp(this.minor * factor), this._currency);
  }

  /** Mutlak değer. */
  abs(): Money {
    return new Money(Math.abs(this.minor), this._currency);
  }

  /** İşaret ters çevir (gelir↔gider). */
  negate(): Money {
    return new Money(-this.minor, this._currency);
  }

  /**
   * Tutarı n parçaya böler. Tam bölünmeyen kuruş artığı ilk parçalara
   * birer birer dağıtılır — toplam korunur (Σ parçalar === orijinal).
   *
   * Örn: 100 kuruş / 3 → [34, 33, 33]
   */
  allocate(parts: number): Money[] {
    if (!Number.isInteger(parts) || parts <= 0) {
      throw new InvalidAllocationError(`parça sayısı pozitif tam sayı olmalı: ${parts}`);
    }
    const base = Math.trunc(this.minor / parts);
    let remainder = this.minor - base * parts;
    const result: Money[] = [];
    for (let i = 0; i < parts; i += 1) {
      // Artığı (işaretiyle) ilk parçalara dağıt.
      const extra = remainder !== 0 ? Math.sign(remainder) : 0;
      result.push(new Money(base + extra, this._currency));
      if (remainder !== 0) remainder -= extra;
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Karşılaştırma
  // ---------------------------------------------------------------------------

  equals(other: Money): boolean {
    return this.minor === other.minor && this._currency === other._currency;
  }

  /** -1 / 0 / 1 — farklı para biriminde fırlatır. */
  compareTo(other: Money): number {
    this.assertSameCurrency(other);
    if (this.minor < other.minor) return -1;
    if (this.minor > other.minor) return 1;
    return 0;
  }

  isGreaterThan(other: Money): boolean {
    return this.compareTo(other) > 0;
  }

  isLessThan(other: Money): boolean {
    return this.compareTo(other) < 0;
  }

  // ---------------------------------------------------------------------------
  // Serileştirme
  // ---------------------------------------------------------------------------

  /** "12.50" — NUMERIC(20,2) DB yazımı için sabit 2 ondalık. */
  toDecimalString(): string {
    return (this.minor / MINOR_PER_MAJOR).toFixed(2);
  }

  /** "₺12,50" gibi locale formatı (tr-TR). */
  toLocaleString(): string {
    return `${CURRENCY_SYMBOLS[this._currency]}${new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.toMajor())}`;
  }

  toJSON(): { minor: number; currency: Currency; decimal: string } {
    return { minor: this.minor, currency: this._currency, decimal: this.toDecimalString() };
  }

  // ---------------------------------------------------------------------------
  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new CurrencyMismatchError(this._currency, other._currency);
    }
  }
}

/**
 * Round half-up (yarıyı yukarı): 2.5 → 3, -2.5 → -3 (mutlak değerde yukarı).
 * Math.round JS'te -2.5 → -2 yapar (yarıyı +∞'a); finansal yuvarlamada
 * mutlak-değer-yukarı tercih edilir.
 */
function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}
