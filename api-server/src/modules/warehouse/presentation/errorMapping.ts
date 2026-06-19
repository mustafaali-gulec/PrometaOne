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
  AssignmentNotFoundError,
  DuplicateGroupCodeError,
  DuplicateMaterialCodeError,
  DuplicateUnitCodeError,
  DuplicateVariantCodeError,
  DuplicateWarehouseCodeError,
  EmptyItemsError,
  InsufficientStockError,
  InvalidAssignmentStatusError,
  InvalidCostMethodError,
  InvalidGroupStatusError,
  InvalidInventoryCountStatusError,
  InvalidMaterialRequestStatusError,
  InvalidMovementError,
  InvalidMovementKindError,
  InvalidNegativeControlError,
  InvalidQuantityError,
  InvalidTrackMethodError,
  InvalidVariantStatusError,
  InvalidWarehouseStatusError,
  InvalidWorkflowTransitionError,
  InventoryCountNotFoundError,
  MaterialGroupNotFoundError,
  MaterialHasMovementsError,
  MaterialNotFoundError,
  MaterialRequestNotFoundError,
  StockMovementNotFoundError,
  UnitNotFoundError,
  VariantNotFoundError,
  WarehouseHasMovementsError,
  WarehouseNotFoundError,
} from '../domain/errors/WarehouseErrors.js';

export function mapWarehouseError(err: unknown): never {
  if (
    err instanceof WarehouseNotFoundError ||
    err instanceof MaterialNotFoundError ||
    err instanceof StockMovementNotFoundError ||
    err instanceof MaterialGroupNotFoundError ||
    err instanceof UnitNotFoundError ||
    err instanceof VariantNotFoundError ||
    err instanceof MaterialRequestNotFoundError ||
    err instanceof InventoryCountNotFoundError ||
    err instanceof AssignmentNotFoundError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  if (
    err instanceof DuplicateWarehouseCodeError ||
    err instanceof DuplicateMaterialCodeError ||
    err instanceof DuplicateGroupCodeError ||
    err instanceof DuplicateUnitCodeError ||
    err instanceof DuplicateVariantCodeError ||
    err instanceof WarehouseHasMovementsError ||
    err instanceof MaterialHasMovementsError ||
    err instanceof InsufficientStockError ||
    err instanceof InvalidWorkflowTransitionError
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
    err instanceof InvalidMovementError ||
    err instanceof InvalidGroupStatusError ||
    err instanceof InvalidVariantStatusError ||
    err instanceof InvalidMaterialRequestStatusError ||
    err instanceof InvalidInventoryCountStatusError ||
    err instanceof InvalidAssignmentStatusError ||
    err instanceof EmptyItemsError
  ) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
