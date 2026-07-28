/**
 * Construction domain hata → HTTP status mapping.
 *   404 — bulunamadı
 *   409 — çatışma (duplicate kod/no)
 *   400 — invariant / geçersiz statü geçişi / format
 * Bilinmeyen error'lar global handler → 500.
 */
import { HTTPException } from 'hono/http-exception';

import {
  AdvanceNotFoundError,
  AttachmentNotFoundError,
  CashMovementNotFoundError,
  ContractNotFoundError,
  ConstructionValidationError,
  DuplicateContractNoError,
  DuplicateLocationCodeError,
  DuplicateMachineCodeError,
  DuplicateMaterialCodeError,
  DuplicatePozError,
  DuplicateProgressTemplateCodeError,
  DuplicateProjectCodeError,
  DuplicateTrackingCodeError,
  DuplicateWarehouseCodeError,
  ExpenseNotFoundError,
  InvalidLocationNestingError,
  InvalidStatusTransitionError,
  InvalidTrackingScopeError,
  LocationInUseError,
  LocationNotFoundError,
  MachineNotFoundError,
  MaterialNotFoundError,
  MaterialRequestNotEditableError,
  MaterialRequestNotFoundError,
  MeasurementNotFoundError,
  PaymentNotFoundError,
  PersonnelNotFoundError,
  PozNotFoundError,
  ProgressNotEditableError,
  ProgressNotFoundError,
  ProgressTemplateNotFoundError,
  ProjectNotFoundError,
  TimesheetNotFoundError,
  TrackingItemNotFoundError,
  TrackingNotActiveError,
  TrackingNotFoundError,
  WarehouseNotFoundError,
} from '../domain/errors/ConstructionErrors.js';

export function mapConstructionError(err: unknown): never {
  if (
    err instanceof ProjectNotFoundError ||
    err instanceof ContractNotFoundError ||
    err instanceof PozNotFoundError ||
    err instanceof ProgressNotFoundError ||
    err instanceof ExpenseNotFoundError ||
    err instanceof AdvanceNotFoundError ||
    err instanceof CashMovementNotFoundError ||
    err instanceof PaymentNotFoundError ||
    err instanceof MaterialNotFoundError ||
    err instanceof WarehouseNotFoundError ||
    err instanceof MaterialRequestNotFoundError ||
    err instanceof PersonnelNotFoundError ||
    err instanceof MachineNotFoundError ||
    err instanceof TimesheetNotFoundError ||
    err instanceof MeasurementNotFoundError ||
    err instanceof AttachmentNotFoundError ||
    err instanceof LocationNotFoundError ||
    err instanceof ProgressTemplateNotFoundError ||
    err instanceof TrackingNotFoundError ||
    err instanceof TrackingItemNotFoundError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  if (
    err instanceof DuplicateProjectCodeError ||
    err instanceof DuplicateContractNoError ||
    err instanceof DuplicatePozError ||
    err instanceof DuplicateMaterialCodeError ||
    err instanceof DuplicateWarehouseCodeError ||
    err instanceof DuplicateMachineCodeError ||
    err instanceof DuplicateLocationCodeError ||
    err instanceof DuplicateProgressTemplateCodeError ||
    err instanceof DuplicateTrackingCodeError
  ) {
    throw new HTTPException(409, { message: err.message });
  }

  // Bağlı kayıt yüzünden silinemeyen lokasyon bir çatışmadır (409), geçersiz
  // istek değil: istemci önce bağlı kayıtları taşımalı/temizlemeli.
  if (err instanceof LocationInUseError) {
    throw new HTTPException(409, { message: err.message });
  }

  if (
    err instanceof InvalidStatusTransitionError ||
    err instanceof ConstructionValidationError ||
    err instanceof ProgressNotEditableError ||
    err instanceof MaterialRequestNotEditableError ||
    err instanceof InvalidLocationNestingError ||
    err instanceof InvalidTrackingScopeError ||
    err instanceof TrackingNotActiveError
  ) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
