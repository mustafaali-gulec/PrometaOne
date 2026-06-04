/**
 * LeaveDaysCalculator — izin gün sayısı hesabı.
 *
 * Saf domain servisi. start..end aralığını dahil (inclusive) sayar:
 * aynı gün başlayıp biten izin = 1 gün.
 *
 * Basit tutuldu — hafta sonu / resmi tatil çıkarımı YOK (over-engineering'den
 * kaçınıldı). İleride takvim politikası gerekirse buraya enjekte edilir.
 */
export class LeaveDaysCalculator {
  private static readonly MS_PER_DAY = 24 * 60 * 60 * 1000;

  /**
   * start..end arasındaki gün sayısını dahil (inclusive) döner.
   * Saat bileşeni göz ardı edilir (UTC gün sınırına normalize edilir).
   */
  static days(start: Date, end: Date): number {
    const s = LeaveDaysCalculator.atUtcMidnight(start);
    const e = LeaveDaysCalculator.atUtcMidnight(end);
    if (e < s) {
      throw new Error('LeaveDaysCalculator: end_date start_date öncesi olamaz');
    }
    return Math.round((e - s) / LeaveDaysCalculator.MS_PER_DAY) + 1;
  }

  private static atUtcMidnight(d: Date): number {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
}
