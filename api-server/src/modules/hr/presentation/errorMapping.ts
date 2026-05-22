/**
 * HR domain/application error → HTTP status mapping.
 *
 * Presentation katmanı use-case'lerin fırlattığı tipli error'ları yakalayıp
 * Hono HTTPException'a çevirir. Hangi error hangi HTTP status'a düşer:
 *
 *  404 — bulunamadı (Not Found)
 *  400 — invariant ihlali, yasak transition
 *  409 — UNIQUE çakışması / iş kuralı çatışması
 *  403 — yetkisiz şirket
 *
 * Bilinmeyen error'lar global error handler (middleware/error.ts) tarafından
 * 500 olarak loglanır.
 */
import { HTTPException } from 'hono/http-exception';

import {
  ApplicationAlreadyTerminalError,
  ApplicationNotFoundError,
  CandidateAlreadyAppliedToPositionError,
  CandidateHasActiveApplicationsError,
  CandidateNotFoundError,
  DepartmentCompanyMismatchError,
  DepartmentHasActiveEmployeesError,
  DepartmentNotFoundError,
  EmployeeAlreadyLinkedError,
  EmployeeAlreadyTerminatedError,
  EmployeeCompanyMismatchError,
  EmployeeNotFoundError,
  EmployeeNumberAlreadyExistsError,
  OrgCycleDetectedError,
  OrgUnitCompanyMismatchError,
  OrgUnitHasChildrenError,
  OrgUnitNotFoundError,
  PositionCompanyMismatchError,
  PositionNotFoundError,
  PositionNotOpenError,
  UserAlreadyLinkedToEmployeeError,
  UserNotFoundForLinkError,
} from '../application/errors/HrErrors.js';
import { InvalidDepartmentCodeError } from '../domain/valueObjects/DepartmentCode.js';
import { InvalidEmployeeNumberError } from '../domain/valueObjects/EmployeeNumber.js';
import { InvalidEmployeeTransitionError } from '../domain/valueObjects/EmployeeStatus.js';
import { InvalidHireDateError } from '../domain/valueObjects/HireDate.js';
import { InvalidOrgUnitCodeError } from '../domain/valueObjects/OrgUnitCode.js';
import { InvalidPhoneNumberError } from '../domain/valueObjects/PhoneNumber.js';
import { InvalidPositionTransitionError } from '../domain/valueObjects/PositionStatus.js';
import { InvalidStageTransitionError } from '../domain/valueObjects/RecruitmentStage.js';
import { InvalidTcKimlikError } from '../domain/valueObjects/TcKimlik.js';

/**
 * Bilinen HR error'larını uygun HTTPException'a çevirir.
 * Bilinmeyen error'ları olduğu gibi geri fırlatır (global handler yakalar).
 */
export function mapHrError(err: unknown): never {
  // 404 Not Found
  if (
    err instanceof OrgUnitNotFoundError ||
    err instanceof DepartmentNotFoundError ||
    err instanceof PositionNotFoundError ||
    err instanceof EmployeeNotFoundError ||
    err instanceof CandidateNotFoundError ||
    err instanceof ApplicationNotFoundError ||
    err instanceof UserNotFoundForLinkError
  ) {
    throw new HTTPException(404, { message: err.message });
  }

  // 403 Forbidden — multi-tenant cross-company erişim
  if (
    err instanceof OrgUnitCompanyMismatchError ||
    err instanceof DepartmentCompanyMismatchError ||
    err instanceof PositionCompanyMismatchError ||
    err instanceof EmployeeCompanyMismatchError
  ) {
    throw new HTTPException(403, { message: err.message });
  }

  // 409 Conflict — iş kuralı çatışması / UNIQUE çakışması
  if (
    err instanceof OrgCycleDetectedError ||
    err instanceof OrgUnitHasChildrenError ||
    err instanceof DepartmentHasActiveEmployeesError ||
    err instanceof EmployeeNumberAlreadyExistsError ||
    err instanceof EmployeeAlreadyLinkedError ||
    err instanceof UserAlreadyLinkedToEmployeeError ||
    err instanceof EmployeeAlreadyTerminatedError ||
    err instanceof CandidateHasActiveApplicationsError ||
    err instanceof CandidateAlreadyAppliedToPositionError ||
    err instanceof PositionNotOpenError ||
    err instanceof ApplicationAlreadyTerminalError
  ) {
    throw new HTTPException(409, { message: err.message });
  }

  // 400 Bad Request — domain invariant / yasak transition / format hatası
  if (
    err instanceof InvalidEmployeeTransitionError ||
    err instanceof InvalidPositionTransitionError ||
    err instanceof InvalidStageTransitionError ||
    err instanceof InvalidOrgUnitCodeError ||
    err instanceof InvalidDepartmentCodeError ||
    err instanceof InvalidEmployeeNumberError ||
    err instanceof InvalidTcKimlikError ||
    err instanceof InvalidPhoneNumberError ||
    err instanceof InvalidHireDateError
  ) {
    throw new HTTPException(400, { message: err.message });
  }

  // Bilinmeyen — global handler yakalar
  throw err;
}
