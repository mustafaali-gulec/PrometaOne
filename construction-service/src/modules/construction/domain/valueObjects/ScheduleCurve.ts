/**
 * S-eğrisi matematiği (FAZ 8) — saf fonksiyonlar, birim testli.
 *
 * PLANLANAN EĞRİ hesaptan gelir: her yaprak aktivitenin ağırlığı, planlanan
 * süresine DOĞRUSAL yayılır (kilometre taşı bitiş gününde basamak yapar).
 * Doğrusal yayılım bir yaklaşımdır ama dürüst bir yaklaşımdır: elimizde
 * aktivite içi dağılım verisi yok ve "banana eğrisi" uydurmak hassasiyet
 * yanılsaması yaratır.
 *
 * FİİLİ EĞRİ ise hesaptan DEĞİL kayıttan gelir: ilerleme günlüğündeki anlık
 * görüntüler (as_of, pct) noktalar arasında SON BİLİNEN DEĞERLE taşınır
 * (step function). Doğrusal ara değer çekmek iki ölçüm arasında "ilerleme
 * olmuş" gibi gösterirdi — ölçüm yoksa bilgi de yok.
 *
 * AĞIRLIK: weight_pct'lerin toplamı > 0 ise normalize edilir; hepsi 0 ise
 * SÜRE-ORANTILI ağırlığa düşülür (kullanıcı ağırlık girmeden de eğri çizilsin;
 * kilometre taşı süresiz olduğundan bu kipte ağırlığı 0'dır).
 */

export interface CurveActivity {
  id: number;
  /** 'group' satırları çağıran tarafından ELENMİŞ olmalı — burada yalnız yaprak. */
  kind: 'task' | 'milestone';
  plannedStart: string; // YYYY-MM-DD
  plannedEnd: string;
  weightPct: number;
  /** İlerleme günlüğü anlık görüntüleri (as_of artan sırada olması şart değil). */
  progressLog: ReadonlyArray<{ asOf: string; progressPct: number }>;
}

export interface CurvePoint {
  date: string;
  /** Kümülatif planlanan % (0-100). */
  plannedPct: number;
  /**
   * Kümülatif fiili %. GELECEK tarihte null — fiili gelecek için çizilmez;
   * geçmişte günlük boşsa 0 (ölçüm yok = ilerleme kaydı yok).
   */
  actualPct: number | null;
}

export interface ScheduleCurve {
  points: CurvePoint[];
  /** Kullanılan ağırlık kipi — arayüz hangi varsayımla çizildiğini söylesin. */
  weightMode: 'explicit' | 'duration';
  plannedStart: string | null;
  plannedEnd: string | null;
}

const DAY = 86_400_000;
const toMs = (d: string): number => Date.parse(`${d}T00:00:00Z`);
const toDateStr = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Aktivitenin verilen tarihteki planlanan tamamlanma oranı (0..1). */
export function plannedFractionAt(a: CurveActivity, dateMs: number): number {
  const start = toMs(a.plannedStart);
  const end = toMs(a.plannedEnd);
  if (dateMs < start) return 0;
  if (dateMs >= end) return 1;
  // Kilometre taşı: bitiş gününe kadar 0, o gün 1 (yukarıdaki iki dal kapsar;
  // start === end olduğundan buraya düşmez).
  return (dateMs - start) / (end - start);
}

/** Günlükten verilen tarihteki SON BİLİNEN yüzde (step); kayıt yoksa 0. */
export function actualFractionAt(a: CurveActivity, dateMs: number): number {
  let best: { ms: number; pct: number } | null = null;
  for (const p of a.progressLog) {
    const ms = toMs(p.asOf);
    if (ms <= dateMs && (best === null || ms > best.ms)) {
      best = { ms, pct: p.progressPct };
    }
  }
  return best === null ? 0 : best.pct / 100;
}

/** Normalize ağırlıklar; hepsi 0 ise süre-orantılı kipe düşer. */
export function resolveWeights(activities: ReadonlyArray<CurveActivity>): {
  weights: Map<number, number>;
  mode: 'explicit' | 'duration';
} {
  const weights = new Map<number, number>();
  const explicitSum = activities.reduce((s, a) => s + a.weightPct, 0);

  if (explicitSum > 0) {
    for (const a of activities) weights.set(a.id, a.weightPct / explicitSum);
    return { weights, mode: 'explicit' };
  }

  // Süre-orantılı: +1 gün — tek günlük işin süresi 0 değil 1'dir.
  const durations = activities.map(
    (a) => (toMs(a.plannedEnd) - toMs(a.plannedStart)) / DAY + (a.kind === 'milestone' ? 0 : 1),
  );
  const total = durations.reduce((s, d) => s + d, 0);
  activities.forEach((a, i) => {
    weights.set(a.id, total > 0 ? (durations[i] ?? 0) / total : 0);
  });
  return { weights, mode: 'duration' };
}

/**
 * Proje S-eğrisi. `today` fiilinin çizileceği son tarih (gelecekte fiili null).
 * `stepDays` nokta aralığı (7 = haftalık). Uçlar her zaman dahildir.
 */
export function computeScheduleCurve(
  activities: ReadonlyArray<CurveActivity>,
  today: string,
  stepDays = 7,
): ScheduleCurve {
  if (activities.length === 0) {
    return { points: [], weightMode: 'duration', plannedStart: null, plannedEnd: null };
  }

  const { weights, mode } = resolveWeights(activities);
  const startMs = Math.min(...activities.map((a) => toMs(a.plannedStart)));
  // Eğri bugüne kadar uzar: plan bitmiş ama iş sürüyorsa fiili çizgi kesilmesin.
  const endMs = Math.max(...activities.map((a) => toMs(a.plannedEnd)), toMs(today));
  const todayMs = toMs(today);

  const dates: number[] = [];
  for (let ms = startMs; ms < endMs; ms += stepDays * DAY) dates.push(ms);
  dates.push(endMs);
  // BUGÜN her zaman bir noktadır: hafta kovasına denk gelmezse son ölçüm
  // eğride stepDays-1 güne kadar görünmez kalırdı — "bugünkü fiili" eğrinin
  // en çok bakılan değeridir.
  if (todayMs > startMs && todayMs < endMs && !dates.includes(todayMs)) {
    dates.push(todayMs);
    dates.sort((a, b) => a - b);
  }

  const points: CurvePoint[] = dates.map((ms) => {
    let planned = 0;
    let actual = 0;
    for (const a of activities) {
      const w = weights.get(a.id) ?? 0;
      planned += w * plannedFractionAt(a, ms);
      actual += w * actualFractionAt(a, ms);
    }
    return {
      date: toDateStr(ms),
      plannedPct: round2(planned * 100),
      actualPct: ms > todayMs ? null : round2(actual * 100),
    };
  });

  return {
    points,
    weightMode: mode,
    plannedStart: toDateStr(startMs),
    plannedEnd: toDateStr(Math.max(...activities.map((a) => toMs(a.plannedEnd)))),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
