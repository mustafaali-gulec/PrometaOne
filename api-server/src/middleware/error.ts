/**
 * Global error handler.
 * Hono'nun onError'una bağlanır.
 */
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { config } from "../config.js";

export function errorHandler(err: Error, c: Context): Response {
  // HTTP exceptions (kontrollü hatalar)
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        message: err.message,
        details: (err.cause as any) ?? undefined,
      },
      err.status
    );
  }

  // Validation hataları
  if (err instanceof ZodError) {
    return c.json(
      {
        error: "validation_error",
        message: "Veri doğrulama hatası",
        details: err.flatten().fieldErrors,
      },
      400
    );
  }

  // Postgres hataları
  if ("code" in err && typeof err.code === "string") {
    const pgErr = err as any;
    if (pgErr.code === "23505") {
      return c.json({
        error: "duplicate",
        message: "Bu kayıt zaten mevcut",
        details: { constraint: pgErr.constraint }
      }, 409);
    }
    if (pgErr.code === "23503") {
      return c.json({
        error: "foreign_key_violation",
        message: "İlişkili kayıt bulunamadı",
      }, 400);
    }
    if (pgErr.code === "23514") {
      return c.json({
        error: "check_violation",
        message: "Veri kısıtlamaları ihlal edildi",
        details: { constraint: pgErr.constraint }
      }, 400);
    }
  }

  // Beklenmedik hata
  console.error("Beklenmedik hata:", err);
  return c.json(
    {
      error: "internal_error",
      message: config.isDevelopment ? err.message : "Sunucu hatası",
      ...(config.isDevelopment && err.stack ? { stack: err.stack.split("\n") } : {}),
    },
    500
  );
}
