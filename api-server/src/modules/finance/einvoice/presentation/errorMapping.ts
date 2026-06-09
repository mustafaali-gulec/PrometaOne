/**
 * E-Fatura + FX error → HTTP status mapping. Finance error'larına fallback.
 */
import { HTTPException } from 'hono/http-exception';

import {
  InvalidExchangeRateError,
  RateNotAvailableError,
  RateProviderError,
  RevaluationAlreadyPostedError,
  RevaluationNotFoundError,
} from '../../fx/domain/errors/FxErrors.js';
import { mapFinanceError } from '../../presentation/errorMapping.js';
import {
  EInvoiceAlreadyImportedError,
  EInvoiceCredentialNotFoundError,
  EInvoiceNotFoundError,
  GibHtmlParseError,
  InvalidEttnError,
  InvalidProviderTypeError,
  InvalidVknError,
  ProviderAuthError,
  ProviderFetchError,
  ProviderInvoiceNotFoundError,
  UblParseError,
  UnsupportedEInvoiceFileError,
} from '../domain/errors/EInvoiceErrors.js';

export function mapEInvoiceError(err: unknown): never {
  if (
    err instanceof EInvoiceNotFoundError ||
    err instanceof EInvoiceCredentialNotFoundError ||
    err instanceof ProviderInvoiceNotFoundError ||
    err instanceof RevaluationNotFoundError ||
    err instanceof RateNotAvailableError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  if (err instanceof EInvoiceAlreadyImportedError || err instanceof RevaluationAlreadyPostedError) {
    throw new HTTPException(409, { message: err.message });
  }

  if (
    err instanceof InvalidVknError ||
    err instanceof InvalidEttnError ||
    err instanceof InvalidProviderTypeError ||
    err instanceof UblParseError ||
    err instanceof GibHtmlParseError ||
    err instanceof UnsupportedEInvoiceFileError ||
    err instanceof InvalidExchangeRateError
  ) {
    throw new HTTPException(400, { message: err.message });
  }

  if (
    err instanceof ProviderAuthError ||
    err instanceof ProviderFetchError ||
    err instanceof RateProviderError
  ) {
    // Dış sistem hatası — 502 Bad Gateway
    throw new HTTPException(502, { message: err.message });
  }

  // Finance error'ları (import sırasında Invoice.create vb.) → finance mapping
  mapFinanceError(err);
}
