/**
 * Global error handler.
 * Hono'nun onError'una bağlanır.
 */
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

import { config } from '../config.js';

interface PgError {
  code: string;
  constraint?: string;
}

function isPgError(err: unknown): err is PgError {
  return typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string';
}

export function errorHandler(err: Error, c: Context): Response {
  // HTTP exceptions (kontrollü hatalar)
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        message: err.message,
        details: err.cause ?? undefined,
      },
      err.status,
    );
  }

  // Validation hataları
  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Veri doğrulama hatası',
        details: err.flatten().fieldErrors,
      },
      400,
    );
  }

  // Postgres hataları
  if (isPgError(err)) {
    if (err.code === '23505') {
      return c.json(
        {
          error: 'duplicate',
          message: 'Bu kayıt zaten mevcut',
          details: { constraint: err.constraint },
        },
        409,
      );
    }
    if (err.code === '23503') {
      return c.json(
        {
          error: 'foreign_key_violation',
          message: 'İlişkili kayıt bulunamadı',
        },
        400,
      );
    }
    if (err.code === '23514') {
      return c.json(
        {
          error: 'check_violation',
          message: 'Veri kısıtlamaları ihlal edildi',
          details: { constraint: err.constraint },
        },
        400,
      );
    }
  }

  // Beklenmedik hata
  console.error('Beklenmedik hata:', err);
  return c.json(
    {
      error: 'internal_error',
      message: config.isDevelopment ? err.message : 'Sunucu hatası',
      ...(config.isDevelopment && err.stack ? { stack: err.stack.split('\n') } : {}),
    },
    500,
  );
}
