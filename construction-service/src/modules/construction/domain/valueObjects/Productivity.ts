/**
 * Verimlilik hesapları (FAZ 4) — SQL view'ının TypeScript ikizi.
 * View: cs_v_boq_performance (008_manhours_productivity.sql)
 *
 * İki uygulama BİLE BİLE ikizlenmiştir: rapor SQL'den okunur (hız), ama aynı
 * formül burada da durur ki hem birim testlenebilsin hem de sunucu tarafı
 * hesaplama gereken yerlerde (özet, tahmin) tekrar yazılmasın. Biri değişirse
 * diğeri de değişmeli.
 *
 * ORAN KURALI: payda 0 ise sonuç **null**, 0 değil. Planlanan adam×saat
 * girilmemiş bir pozda "verim 0" yazmak, verimin ölçülemediğini değil kötü
 * olduğunu söyler; şantiye şefi olmayan bir problemi kovalar.
 */

/** Payda 0 ise null döndüren güvenli bölme. */
export function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

/** Yüzde karşılığı (× 100). Payda 0 ise null. */
export function safePct(part: number, whole: number): number | null {
  const r = safeRatio(part, whole);
  return r === null ? null : r * 100;
}

export interface ManhourInput {
  /** Keşifteki planlanan miktar. */
  plannedQty: number;
  /** Birim başına planlanan adam×saat. */
  plannedUnitManhours: number;
  /** Günlük rapordan gelen fiilen üretilen miktar. */
  producedQty: number;
  /** Puantaj + taşeron günlük kayıtlarından toplanan fiili adam×saat. */
  actualManhours: number;
}

export interface ProductivityResult {
  /** quantity × unit_manhours */
  plannedManhours: number;
  /** Üretilen miktar için planlanan birim a×s ile beklenen a×s. */
  expectedManhours: number;
  /** Fiili birim a×s = harcanan / üretilen. Üretim 0 ise null. */
  actualUnitManhours: number | null;
  /** Verim = beklenen / harcanan. >1 planın önünde, <1 gerisinde. Harcanan 0 ise null. */
  efficiency: number | null;
  /** Harcanan − beklenen. Pozitif = fazla adam×saat yakıldı. */
  manhourVariance: number;
  /** Adam×saat tamamlanma oranı (harcanan / planlanan × 100). */
  manhourPct: number | null;
  /** Miktar tamamlanma oranı (üretilen / planlanan × 100). */
  producedPct: number | null;
  /**
   * İLERLEME-İŞÇİLİK MAKASI: miktar% − adam×saat%.
   * Negatif değer şantiyede kâr kaybının en erken sinyalidir: işin %50'sini
   * yapmışken adam-saatin %70'ini yakmışsan makas −20'dir ve tutar tablosu hâlâ
   * iyi görünürken iş fiilen batıyordur.
   */
  progressGap: number | null;
}

export function computeProductivity(input: ManhourInput): ProductivityResult {
  const plannedManhours = input.plannedQty * input.plannedUnitManhours;
  const expectedManhours = input.producedQty * input.plannedUnitManhours;
  const manhourPct = safePct(input.actualManhours, plannedManhours);
  const producedPct = safePct(input.producedQty, input.plannedQty);

  return {
    plannedManhours,
    expectedManhours,
    actualUnitManhours: safeRatio(input.actualManhours, input.producedQty),
    efficiency: safeRatio(expectedManhours, input.actualManhours),
    manhourVariance: input.actualManhours - expectedManhours,
    manhourPct,
    producedPct,
    progressGap: producedPct === null || manhourPct === null ? null : producedPct - manhourPct,
  };
}

/**
 * Ağırlıklı verim — satır ortalaması DEĞİL, Σbeklenen / Σharcanan.
 * 1 adam-saatlik poz ile 10.000 adam-saatlik pozun verimi aynı ağırlıkta
 * sayılamaz; basit ortalama küçük pozların gürültüsünü öne çıkarır.
 */
export function weightedEfficiency(
  rows: ReadonlyArray<{ expectedManhours: number; actualManhours: number }>,
): number | null {
  const expected = rows.reduce((s, r) => s + r.expectedManhours, 0);
  const actual = rows.reduce((s, r) => s + r.actualManhours, 0);
  return safeRatio(expected, actual);
}

/**
 * Tahmini bitiş adam×saati (EAC — Estimate At Completion, işçilik ayağı).
 * Mevcut verimle devam edilirse iş bitiminde toplam kaç adam×saat harcanacak?
 *
 * Verim ölçülemiyorsa (henüz üretim yok) plan döner — "bilinmiyor" yerine plana
 * dönmek doğru varsayımdır: elimizde plandan başka veri yoktur.
 */
export function estimateAtCompletion(input: ManhourInput): number {
  const plannedManhours = input.plannedQty * input.plannedUnitManhours;
  if (input.producedQty <= 0 || input.actualManhours <= 0) return plannedManhours;
  const actualUnit = input.actualManhours / input.producedQty;
  return input.plannedQty * actualUnit;
}

/** Verim yorumu eşikleri — arayüz renklendirmesi tek yerden gelsin. */
export type EfficiencyBand = 'unknown' | 'critical' | 'behind' | 'onTrack' | 'ahead';

/**
 * %10'luk tolerans bandı kasıtlı: şantiye ölçümü doğası gereği gürültülüdür,
 * 0,98 verimi "geride" diye kırmızıya boyamak uyarı yorgunluğu yaratır ve
 * gerçek sapmalar gözden kaçar.
 */
export function efficiencyBand(efficiency: number | null): EfficiencyBand {
  if (efficiency === null) return 'unknown';
  if (efficiency < 0.75) return 'critical';
  if (efficiency < 0.9) return 'behind';
  if (efficiency <= 1.1) return 'onTrack';
  return 'ahead';
}
