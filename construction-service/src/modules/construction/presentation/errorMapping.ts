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
  CashMovementNotFoundError,
  ContractNotFoundError,
  ConstructionValidationError,
  DuplicateContractNoError,
  DuplicateMachineCodeError,
  DuplicateMaterialCodeError,
  DuplicatePozError,
  DuplicateProjectCodeError,
  DuplicateWarehouseCodeError,
  ExpenseNotFoundError,
  InvalidStatusTransitionError,
  MachineNotFoundError,
  MaterialNotFoundError,
  MaterialRequestNotEditableError,
  MaterialRequestNotFoundError,
  PaymentNotFoundError,
  PersonnelNotFoundError,
  PozNotFoundError,
  ProgressNotEditableError,
  ProgressNotFoundError,
  ProjectNotFoundError,
  TimesheetNotFoundError,
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
    err instanceof TimesheetNotFoundError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  if (
    err instanceof DuplicateProjectCodeError ||
    err instanceof DuplicateContractNoError ||
    err instanceof DuplicatePozError ||
    err instanceof DuplicateMaterialCodeError ||
    err instanceof DuplicateWarehouseCodeError ||
    err instanceof DuplicateMachineCodeError
  ) {
    throw new HTTPException(409, { message: err.message });
  }

  if (
    err instanceof InvalidStatusTransitionError ||
    err instanceof ConstructionValidationError ||
    err instanceof ProgressNotEditableError ||
    err instanceof MaterialRequestNotEditableError
  ) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
