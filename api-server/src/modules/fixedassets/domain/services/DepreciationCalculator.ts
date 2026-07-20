/**
 * DepreciationCalculator — VUK amortisman hesap motoru (modülün kalbi).
 *
 * SAF (pure) bir hesaplayıcıdır: clock/random/IO içermez, tüm girdiler
 * parametre olarak gelir, deterministiktir. Bu sayede kapsamlı birim testi
 * yazılabilir (MrpCalculator ile aynı felsefe).
 *
 * VUK kuralları:
 *   base = max(0, maliyet − hurda değeri); plan yıl sayısı N = faydalı ömür.
 *
 *   normal (eşit tutarlı):
 *     yıllık = base / N (2 hane); SON yıl = base − öncekiToplam
 *     (yuvarlama artığı son yılda kapanır).
 *
 *   declining (azalan bakiyeler):
 *     rate = min(2/N, 0.5); yıllık = round2(NBV_başı × rate),
 *     NBV_başı = maliyet − birikmişBaşı; SON yıl (yıl N) = base − birikmişBaşı
 *     (kalanın tamamı).
 *
 *   Kıst (isPassengerCar=true — VUK binek oto):
 *     ilk yıl ay kıstı — m = 13 − alımAyı; ilkYıl = round2(tamYıllık × m/12);
 *     ertelenen (tamYıllık − ilkYıl) SON yıla eklenir (süre uzamaz, N yıl
 *     kalır). Declining'de son yıl zaten "kalanın tamamı" olduğundan ertelenen
 *     otomatik kapanır.
 *
 *   Birikmiş amortisman hiçbir zaman base'i aşmaz.
 *
 * Aylıklandırma (accumulatedThrough):
 *   Tamamlanmış plan yılları tam annual; içinde bulunulan yıl ay payı ile:
 *     - alım yılı (kıst DEĞİL): annual/(13−alımAyı) — tam yıllık tutar alım
 *       ayından yıl sonuna kalan aylara yayılır;
 *     - alım yılı (kıst): tamYıllık/12 — annual zaten kıstlı olduğundan
 *       ay payı annual/m'e denk düşer;
 *     - sonraki yıllar (son yıl dahil, ertelenen dahil annual): annual/12.
 */
import { FixedAssetValidationError } from '../errors/FixedAssetErrors.js';

// --- Girdi / çıktı tipleri --------------------------------------------------

export interface DepreciableAsset {
  /** Alım tarihi, 'YYYY-MM-DD' (en az 'YYYY-MM' öneki geçerli olmalı). */
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeYears: number;
  method: 'normal' | 'declining';
  /** VUK binek oto kıst amortisman işareti. */
  isPassengerCar: boolean;
  salvageValue: number;
  /** Sistem öncesi ayrılmış birikmiş amortisman (plana DAHİL edilmez; koşum farkında çağıran kullanır). */
  openingAccumulated: number;
}

export interface PlanYear {
  /** Takvim yılı (alım yılı = ilk plan yılı). */
  year: number;
  annual: number;
  accumulatedEnd: number;
  nbvEnd: number;
}

export interface DepreciableAssetWithId extends DepreciableAsset {
  id: string;
}

export interface RunLine {
  assetId: string;
  amount: number;
}

// --- Yardımcılar -------------------------------------------------------------

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

interface YearMonth {
  year: number;
  month: number; // 1..12
}

function parseYearMonth(value: string, label: string): YearMonth {
  const m = /^(\d{4})-(\d{2})/.exec(value ?? '');
  if (m === null) {
    throw new FixedAssetValidationError(
      `${label} 'YYYY-MM' veya 'YYYY-MM-DD' formatında olmalı: ${value}`,
    );
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) {
    throw new FixedAssetValidationError(`${label} ay değeri 01–12 arasında olmalı: ${value}`);
  }
  return { year, month };
}

// --- Hesaplayıcı -------------------------------------------------------------

