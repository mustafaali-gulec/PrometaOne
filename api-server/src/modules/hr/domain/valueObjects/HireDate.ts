/**
 * HireDate — çalışan işe başlama tarihi.
 *
 * Kurallar:
 *   - Geçerli bir Date olmalı
 *   - Çok eski (1900 öncesi) olamaz
 *   - "Bugün" referansından 1 yıldan fazla gelecekte olamaz
 *     (geleceğe randevu kabul, ama mantıksız tarih reddi)
 */
export class HireDate {
  private constructor(public readonly value: Date) {}

  static create(raw: Date, today: Date = new Date()): HireDate {
    if (!(raw instanceof Date) || isNaN(raw.getTime())) {
      throw new InvalidHireDateError('HireDate geçerli bir tarih olmalı');
    }

    // 1900 öncesi reddet
    if (raw.getUTCFullYear() < 1900) {
      throw new InvalidHireDateError(`HireDate 1900 yılından önce olamaz: ${raw.toISOString()}`);
    }

    // 1 yıldan fazla gelecekte reddet
    const oneYearFromToday = new Date(today);
    oneYearFromToday.setUTCFullYear(oneYearFromToday.getUTCFullYear() + 1);
    if (raw.getTime() > oneYearFromToday.getTime()) {
      throw new InvalidHireDateError(
        `HireDate 1 yıldan fazla gelecekte olamaz: ${raw.toISOString()}`,
      );
    }

    // Date'i sadece tarih kısmına normalize et (saat 00:00:00Z)
    const normalized = new Date(
      Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()),
    );
    return new HireDate(normalized);
  }

  /** YYYY-MM-DD formatı (ISO date). */
  toISOString(): string {
    return this.value.toISOString().slice(0, 10);
  }

  toString(): string {
    return this.toISOString();
  }
}

export class InvalidHireDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidHireDateError';
  }
}
