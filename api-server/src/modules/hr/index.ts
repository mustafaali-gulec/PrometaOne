/**
 * HR modülü — Public API (PR 1: domain + application iskeleti).
 *
 * PR 1 kapsamı:
 *  - OrgUnit + Department domain entity'leri ve value object'leri
 *  - OrgTreeBuilder domain service
 *  - Repository port'ları (concrete'ler PR 4'te)
 *  - DTO'lar ve error sınıfları
 *
 * Use-case'ler PR 2'de eklenecek; infrastructure PR 4'te; presentation PR 4'te.
 * Şu an `registerHrModule` export'u **YOK** — app.ts'e bağlanmıyoruz henüz.
 *
 * Karar dokümanı: docs/adr/0005-hr-manager-role-and-employee-user-link.md
 * Migration plan: docs/MIGRATION_ROADMAP.md § Faz 4 — HR Core (DETAYLI PLAN)
 */

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------
export { OrgUnit } from './domain/entities/OrgUnit.js';
export type { OrgUnitProps } from './domain/entities/OrgUnit.js';

export { Department } from './domain/entities/Department.js';
export type { DepartmentProps } from './domain/entities/Department.js';

export { OrgUnitCode, InvalidOrgUnitCodeError } from './domain/valueObjects/OrgUnitCode.js';
export {
  DepartmentCode,
  InvalidDepartmentCodeError,
} from './domain/valueObjects/DepartmentCode.js';

export { OrgTreeBuilder, OrgTreeCycleError } from './domain/services/OrgTreeBuilder.js';
export type { OrgUnitTreeNode } from './domain/services/OrgTreeBuilder.js';

// ---------------------------------------------------------------------------
// Application — ports
// ---------------------------------------------------------------------------
export { systemClock } from './application/ports/Clock.js';
export type { Clock } from './application/ports/Clock.js';

export type { AuditLogger, AuditEntry } from './application/ports/AuditLogger.js';
export type { OrgUnitRepository, NewOrgUnitInput } from './application/ports/OrgUnitRepository.js';
export type {
  DepartmentRepository,
  NewDepartmentInput,
} from './application/ports/DepartmentRepository.js';

// ---------------------------------------------------------------------------
// Application — DTO
// ---------------------------------------------------------------------------
export { toOrgUnitDto } from './application/dto/OrgUnitDto.js';
export type { OrgUnitDto } from './application/dto/OrgUnitDto.js';

export { toDepartmentDto } from './application/dto/DepartmentDto.js';
export type { DepartmentDto } from './application/dto/DepartmentDto.js';

export { toOrgTreeNodeDto } from './application/dto/OrgTreeNodeDto.js';
export type { OrgTreeNodeDto } from './application/dto/OrgTreeNodeDto.js';

// ---------------------------------------------------------------------------
// Application — errors
// ---------------------------------------------------------------------------
export {
  OrgUnitNotFoundError,
  OrgCycleDetectedError,
  OrgUnitHasChildrenError,
  OrgUnitCompanyMismatchError,
  DepartmentNotFoundError,
  DepartmentHasActiveEmployeesError,
  DepartmentCompanyMismatchError,
} from './application/errors/HrErrors.js';
