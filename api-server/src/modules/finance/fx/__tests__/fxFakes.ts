/**
 * FX use-case testleri için in-memory fake'ler + FixedClock.
 */
import type { Clock } from '../../application/ports/Clock.js';
import type { Currency } from '../../domain/valueObjects/Currency.js';
import type {
  DailyRate,
  ExchangeRateRepository,
  RateProvider,
  RevaluationRepository,
} from '../application/ports/FxPorts.js';
import type { ExchangeRate } from '../domain/entities/ExchangeRate.js';
import type { Revaluation } from '../domain/entities/Revaluation.js';

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date = new Date('2026-06-01T00:00:00Z')) {}
  now(): Date {
    return this.fixed;
  }
}

export class InMemoryExchangeRateRepository implements ExchangeRateRepository {
  private readonly store = new Map<string, ExchangeRate>();

  private key(currency: Currency, date: string): string {
    return `${currency}|${date}`;
  }

  upsert(rate: ExchangeRate): Promise<void> {
    this.store.set(this.key(rate.currency, rate.date), rate);
    return Promise.resolve();
  }

  getCurrent(currency: Currency): Promise<ExchangeRate | null> {
    const matches = [...this.store.values()]
      .filter((r) => r.currency === currency)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return Promise.resolve(matches[0] ?? null);
  }

  getAt(currency: Currency, date: string): Promise<ExchangeRate | null> {
    const matches = [...this.store.values()]
      .filter((r) => r.currency === currency && r.date <= date)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return Promise.resolve(matches[0] ?? null);
  }
}

export class InMemoryRevaluationRepository implements RevaluationRepository {
  private seq = 0;
  private readonly store = new Map<number, Revaluation>();

  insert(revaluation: Revaluation): Promise<Revaluation> {
    this.seq += 1;
    const withId = revaluation.withId(this.seq);
    this.store.set(this.seq, withId);
    return Promise.resolve(withId);
  }

  update(revaluation: Revaluation): Promise<void> {
    if (revaluation.id !== null) {
      this.store.set(revaluation.id, revaluation);
    }
    return Promise.resolve();
  }

  findById(id: number, companyId: number): Promise<Revaluation | null> {
    const r = this.store.get(id);
    return Promise.resolve(r && r.companyId === companyId ? r : null);
  }

  listByCompany(companyId: number): Promise<ReadonlyArray<Revaluation>> {
    return Promise.resolve([...this.store.values()].filter((r) => r.companyId === companyId));
  }
}

/** Sabit kur listesi döndüren fake provider. */
export class FakeRateProvider implements RateProvider {
  constructor(private readonly rates: ReadonlyArray<DailyRate>) {}
  fetchRates(_startDate: string, _endDate: string): Promise<DailyRate[]> {
    return Promise.resolve([...this.rates]);
  }
}
