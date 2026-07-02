/**
 * Performans domain hata → HTTP status mapping.
 *   400 — invariant / geçersiz format
 * Bilinmeyen error'lar global handler → 500.
 */
import { HTTPException } from 'hono/http-exception';

import { PerformanceValidationError } from '../domain/errors/PerformanceErrors.js';

export function mapPerformanceError(err: unknown): never {
  if (err instanceof PerformanceValidationError) {
    throw new HTTPException(400, { message: err.message });
  }

  throw err;
}
