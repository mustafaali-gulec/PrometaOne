/**
 * Sabit Kıymet domain hata → HTTP status mapping.
 *   400 — invariant / geçersiz format
 * Bilinmeyen error'lar global handler → 500.
 */
import { HTTPException } from 'hono/http-exception';

import { FixedAssetValidationError } from '../domain/errors/FixedAssetErrors.js';

export function mapFixedAssetError(err: unknown): never {
  if (err instanceof FixedAssetValidationError) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
