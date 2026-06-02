/**
 * ExchangeRate — bir para biriminin belirli bir tarihteki TRY karşılığı kuru.
 *
 * exchange_rate_history (006) tablosuna karşılık gelir. Kur bir oran olduğu için
 * (Money değil) NUMERIC(12,6) ↔ number. 1 birim döviz = `rate` TRY.
 * TRY için kur kavramsal olarak 1'dir (saklanmaz).
 */
import type { Currency } from '../../../domain/valueObjects/Currency.js';
import { InvalidExchangeRateError } from '../errors/FxErrors.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ExchangeRateProps {
  currency: Currency;
  date: string; // YYYY-MM-DD
  rate: number;
  source: string;
}

export class ExchangeRate {
  private constructor(private readonly props: ExchangeRateProps) {}

  static create(props: ExchangeRateProps): ExchangeRate {
    if (!DATE_RE.test(props.date)) {
      throw new InvalidExchangeRateError(`tarih formatı YYYY-MM-DD olmalı: ${props.date}`);
    }
    if (!Number.isFinite(props.rate) || props.rate <= 0) {
      throw new InvalidExchangeRateError(`kur pozitif olmalı: ${props.rate}`);
    }
    return new ExchangeRate({ ...props });
  }

  get currency(): Currency {
    return this.props.currency;
  }
  get date(): string {
    return this.props.date;
  }
  get rate(): number {
    return this.props.rate;
  }
  get source(): string {
    return this.props.source;
  }

  toJSON(): ExchangeRateProps {
    return { ...this.props };
  }
}
