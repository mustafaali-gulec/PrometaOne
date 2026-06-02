/**
 * TcmbRateProvider — TCMB EVDS API'sinden USD/EUR kuru çeker (RateProvider impl).
 *
 * Legacy `src/services/tcmb.ts`'in strict + port-uyumlu hâli. `fetch` enjekte
 * edilebilir (test için); api key opsiyonel. EVDS tarih formatı DD-MM-YYYY;
 * giriş/çıkış YYYY-MM-DD'ye normalize edilir.
 *
 * Kur serileri: TP.DK.USD.A.YTL (USD/TRY alış), TP.DK.EUR.A.YTL (EUR/TRY alış).
 */
import type { DailyRate, RateProvider } from '../../application/ports/FxPorts.js';
import { RateProviderError } from '../../domain/errors/FxErrors.js';

const TCMB_BASE = 'https://evds2.tcmb.gov.tr/service/evds';
const SERIES = 'TP.DK.USD.A.YTL-TP.DK.EUR.A.YTL';

type FetchFn = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}>;

/** YYYY-MM-DD → DD-MM-YYYY (EVDS). */
function toEvdsDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** DD-MM-YYYY → YYYY-MM-DD. */
function fromEvdsDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('-');
  return `${y}-${m}-${d}`;
}

function asObj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export class TcmbRateProvider implements RateProvider {
  constructor(private readonly options: { apiKey?: string; fetchFn?: FetchFn } = {}) {}

  async fetchRates(startDate: string, endDate: string): Promise<DailyRate[]> {
    const fetchFn: FetchFn = this.options.fetchFn ?? globalThis.fetch;

    const url = new URL(`${TCMB_BASE}/serieList`);
    url.searchParams.set('series', SERIES);
    url.searchParams.set('startDate', toEvdsDate(startDate));
    url.searchParams.set('endDate', toEvdsDate(endDate));
    url.searchParams.set('type', 'json');
    if (this.options.apiKey !== undefined && this.options.apiKey !== '') {
      url.searchParams.set('key', this.options.apiKey);
    }

    let response: Awaited<ReturnType<FetchFn>>;
    try {
      response = await fetchFn(url.toString(), { headers: { Accept: 'application/json' } });
    } catch (err) {
      throw new RateProviderError(err instanceof Error ? err.message : String(err));
    }
    if (!response.ok) {
      throw new RateProviderError(`TCMB API ${response.status} ${response.statusText}`);
    }

    const data = asObj(await response.json());
    const items = Array.isArray(data['items']) ? (data['items'] as unknown[]) : [];

    const out: DailyRate[] = [];
    for (const raw of items) {
      const item = asObj(raw);
      const tarih = item['Tarih'];
      if (typeof tarih !== 'string') continue;
      const date = fromEvdsDate(tarih);
      const usd = num(item['TP_DK_USD_A_YTL']);
      const eur = num(item['TP_DK_EUR_A_YTL']);
      if (usd > 0) out.push({ date, currency: 'USD', rate: usd });
      if (eur > 0) out.push({ date, currency: 'EUR', rate: eur });
    }
    return out;
  }
}
