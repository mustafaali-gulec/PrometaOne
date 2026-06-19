/**
 * Production (Üretim & MRP) domain/application error → HTTP status mapping.
 *
 *  404 — bulunamadı
 *  409 — iş kuralı çatışması (duplicate no/code)
 *  400 — domain invariant / geçersiz durum geçişi / döngü / MRP parametresi
 *
 * Bilinmeyen error'lar global handler (middleware/error.ts) → 500.
 */
import { HTTPException } from 'hono/http-exception';

import {
  BomCycleError,
  BomNotFoundError,
  DuplicateBomNoError,
  DuplicateProductionOrderNoError,
  DuplicateWorkCenterCodeError,
  InvalidBomError,
  InvalidMrpParamsError,
  InvalidOrderStatusTransitionError,
  InvalidProductionOrderError,
  InvalidWorkCenterError,
  ProductionOrderNotFoundError,
  WorkCenterNotFoundError,
} from '../domain/errors/ProductionErrors.js';

export function mapProductionError(err: unknown): never {
  if (
    err instanceof BomNotFoundError ||
    err instanceof WorkCenterNotFoundError ||
    err instanceof ProductionOrderNotFoundError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  if (
    err instanceof DuplicateBomNoError ||
    err instanceof DuplicateWorkCenterCodeError ||
    err instanceof DuplicateProductionOrderNoError
  ) {
    throw new HTTPException(409, { message: err.message });
  }

  if (
    err instanceof InvalidBomError ||
    err instanceof InvalidWorkCenterError ||
    err instanceof InvalidProductionOrderError ||
    err instanceof InvalidOrderStatusTransitionError ||
    err instanceof BomCycleError ||
    err instanceof InvalidMrpParamsError
  ) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
