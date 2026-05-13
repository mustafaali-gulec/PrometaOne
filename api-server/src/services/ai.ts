/**
 * AI Tahmin servisi.
 * Frontend'deki predictTimeSeries algoritmasının server-side portu.
 *
 * Ensemble:
 *   - Linear regression (trend)
 *   - 3-month moving average
 *   - Exponential smoothing (α=0.4)
 *
 * Çoklu yıl arşiv verisini kullanır.
 */
import { pool } from "../db.js";
import type {
  AIPredictionResponse,
  CategoryPrediction,
  ConfidenceLevel,
  TrendDirection,
  Category,
} from "../types.js";

interface PredictionResult {
  values: number[];
  lower: number[];
  upper: number[];
  r2: number;
  confidence: ConfidenceLevel;
  trend: TrendDirection;
  mean: number;
}

/** Tek seri için tahmin (ensemble) */
function predictTimeSeries(series: number[], horizon: number): PredictionResult {
  const n = series.length;
  if (n === 0) {
    return {
      values: new Array(horizon).fill(0),
      lower: new Array(horizon).fill(0),
      upper: new Array(horizon).fill(0),
      r2: 0,
      confidence: "very_low",
      trend: "stable",
      mean: 0,
    };
  }

  // 1) Linear regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += series[i]!;
    sumXY += i * series[i]!;
    sumX2 += i * i;
  }
  const meanY = sumY / n;
  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
  const intercept = meanY - slope * (sumX / n);

  // R²
  let ssTotal = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssTotal += (series[i]! - meanY) ** 2;
    ssRes += (series[i]! - predicted) ** 2;
  }
  const r2 = ssTotal > 0 ? Math.max(0, 1 - ssRes / ssTotal) : 0;

  // 2) Moving average (son 3 ay)
  const recent = series.slice(-3);
  const ma = recent.length > 0
    ? recent.reduce((a, b) => a + b, 0) / recent.length
    : meanY;

  // 3) Exponential smoothing (α=0.4)
  const alpha = 0.4;
  let es = series[0] ?? 0;
  for (let i = 1; i < n; i++) {
    es = alpha * series[i]! + (1 - alpha) * es;
  }

  // Ensemble ağırlıkları (r²'ye göre)
  let wLinear: number, wMa: number, wEs: number;
  if (r2 >= 0.6) {
    wLinear = 0.55; wMa = 0.20; wEs = 0.25;
  } else if (r2 >= 0.3) {
    wLinear = 0.35; wMa = 0.30; wEs = 0.35;
  } else {
    wLinear = 0.15; wMa = 0.40; wEs = 0.45;
  }

  // Standard deviation (confidence interval için)
  const std = Math.sqrt(
    series.reduce((s, v) => s + (v - meanY) ** 2, 0) / Math.max(1, n - 1)
  );

  // Tahmin
  const values: number[] = [];
  const lower: number[] = [];
  const upper: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const linearPred = slope * (n + h - 1) + intercept;
    const ensemble = wLinear * linearPred + wMa * ma + wEs * es;
    const prediction = Math.max(0, ensemble); // negatif tahminleri 0'la
    values.push(prediction);

    // %95 güven aralığı (yaklaşık ±2σ)
    const interval = 1.96 * std * Math.sqrt(h);
    lower.push(Math.max(0, prediction - interval));
    upper.push(prediction + interval);
  }

  // Confidence seviyesi
  let confidence: ConfidenceLevel;
  if (r2 > 0.7 && n >= 6) confidence = "high";
  else if (r2 > 0.4 && n >= 4) confidence = "medium";
  else if (n >= 3) confidence = "low";
  else confidence = "very_low";

  // Trend yönü
  const slopeRatio = meanY > 0 ? Math.abs(slope) / meanY : 0;
  let trend: TrendDirection = "stable";
  if (slopeRatio > 0.05) {
    trend = slope > 0 ? "increasing" : "decreasing";
  }

  return { values, lower, upper, r2, confidence, trend, mean: meanY };
}

/**
 * Bir kategori için çapraz-yıl tarihsel zaman serisi oluşturur.
 * Mevcut yıl + arşivlenmiş yılları birleştirir (kronolojik sıra).
 */
async function buildCrossYearHistory(
  companyId: number,
  categoryId: number,
  categoryName: string,
  currentFiscalYear: number,
  currentMonth: number,
  useArchives: boolean
): Promise<number[]> {
  const series: number[] = [];

  if (useArchives) {
    // Arşivlerden veriyi çek
    const archives = await pool.query<{ fiscal_year: number; snapshot: any }>(
      `SELECT fiscal_year, snapshot FROM year_archives
       WHERE company_id = $1 AND fiscal_year < $2
       ORDER BY fiscal_year ASC`,
      [companyId, currentFiscalYear]
    );

    for (const arch of archives.rows) {
      const snap = arch.snapshot;
      // ID veya isim ile eşleştir (yeniden adlandırılmış kategoriler için)
      const allCats: any[] = [
        ...(snap.inflows ?? []),
        ...(snap.outflows ?? []),
        ...(snap.nonPnlOutflows ?? []),
      ];
      const matched = allCats.find(c => c.id === categoryId || c.name === categoryName);
      if (matched) {
        for (let i = 0; i < 12; i++) {
          series.push(Number(snap.cells?.[`${matched.id}:${i}`] ?? 0));
        }
      } else {
        // Bu kategori bu arşivde yoktu — 12 ay sıfır (continuity)
        for (let i = 0; i < 12; i++) series.push(0);
      }
    }
  }

  // Mevcut yıl
  const cells = await pool.query<{ month_idx: number; value: string }>(
    `SELECT month_idx, value FROM cells
     WHERE company_id = $1 AND category_id = $2 AND fiscal_year = $3
     ORDER BY month_idx`,
    [companyId, categoryId, currentFiscalYear]
  );
  const cellMap = new Map<number, number>();
  for (const row of cells.rows) {
    cellMap.set(row.month_idx, parseFloat(row.value));
  }
  for (let i = 0; i <= currentMonth; i++) {
    series.push(cellMap.get(i) ?? 0);
  }

  return series;
}

