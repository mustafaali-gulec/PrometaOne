/**
 * Warehouse (Depo/Stok/Malzeme — WMS) domain/application error → HTTP status.
 *
 *  404 — bulunamadı
 *  409 — iş kuralı çatışması (duplicate kod, bağlı hareket, yetersiz stok)
 *  400 — domain invariant / geçersiz durum / geçersiz hareket / miktar
 *
 * Bilinmeyen error'lar global handler (middleware/error.ts) → 500.
 * (finance/production errorMapping.ts deseniyle aynı.)
 */
import { HTTPException } from 'hono/http-exception';

import {
  DuplicateMaterialCodeError,
  DuplicateWarehouseCodeError,
  InsufficientStockError,
  InvalidCostMethodError,
  InvalidMovementError,
  InvalidMovementKindError,
  InvalidNegativeControlError,
  InvalidQuantityError,
  InvalidTrackMethodError,
  InvalidWarehouseStatusError,
  MaterialHasMovementsError,
  MaterialNotFoundError,
  StockMovementNotFoundError,
  WarehouseHasMovementsError,
  WarehouseNotFoundError,
} from '../domain/errors/WarehouseErrors.js';

export function mapWarehouseError(err: unknown): never {
  if (
    err instanceof WarehouseNotFoundError ||
    err instanceof MaterialNotFoundError ||
    err instanceof StockMovementNotFoundError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  if (
    err instanceof DuplicateWarehouseCodeError ||
    err instanceof DuplicateMaterialCodeError ||
    err instanceof WarehouseHasMovementsError ||
    err instanceof MaterialHasMovementsError ||
    err instanceof InsufficientStockError
  ) {
    throw new HTTPException(409, { message: err.message });
  }

  if (
    err instanceof InvalidWarehouseStatusError ||
    err instanceof InvalidMovementKindError ||
    err instanceof InvalidTrackMethodError ||
    err instanceof InvalidCostMethodError ||
    err instanceof InvalidNegativeControlError ||
    err instanceof InvalidQuantityError ||
    err instanceof InvalidMovementError
  ) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
