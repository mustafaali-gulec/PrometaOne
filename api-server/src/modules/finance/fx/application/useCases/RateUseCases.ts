/**
 * Döviz kuru use-case'leri: FetchAndStoreRates, GetCurrentRates, GetRateAt.
 */
import type { Clock } from '../../../application/ports/Clock.js';
import type { Currency } from '../../../domain/valueObjects/Currency.js';
import { ExchangeRate } from '../../domain/entities/ExchangeRate.js';
import { RateNotAvailableError } from '../../domain/errors/FxErrors.js';
import type { ExchangeRateRepository, RateProvider } from '../ports/FxPorts.js';

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface FetchAndStoreRatesResult {
  stored: number;
  latestDate: string | null;
}

export class FetchAndStoreRatesUseCase {
  constructor(
    private readonly provider: RateProvider,
    private readonly rates: ExchangeRateRepository,
    private readonly clock: Clock,
  ) {}

  /** Son `lookbackDays` günü çekip kaydeder (TCMB hafta sonu yayınlamaz → pencere). */
  async execute(input: { lookbackDays?: number } = {}): Promise<FetchAndStoreRatesResult> {
    const today = this.clock.now();
    const past = new Date(today);
    past.setDate(past.getDate() - (input.lookbackDays ?? 7));

    const daily = await this.provider.fetchRates(fmt(past), fmt(today));
    let latestDate: string | null = null;
    for (const d of daily) {
      await this.rates.upsert(
        ExchangeRate.create({ currency: d.currency, date: d.date, rate: d.rate, source: 'TCMB' }),
      );
      if (latestDate === null || d.date > latestDate) latestDate = d.date;
    }
    return { stored: daily.length, latestDate };
  }
}

export interface CurrentRatesDto {
  USD: number | null;
  EUR: number | null;
  date: string | null;
}

export class GetCurrentRatesUseCase {
  constructor(private readonly rates: ExchangeRateRepository) {}

  async execute(): Promise<CurrentRatesDto> {
    const [usd, eur] = await Promise.all([
      this.rates.getCurrent('USD'),
      this.rates.getCurrent('EUR'),
    ]);
    const dates = [usd?.date, eur?.date].filter((d): d is string => d !== undefined).sort();
    const latest = dates.length > 0 ? dates[dates.length - 1]! : null;
    return {
      USD: usd?.rate ?? null,
      EUR: eur?.rate ?? null,
      date: latest,
    };
  }
}

export class GetRateAtUseCase {
  constructor(private readonly rates: ExchangeRateRepository) {}

  /** date tarihindeki (veya öncesi en yakın) kur; yoksa RateNotAvailableError. */
  async execute(input: { currency: Currency; date: string }): Promise<number> {
    if (input.currency === 'TRY') return 1;
    const rate = await this.rates.getAt(input.currency, input.date);
    if (rate === null) {
      throw new RateNotAvailableError(input.currency, input.date);
    }
    return rate.rate;
  }
}
