/**
 * MonthIndex — takvim ayı indeksi (cells.month_idx).
 *
 * 0=Ocak … 11=Aralık. DB CHECK (month_idx BETWEEN 0 AND 11) ile uyumlu.
 */
import { InvalidMonthIndexError } from '../errors/FinanceErrors.js';

const MONTH_NAMES_TR: ReadonlyArray<string> = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export class MonthIndex {
  private constructor(private readonly idx: number) {}

  static create(idx: number): MonthIndex {
    if (!Number.isInteger(idx) || idx < 0 || idx > 11) {
      throw new InvalidMonthIndexError(idx);
    }
    return new MonthIndex(idx);
  }

  /** 0–11 arası tüm aylar (matris kurulumu için). */
  static all(): MonthIndex[] {
    return Array.from({ length: 12 }, (_, i) => new MonthIndex(i));
  }

  get value(): number {
    return this.idx;
  }

  /** Türkçe ay adı (örn. 0 → "Ocak"). */
  nameTr(): string {
    return MONTH_NAMES_TR[this.idx]!;
  }

  equals(other: MonthIndex): boolean {
    return this.idx === other.idx;
  }

  toJSON(): number {
    return this.idx;
  }
}
