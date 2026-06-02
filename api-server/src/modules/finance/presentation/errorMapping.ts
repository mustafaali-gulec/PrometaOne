/**
 * Finance domain/application error → HTTP status mapping.
 *
 *  404 — bulunamadı
 *  409 — iş kuralı çatışması (duplicate, already committed)
 *  400 — domain invariant / format / commit edilemez
 *
 * Bilinmeyen error'lar global handler (middleware/error.ts) → 500.
 */
import { HTTPException } from 'hono/http-exception';

import {
  AlreadyCommittedError,
  BankAccountNotFoundError,
  CategoryNotFoundError,
  CommitNotApplicableError,
  CurrencyMismatchError,
  DuplicateCategoryNameError,
  InvalidAllocationError,
  InvalidCurrencyError,
  InvalidFiscalYearError,
  InvalidKdvRateError,
  InvalidMoneyError,
  InvalidMonthIndexError,
  InvoiceNotFoundError,
  InvoicePaymentNotFoundError,
  KasaAccountNotFoundError,
  KasaEntryNotFoundError,
  TransferEndpointNotFoundError,
  TransferNotFoundError,
} from '../domain/errors/FinanceErrors.js';

export function mapFinanceError(err: unknown): never {
  if (
    err instanceof CategoryNotFoundError ||
    err instanceof BankAccountNotFoundError ||
    err instanceof KasaAccountNotFoundError ||
    err instanceof KasaEntryNotFoundError ||
    err instanceof TransferNotFoundError ||
    err instanceof TransferEndpointNotFoundError ||
    err instanceof InvoiceNotFoundError ||
    err instanceof InvoicePaymentNotFoundError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  if (err instanceof DuplicateCategoryNameError || err instanceof AlreadyCommittedError) {
    throw new HTTPException(409, { message: err.message });
  }

  if (
    err instanceof CommitNotApplicableError ||
    err instanceof InvalidCurrencyError ||
    err instanceof CurrencyMismatchError ||
    err instanceof InvalidMoneyError ||
    err instanceof InvalidKdvRateError ||
    err instanceof InvalidFiscalYearError ||
    err instanceof InvalidMonthIndexError ||
    err instanceof InvalidAllocationError
  ) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
