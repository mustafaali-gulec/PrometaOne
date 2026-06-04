/**
 * Access domain/application error → HTTP status mapping.
 *
 *  404 — bulunamadı (Not Found)
 *  409 — UNIQUE çakışması (rol adı)
 *  400 — geçersiz izin / invariant ihlali
 *
 * Bilinmeyen error'lar global error handler (middleware/error.ts) tarafından
 * 500 olarak loglanır.
 */
import { HTTPException } from 'hono/http-exception';

import {
  CustomRoleNotFoundError,
  DuplicateRoleNameError,
  InvalidPermissionInputError,
  OverrideNotFoundError,
  RoleGrantNotFoundError,
} from '../application/errors/AccessErrors.js';
import { InvalidPermissionError } from '../domain/valueObjects/Permission.js';

/**
 * Bilinen access error'larını uygun HTTPException'a çevirir.
 * Bilinmeyen error'ları olduğu gibi geri fırlatır (global handler yakalar).
 */
export function mapAccessError(err: unknown): never {
  // 404 Not Found
  if (
    err instanceof CustomRoleNotFoundError ||
    err instanceof RoleGrantNotFoundError ||
    err instanceof OverrideNotFoundError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  // 409 Conflict — UNIQUE çakışması
  if (err instanceof DuplicateRoleNameError) {
    throw new HTTPException(409, { message: err.message });
  }

  // 400 Bad Request — geçersiz izin / invariant
  if (err instanceof InvalidPermissionError || err instanceof InvalidPermissionInputError) {
    throw new HTTPException(400, { message: err.message });
  }

  // Bilinmeyen — global handler yakalar
  throw err;
}
