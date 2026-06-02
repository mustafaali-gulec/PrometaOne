/**
 * FX (döviz kuru + kur farkı) alt modülü domain hataları.
 * Finance `FinanceError` tabanından türer (tek HTTP mapping).
 */
import { FinanceError } from '../../../domain/errors/FinanceErrors.js';

export class InvalidExchangeRateError extends FinanceError {
  constructor(reason: string) {
    super(`Geçersiz döviz kuru: ${reason}`);
  }
}

export class RateNotAvailableError extends FinanceError {
  constructor(currency: string, date: string) {
    super(`${currency} için ${date} tarihinde (veya öncesinde) kur bulunamadı`);
  }
}

export class RevaluationNotFoundError extends FinanceError {
  constructor(id: number) {
    super(`Kur farkı değerlemesi bulunamadı: ${id}`);
  }
}

export class RevaluationAlreadyPostedError extends FinanceError {
  constructor(id: number) {
    super(`Kur farkı değerlemesi zaten muhasebeleşti: ${id}`);
  }
}

export class RateProviderError extends FinanceError {
  constructor(message: string) {
    super(`Kur sağlayıcı hatası: ${message}`);
  }
}