/** Şirket için tüm kategori tahminleri */
export async function predictForCompany(
  companyId: number,
  horizon: number = 3,
  useArchives: boolean = true
): Promise<AIPredictionResponse> {
  // Şirket bilgisi
  const company = await pool.query<{ fiscal_year: number; opening_cash: string }>(
    `SELECT fiscal_year, opening_cash FROM companies WHERE id = $1`,
    [companyId]
  );
  if (company.rowCount === 0) {
    throw new Error("Şirket bulunamadı");
  }
  const fiscalYear = company.rows[0]!.fiscal_year;
  const openingCash = parseFloat(company.rows[0]!.opening_cash);

  // Mevcut ay (calendar month)
  const today = new Date();
  const currentMonth = today.getFullYear() === fiscalYear ? today.getMonth() : 11;

  // Kategoriler
  const categoriesRes = await pool.query<{
    id: number; name: string; section: string;
  }>(
    `SELECT id, name, section FROM categories
     WHERE company_id = $1 AND section IN ('inflows', 'outflows')
     ORDER BY section, sort_order`,
    [companyId]
  );

  const inflows: CategoryPrediction[] = [];
  const outflows: CategoryPrediction[] = [];

  // Arşiv sayısı
  const archCount = useArchives
    ? Number((await pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM year_archives WHERE company_id = $1 AND fiscal_year < $2`,
        [companyId, fiscalYear]
      )).rows[0]?.c ?? 0)
    : 0;

  let totalMonths = 0;
  for (const cat of categoriesRes.rows) {
    const series = await buildCrossYearHistory(
      companyId, cat.id, cat.name, fiscalYear, currentMonth, useArchives
    );
    totalMonths = Math.max(totalMonths, series.length);

    const nonZero = series.filter(v => v > 0).length;
    if (nonZero === 0) continue;

    const pred = predictTimeSeries(series, horizon);
    const result: CategoryPrediction = {
      categoryId: cat.id,
      categoryName: cat.name,
      historical: series,
      predicted: pred.values,
      lower: pred.lower,
      upper: pred.upper,
      r2: pred.r2,
      confidence: pred.confidence,
      trend: pred.trend,
      totalPredicted: pred.values.reduce((a, b) => a + b, 0),
      mean: pred.mean,
    };

    if (cat.section === "inflows") inflows.push(result);
    else outflows.push(result);
  }

  // Tutara göre sırala (en büyükler önce)
  inflows.sort((a, b) => b.totalPredicted - a.totalPredicted);
  outflows.sort((a, b) => b.totalPredicted - a.totalPredicted);

  // Projeksiyon nakdi (mevcut nakit + tahmin edilen ay sonu net)
  const projectedCash: number[] = [];
  let running = openingCash;
  // Mevcut aya kadarki birikim
  const currentCellsRes = await pool.query<{ section: string; value_sum: string }>(
    `SELECT cat.section, COALESCE(SUM(cl.value), 0)::text AS value_sum
     FROM categories cat
     LEFT JOIN cells cl ON cl.category_id = cat.id
       AND cl.fiscal_year = $2
       AND cl.month_idx <= $3
     WHERE cat.company_id = $1
     GROUP BY cat.section`,
    [companyId, fiscalYear, currentMonth]
  );
  let inflowTotal = 0, outflowTotal = 0;
  for (const r of currentCellsRes.rows) {
    if (r.section === "inflows") inflowTotal += parseFloat(r.value_sum);
    else outflowTotal += parseFloat(r.value_sum);
  }
  running += inflowTotal - outflowTotal;

  for (let h = 0; h < horizon; h++) {
    const monthInflow = inflows.reduce((s, c) => s + (c.predicted[h] ?? 0), 0);
    const monthOutflow = outflows.reduce((s, c) => s + (c.predicted[h] ?? 0), 0);
    running += monthInflow - monthOutflow;
    projectedCash.push(running);
  }

  return {
    currentMonth,
    horizon,
    yearsOfData: archCount + 1,
    monthsOfData: totalMonths,
    inflows,
    outflows,
    projectedCash,
    algorithm: {
      method: "Linear regression + 3-month MA + Exponential smoothing (ensemble)",
      weights: { linear: 0.4, ma: 0.3, es: 0.3 },
    },
  };
}