export class DepreciationCalculator {
  /**
   * Yıllık amortisman planı. usefulLifeYears <= 0 veya base = 0 → boş plan.
   * Her zaman N kayıt döner (klemplenen yıllar 0 tutarlı kalabilir).
   */
  computeAnnualPlan(asset: DepreciableAsset): PlanYear[] {
    const n = Math.floor(asset.usefulLifeYears);
    const cost = asset.acquisitionCost;
    const base = round2(Math.max(0, cost - Math.max(0, asset.salvageValue)));
    if (n <= 0 || base <= 0) return [];

    const acq = parseYearMonth(asset.acquisitionDate, 'Alım tarihi');
    const rate = asset.method === 'declining' ? Math.min(2 / n, 0.5) : 0;
    const kistMonths = 13 - acq.month; // ilk yılda amortisman ayrılan ay sayısı

    const plan: PlanYear[] = [];
    let accumulated = 0;

    for (let k = 1; k <= n; k++) {
      let annual: number;
      if (k === n) {
        // Son yıl: kalanın tamamı (yuvarlama artığı + kıst ertelenen kapanır).
        annual = round2(base - accumulated);
      } else {
        const fullAnnual =
          asset.method === 'declining' ? round2((cost - accumulated) * rate) : round2(base / n);
        annual =
          k === 1 && asset.isPassengerCar && kistMonths < 12
            ? round2((fullAnnual * kistMonths) / 12)
            : fullAnnual;
        // Birikmiş hiçbir zaman base'i aşmaz.
        annual = Math.min(annual, round2(base - accumulated));
      }
      annual = Math.max(0, annual);
      accumulated = round2(accumulated + annual);
      plan.push({
        year: acq.year + k - 1,
        annual,
        accumulatedEnd: accumulated,
        nbvEnd: round2(cost - accumulated),
      });
    }

    return plan;
  }

  /**
   * Alımdan verilen dönem ('YYYY-MM') SONUNA kadar ayrılmış OLMASI GEREKEN
   * birikmiş amortisman (plana göre aylıklandırılmış). period alım ay-yılından
   * önce ise 0; plan bittikten sonra base'e sabitlenir.
   */
  accumulatedThrough(asset: DepreciableAsset, period: string): number {
    const plan = this.computeAnnualPlan(asset);
    if (plan.length === 0) return 0;

    const p = parseYearMonth(period, 'Dönem');
    const acq = parseYearMonth(asset.acquisitionDate, 'Alım tarihi');
    if (p.year < acq.year || (p.year === acq.year && p.month < acq.month)) return 0;

    const lastPlan = plan[plan.length - 1]!;
    const base = lastPlan.accumulatedEnd;
    const kistMonths = 13 - acq.month;

    let total = 0;
    for (const py of plan) {
      if (py.year < p.year) {
        total += py.annual; // tamamlanmış plan yılı → tam annual
        continue;
      }
      if (py.year > p.year) break;

      // İçinde bulunulan plan yılı → ay payı.
      if (py.year === acq.year) {
        // Alım yılı: aylar alım ayından başlar (elapsed 1..m).
        const elapsed = p.month - acq.month + 1;
        // Kıst DEĞİLse ay payı annual/m (tam yıllık kalan aylara yayılır);
        // kıst İSE annual zaten tamYıllık×m/12 olduğundan annual/m = tamYıllık/12.
        total += (py.annual * elapsed) / kistMonths;
      } else {
        const elapsed = p.month; // Oca=1 … Ara=12
        total += (py.annual * elapsed) / 12;
      }
      break;
    }

    return Math.min(round2(total), base);
  }

  /**
   * Dönem amortisman koşum satırları.
   *   amount = max(0, round2(accumulatedThrough(period) − alreadyBooked))
   * alreadyBooked = openingAccumulated + önceki koşum satırları toplamı —
   * ÇAĞIRAN hesaplar ve openingAccumulated DAHİL geçirir; burada yalnız fark
   * alınır. amount = 0 olanlar elenir. Aktif olmayan kıymetleri çağıran
   * filtreler (status burada değerlendirilmez).
   */
  computeRunLines(
    period: string,
    assets: ReadonlyArray<DepreciableAssetWithId>,
    alreadyBookedByAssetId: Readonly<Record<string, number>>,
  ): RunLine[] {
    const lines: RunLine[] = [];
    for (const asset of assets) {
      const should = this.accumulatedThrough(asset, period);
      const booked = alreadyBookedByAssetId[asset.id] ?? 0;
      const amount = Math.max(0, round2(should - booked));
      if (amount > 0) lines.push({ assetId: asset.id, amount });
    }
    return lines;
  }
}
