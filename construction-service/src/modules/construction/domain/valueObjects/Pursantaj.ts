/**
 * Pursantaj hesap motoru (saf fonksiyon).
 *
 * Her keşif kaleminin tutarı (quantity*unitPrice) toplam keşif bedeline
 * oranlanır: pursantaj_pct = amount / Σamount * 100. Toplam Σ pursantaj = 100
 * olur (yuvarlama toleransı dahilinde). Σamount = 0 ise tüm oranlar 0.
 */

/** 6 ondalığa yuvarlar (NUMERIC(9,6) uyumu). */
export function round6(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

/**
 * Verilen tutar dizisi için pursantaj yüzdelerini (0–100) hesaplar.
 * Dönen dizi girişle aynı sırada ve uzunluktadır.
 */
export function computePursantajPct(amounts: ReadonlyArray<number>): number[] {
  const total = amounts.reduce((s, a) => s + a, 0);
  if (total <= 0) return amounts.map(() => 0);
  return amounts.map((a) => round6((a / total) * 100));
}
