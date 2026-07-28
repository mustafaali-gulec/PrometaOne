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
  DailyLogEntryNotFoundError,
  DailyLogLockedError,
  DailyLogNotFoundError,
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
    err instanceof TrackingItemNotFoundError ||
    err instanceof DailyLogNotFoundError ||
    err instanceof DailyLogEntryNotFoundError
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
  if (err instanceof LocationInUseError || err instanceof DailyLogLockedError) {
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

  mapPostgresError(err);
  throw err;
}

/**
 * PostgreSQL kısıt hatalarını anlamlı HTTP koduna çevirir.
 *
 * Bunlar normalde use-case doğrulamasıyla önlenir; buradaki eşleme SAVUNMA
 * KATMANIDIR. Olmadığında istemci 500 görür ve "sunucu bozuk" sanır — oysa
 * gönderdiği veri geçersizdir. Canlı duman testinde kaza kaydının şiddetsiz
 * gönderilmesi tam olarak böyle 500'e düşüyordu.
 *
 * Yarış durumlarında (aynı anda iki kullanıcı aynı kodu ekler) bu katman tek
 * korumadır: ön-kontrol geçse bile UNIQUE ihlali burada 409'a döner.
 */
function mapPostgresError(err: unknown): void {
  if (typeof err !== 'object' || err === null) return;
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string') return;

  const detail = (err as { detail?: unknown }).detail;
  const constraint = (err as { constraint?: unknown }).constraint;
  const hint = typeof constraint === 'string' ? ` (${constraint})` : '';

  switch (code) {
    case '23514': // check_violation
      throw new HTTPException(400, {
        message: `Geçersiz veri — kayıt kuralı ihlal edildi${hint}`,
      });
    case '23503': // foreign_key_violation
      throw new HTTPException(400, {
        message: `Başvurulan kayıt bulunamadı${hint}`,
      });
    case '23505': // unique_violation
      throw new HTTPException(409, {
        message: `Bu kayıt zaten var${hint}`,
      });
    case '23502': // not_null_violation
      throw new HTTPException(400, {
        message: `Zorunlu alan boş bırakılamaz${typeof detail === 'string' ? '' : hint}`,
      });
    default:
      return;
  }
}
