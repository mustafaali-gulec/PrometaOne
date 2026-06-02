/**
 * PgExchangeRateRepository — exchange_rate_history (006). PK (date, currency).
 */
import type { Currency } from '../../../domain/valueObjects/Currency.js';
import type { Queryable } from '../../../infrastructure/persistence/Queryable.js';
import type { ExchangeRateRepository } from '../../application/ports/FxPorts.js';
import { ExchangeRate } from '../../domain/entities/ExchangeRate.js';

interface RateRow {
  date: string;
  currency: string;
  rate: string;
  source: string;
}

export class PgExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly db: Queryable) {}

  async upsert(rate: ExchangeRate): Promise<void> {
    await this.db.query(
      `INSERT INTO exchange_rate_history (date, currency, rate, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (date, currency) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = NOW()`,
      [rate.date, rate.currency, rate.rate, rate.source],
    );
  }

  async getCurrent(currency: Currency): Promise<ExchangeRate | null> {
    const r = await this.db.query<RateRow>(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date, currency, rate, source
         FROM exchange_rate_history WHERE currency = $1 ORDER BY date DESC LIMIT 1`,
      [currency],
    );
    const row = r.rows[0];
    return row ? rowToRate(row) : null;
  }

  async getAt(currency: Currency, date: string): Promise<ExchangeRate | null> {
    const r = await this.db.query<RateRow>(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date, currency, rate, source
         FROM exchange_rate_history WHERE currency = $1 AND date <= $2
        ORDER BY date DESC LIMIT 1`,
      [currency, date],
    );
    const row = r.rows[0];
    return row ? rowToRate(row) : null;
  }
}

function rowToRate(row: RateRow): ExchangeRate {
  return ExchangeRate.create({
    currency: row.currency as Currency,
    date: row.date,
    rate: Number(row.rate),
    source: row.source,
  });
}
