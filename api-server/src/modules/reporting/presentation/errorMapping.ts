/**
 * Reporting domain/application error → HTTP status.
 *   400 — güvenlik reddi / geçersiz parametre / geçersiz tanım / timeout / SQL hatası
 *   404 — bulunamadı
 *   409 — ad çakışması
 * Bilinmeyen error'lar global handler (middleware/error.ts) → 500.
 */
import { HTTPException } from 'hono/http-exception';

import type { ReportingError } from '../domain/errors/ReportingErrors.js';
import {
  DuplicateReportNameError,
  InvalidParamError,
  InvalidQuerySpecError,
  InvalidReportDefinitionError,
  MissingParamError,
  QueryTimeoutError,
  ReportDefinitionNotFoundError,
  ReportFolderNotFoundError,
  SqlExecutionError,
  SqlNotAllowedError,
  UnknownIdentifierError,
} from '../domain/errors/ReportingErrors.js';

export function mapReportingError(err: unknown): never {
  if (err instanceof ReportDefinitionNotFoundError || err instanceof ReportFolderNotFoundError) {
    throw new HTTPException(404, { message: err.message });
  }

  if (err instanceof DuplicateReportNameError) {
    throw new HTTPException(409, { message: err.message });
  }

  if (
    err instanceof SqlNotAllowedError ||
    err instanceof InvalidParamError ||
    err instanceof MissingParamError ||
    err instanceof InvalidQuerySpecError ||
    err instanceof InvalidReportDefinitionError ||
    err instanceof UnknownIdentifierError ||
    err instanceof QueryTimeoutError ||
    err instanceof SqlExecutionError
  ) {
    // code alanını cause ile taşı → frontend hatayı sınıflayabilir.
    throw new HTTPException(400, {
      message: err.message,
      cause: { code: (err as ReportingError).code },
    });
  }

  throw err;
}
