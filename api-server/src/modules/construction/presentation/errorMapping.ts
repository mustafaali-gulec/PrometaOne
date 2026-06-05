/**
 * Construction domain hata → HTTP status mapping.
 *   404 — bulunamadı
 *   409 — çatışma (duplicate kod/no)
 *   400 — invariant / geçersiz statü geçişi / format
 * Bilinmeyen error'lar global handler → 500.
 */
import { HTTPException } from 'hono/http-exception';

import {
  ContractNotFoundError,
  ConstructionValidationError,
  DuplicateContractNoError,
  DuplicateProjectCodeError,
  InvalidStatusTransitionError,
  ProjectNotFoundError,
} from '../domain/errors/ConstructionErrors.js';

export function mapConstructionError(err: unknown): never {
  if (err instanceof ProjectNotFoundError || err instanceof ContractNotFoundError) {
    throw new HTTPException(404, { message: err.message });
  }

  if (err instanceof DuplicateProjectCodeError || err instanceof DuplicateContractNoError) {
    throw new HTTPException(409, { message: err.message });
  }

  if (err instanceof InvalidStatusTransitionError || err instanceof ConstructionValidationError) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
