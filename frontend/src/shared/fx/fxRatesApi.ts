/**
 * fxRatesApi — TCMB kurları için backend istemcisi (`/v1/finance/fx`).
 *
 * NEDEN BACKEND: App.jsx'teki `fetchTcmbRates()` tarayıcıdan doğrudan EVDS'ye gider;
 * CORS engeline takılır ve kullanıcı başına API anahtarı ister. Backend FX modülü
 * (api-server/src/modules/finance/fx) aynı kurları sunucu tarafında çeker ve
 * `exchange_rate_history` tablosunda saklar — anahtarsız, CORS'suz.
 *
 * Endpoint imzaları api-server .../einvoice/presentation/routes.ts'ten doğrulandı:
 *   GET /v1/finance/fx/rates                        → { USD, EUR, date }
 *   GET /v1/finance/fx/rates/at?currency=&date=     → { currency, date, rate }
 *
 * Backend yoksa/erişilemiyorsa çağrılar `null` döner — çağıran taraf yerel
 * `rateBook` (app-state `rateHistory`/`exchangeRates`) ile devam eder.
 */
import type { CurrencyCode } from './fxCore';

const BASE = '/v1/finance/fx';

const token = (): string => {
  try {
    return globalThis.localStorage?.getItem('promet_access_token') ?? '';
  } catch {
    return '';
  }
};

async function getJson(path: string): Promise<unknown> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token()}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface CurrentRates {
  USD: number | null;
  EUR: number | null;
  date: string | null;
}

/** `currency|date` → kur. Aynı tarih için tekrar tekrar ağa çıkmayı önler. */
const atCache = new Map<string, number | null>();
/** Uçuşta olan istekler — aynı anahtar için tek istek (single-flight). */
const inflight = new Map<string, Promise<number | null>>();

let currentCache: { value: CurrentRates; at: number } | null = null;
const CURRENT_TTL_MS = 5 * 60 * 1000;

/** Güncel TCMB kurları. Backend yoksa null. */
export async function fetchCurrentRates(force = false): Promise<CurrentRates | null> {
  if (!force && currentCache !== null && Date.now() - currentCache.at < CURRENT_TTL_MS) {
    return currentCache.value;
  }
  const raw = await getJson('/rates');
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const value: CurrentRates = {
    USD: num(o['USD']),
    EUR: num(o['EUR']),
    date: typeof o['date'] === 'string' ? o['date'] : null,
  };
  currentCache = { value, at: Date.now() };
  return value;
}

/**
 * Belirli bir tarihin TCMB kuru. Bulunamazsa / backend yoksa null.
 * Sonuç (null dahil) önbelleklenir — aynı belge tarihinde form her tuşta ağa çıkmaz.
 */
export async function fetchRateAt(currency: CurrencyCode, isoDate: string): Promise<number | null> {
  if (currency === 'TRY') return 1;
  const key = `${currency}|${isoDate}`;
  if (atCache.has(key)) return atCache.get(key) ?? null;

  const pending = inflight.get(key);
  if (pending !== undefined) return pending;

  const p = (async (): Promise<number | null> => {
    const raw = await getJson(
      `/rates/at?currency=${encodeURIComponent(currency)}&date=${encodeURIComponent(isoDate)}`,
    );
    let rate: number | null = null;
    if (raw !== null && typeof raw === 'object')
      rate = num((raw as Record<string, unknown>)['rate']);
    atCache.set(key, rate);
    inflight.delete(key);
    return rate;
  })();

  inflight.set(key, p);
  return p;
}

/** Önbelleği boşalt (kur elle güncellendiğinde / şirket değiştiğinde). */
export function clearFxRateCache(): void {
  atCache.clear();
  inflight.clear();
  currentCache = null;
}
