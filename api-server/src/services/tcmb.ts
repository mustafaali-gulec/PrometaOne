/**
 * TCMB EVDS API entegrasyonu.
 *
 * Public endpoint kullanır (API key opsiyonel).
 * Günde 1-2 kez cron ile çekilir, history tablosuna yazılır.
 *
 * Kur kodları:
 *   - TP.DK.USD.A.YTL: USD/TRY (alış)
 *   - TP.DK.EUR.A.YTL: EUR/TRY (alış)
 */
import { pool } from "../db.js";
import { config } from "../config.js";

const TCMB_BASE = "https://evds2.tcmb.gov.tr/service/evds";

export interface CurrencyRate {
  date: string;
  USD: number;
  EUR: number;
}

interface EVDSItem {
  Tarih: string;
  "TP_DK_USD_A_YTL"?: string;
  "TP_DK_EUR_A_YTL"?: string;
}

interface EVDSResponse {
  totalCount: number;
  items: EVDSItem[];
}

/**
 * Belirli bir tarih aralığı için TCMB'den USD ve EUR kurlarını çeker.
 * @param startDate "DD-MM-YYYY" formatında başlangıç
 * @param endDate "DD-MM-YYYY" formatında bitiş
 */
export async function fetchTCMBRates(
  startDate: string,
  endDate: string
): Promise<CurrencyRate[]> {
  const series = "TP.DK.USD.A.YTL-TP.DK.EUR.A.YTL";
  const url = new URL(`${TCMB_BASE}/serieList`);
  url.searchParams.set("series", series);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  url.searchParams.set("type", "json");
  if (config.TCMB_API_KEY) {
    url.searchParams.set("key", config.TCMB_API_KEY);
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`TCMB API hatası: ${response.status} ${response.statusText}`);
  }

  const data: EVDSResponse = await response.json();
  if (!data.items?.length) {
    return [];
  }

  return data.items
    .filter(item => item["TP_DK_USD_A_YTL"] || item["TP_DK_EUR_A_YTL"])
    .map(item => {
      // Tarih formatı: "DD-MM-YYYY" → "YYYY-MM-DD"
      const [d, m, y] = item.Tarih.split("-");
      return {
        date: `${y}-${m}-${d}`,
        USD: parseFloat(item["TP_DK_USD_A_YTL"] ?? "0") || 0,
        EUR: parseFloat(item["TP_DK_EUR_A_YTL"] ?? "0") || 0,
      };
    })
    .filter(r => r.USD > 0 || r.EUR > 0);
}

/** Bugünün kurunu çek ve DB'ye yaz */
export async function fetchAndStoreTodaysRates(): Promise<{
  USD: number;
  EUR: number;
  effectiveDate: string;
}> {
  const today = new Date();
  // TCMB hafta sonu ve resmi tatillerde kur yayınlamaz —
  // son 7 günü çek, en son veriyi kullan
  const past = new Date(today);
  past.setDate(past.getDate() - 7);

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

  const rates = await fetchTCMBRates(fmt(past), fmt(today));
  if (rates.length === 0) {
    throw new Error("TCMB'den geçerli kur alınamadı");
  }

  // DB'ye yaz (upsert)
  for (const r of rates) {
    if (r.USD > 0) {
      await pool.query(
        `INSERT INTO exchange_rate_history (date, currency, rate, source)
         VALUES ($1, 'USD', $2, 'TCMB')
         ON CONFLICT (date, currency) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = NOW()`,
        [r.date, r.USD]
      );
    }
    if (r.EUR > 0) {
      await pool.query(
        `INSERT INTO exchange_rate_history (date, currency, rate, source)
         VALUES ($1, 'EUR', $2, 'TCMB')
         ON CONFLICT (date, currency) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = NOW()`,
        [r.date, r.EUR]
      );
    }
  }

  const latest = rates[rates.length - 1]!;
  return {
    USD: latest.USD,
    EUR: latest.EUR,
    effectiveDate: latest.date,
  };
}

/** En güncel kurları DB'den oku (cache) */
export async function getCurrentRates(): Promise<{ USD: number; EUR: number; date: string }> {
  const result = await pool.query<{ currency: string; rate: string; date: string }>(
    `SELECT currency, rate, date FROM v_current_rates WHERE currency IN ('USD', 'EUR')`
  );
  const out = { USD: 0, EUR: 0, date: "" };
  for (const row of result.rows) {
    if (row.currency === "USD") out.USD = parseFloat(row.rate);
    if (row.currency === "EUR") out.EUR = parseFloat(row.rate);
    if (!out.date || row.date > out.date) out.date = row.date;
  }
  return out;
}

/** Belirli tarihteki kuru DB'den oku (yoksa en yakını) */
export async function getRateAt(
  currency: "USD" | "EUR",
  date: string
): Promise<number | null> {
  const result = await pool.query<{ rate: string }>(
    `SELECT rate FROM exchange_rate_history
     WHERE currency = $1 AND date <= $2
     ORDER BY date DESC LIMIT 1`,
    [currency, date]
  );
  return result.rows[0] ? parseFloat(result.rows[0].rate) : null;
}
