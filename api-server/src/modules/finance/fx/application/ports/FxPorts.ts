/**
 * FX alt modülü portları: kur sağlayıcı + kur/değerleme repository'leri.
 * Concrete: infrastructure/rates/TcmbRateProvider + persistence (PR 6).
 */
import type { Currency } from '../../../domain/valueObjects/Currency.js';
import type { ExchangeRate } from '../../domain/entities/ExchangeRate.js';
import type { Revaluation } from '../../domain/entities/Revaluation.js';

/** Bir günün tek para birimi kuru (provider çıktısı). */
export interface DailyRate {
  date: string; // YYYY-MM-DD
  currency: Currency;
  rate: number;
}

/** Dış kur kaynağı (TCMB/EVDS). */
export interface RateProvider {
  /** [startDate, endDate] (YYYY-MM-DD) aralığındaki USD/EUR kurları. */
  fetchRates(startDate: string, endDate: string): Promise<DailyRate[]>;
}

export interface ExchangeRateRepository {
  upsert(rate: ExchangeRate): Promise<void>;
  /** En güncel kur (currency için). */
  getCurrent(currency: Currency): Promise<ExchangeRate | null>;
  /** `date` tarihindeki (yoksa önceki en yakın) kur. */
  getAt(currency: Currency, date: string): Promise<ExchangeRate | null>;
}

export interface RevaluationRepository {
  insert(revaluation: Revaluation): Promise<Revaluation>;
  update(revaluation: Revaluation): Promise<void>;
  findById(id: number, companyId: number): Promise<Revaluation | null>;
  listByCompany(companyId: number): Promise<ReadonlyArray<Revaluation>>;
}
