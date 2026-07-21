/**
 * Purchasing domain hata → HTTP status mapping.
 *   404 — bulunamadı
 *   409 — çatışma (duplicate kod)
 *   400 — invariant / geçersiz statü geçişi / format
 * Bilinmeyen error'lar global handler → 500.
 */
import { HTTPException } from 'hono/http-exception';

import {
  AdoptConflictError,
  DuplicateVendorCodeError,
  InvalidStatusTransitionError,
  PurchaseOrderNotFoundError,
  PurchaseRequestNotFoundError,
  PurchasingValidationError,
  VendorNotFoundError,
} from '../domain/errors/PurchasingErrors.js';

export function mapPurchasingError(err: unknown): never {
  if (
    err instanceof VendorNotFoundError ||
    err instanceof PurchaseRequestNotFoundError ||
    err instanceof PurchaseOrderNotFoundError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  if (err instanceof DuplicateVendorCodeError || err instanceof AdoptConflictError) {
    throw new HTTPException(409, { message: err.message });
  }

  if (err instanceof InvalidStatusTransitionError || err instanceof PurchasingValidationError) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
