/**
 * Gider/Masraf domain hata → HTTP status mapping.
 *   404 — bulunamadı
 *   409 — çatışma (duplicate kod)
 *   400 — invariant / geçersiz format
 * Bilinmeyen error'lar global handler → 500.
 */
import { HTTPException } from 'hono/http-exception';

import {
  DuplicateExpenseCardCodeError,
  ExpenseCardNotFoundError,
  ExpenseValidationError,
} from '../domain/errors/ExpenseErrors.js';

export function mapExpenseError(err: unknown): never {
  if (err instanceof ExpenseCardNotFoundError) {
    throw new HTTPException(404, { message: err.message });
  }

  if (err instanceof DuplicateExpenseCardCodeError) {
    throw new HTTPException(409, { message: err.message });
  }

  if (err instanceof ExpenseValidationError) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
