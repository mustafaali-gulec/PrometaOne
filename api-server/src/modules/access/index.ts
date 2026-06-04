/**
 * Access (RBAC / Özel Roller) modülü — Public API + DI composition.
 *
 * Faz B-4: özel rol tanımları + rol atamaları (grant) + izin override'ları +
 * yetki çözümü (PermissionResolver) ve effective-permissions endpoint'i.
 *
 * `registerAccessModule(deps)` PG persistence + paylaşılan audit_logs + REST
 * router'ı kurar. app bootstrap içinden çağrılır:
 *   const access = registerAccessModule({ pool });
 *   v1.route('/access', access.router);
 */

// ---------------------------------------------------------------------------
// Domain — catalog
// ---------------------------------------------------------------------------
export {
  ACTIONS,
  RESOURCES,
  isKnownResource,
  isAllowedAction,
} from './domain/catalog/Resources.js';
export type { Action, ResourceDef } from './domain/catalog/Resources.js';

// ---------------------------------------------------------------------------
// Domain — value objects
// ---------------------------------------------------------------------------
export {
  InvalidPermissionError,
  parsePermission,
  splitPermission,
  isValidPermission,
  allCatalogPermissions,
} from './domain/valueObjects/Permission.js';
export type { ParsedPermission } from './domain/valueObjects/Permission.js';
export { ALL_SUBJECT_TYPES, isSubjectType } from './domain/valueObjects/SubjectType.js';
export type { SubjectType } from './domain/valueObjects/SubjectType.js';

// ---------------------------------------------------------------------------
// Domain — entities
// ---------------------------------------------------------------------------
export { CustomRole } from './domain/entities/CustomRole.js';
export type { CustomRoleProps } from './domain/entities/CustomRole.js';
export { RoleGrant } from './domain/entities/RoleGrant.js';
export type { RoleGrantProps } from './domain/entities/RoleGrant.js';
export { PermissionOverride } from './domain/entities/PermissionOverride.js';
export type { PermissionOverrideProps } from './domain/entities/PermissionOverride.js';

// ---------------------------------------------------------------------------
// Domain — services (PermissionResolver)
// ---------------------------------------------------------------------------
export {
  resolvePermission,
  resolveEffectivePermissions,
  grantAppliesToUser,
  isDescendantDepartment,
  isDescendantOrgUnit,
} from './domain/services/PermissionResolver.js';
export type {
  ResolverSession,
  UserScope,
  OrgUnitNode,
  DepartmentNode,
  ResolverGrant,
  ResolverCustomRole,
  ResolverOverride,
  ResolverContext,
} from './domain/services/PermissionResolver.js';

// ---------------------------------------------------------------------------
// Application — ports
// ---------------------------------------------------------------------------
export { systemClock } from './application/ports/Clock.js';
export type { Clock } from './application/ports/Clock.js';
export type { AuditLogger, AuditEntry } from './application/ports/AuditLogger.js';
export type {
  AccessRepository,
  NewCustomRoleInput,
  NewRoleGrantInput,
  NewPermissionOverrideInput,
} from './application/ports/AccessRepository.js';

// ---------------------------------------------------------------------------
// Application — DTO
// ---------------------------------------------------------------------------
export { toCustomRoleDto } from './application/dto/CustomRoleDto.js';
export type { CustomRoleDto } from './application/dto/CustomRoleDto.js';
export { toRoleGrantDto } from './application/dto/RoleGrantDto.js';
export type { RoleGrantDto } from './application/dto/RoleGrantDto.js';
export { toPermissionOverrideDto } from './application/dto/PermissionOverrideDto.js';
export type { PermissionOverrideDto } from './application/dto/PermissionOverrideDto.js';
export type { EffectivePermissionsDto } from './application/dto/EffectivePermissionsDto.js';

// ---------------------------------------------------------------------------
// Application — errors
// ---------------------------------------------------------------------------
export {
  CustomRoleNotFoundError,
  DuplicateRoleNameError,
  RoleGrantNotFoundError,
  OverrideNotFoundError,
  InvalidPermissionInputError,
} from './application/errors/AccessErrors.js';

// ---------------------------------------------------------------------------
// Application — use-cases
// ---------------------------------------------------------------------------
export { CreateCustomRoleUseCase } from './application/useCases/CreateCustomRoleUseCase.js';
export type { CreateCustomRoleInput } from './application/useCases/CreateCustomRoleUseCase.js';
export { UpdateCustomRoleUseCase } from './application/useCases/UpdateCustomRoleUseCase.js';
export type { UpdateCustomRoleInput } from './application/useCases/UpdateCustomRoleUseCase.js';
export { DeleteCustomRoleUseCase } from './application/useCases/DeleteCustomRoleUseCase.js';
export type { DeleteCustomRoleInput } from './application/useCases/DeleteCustomRoleUseCase.js';
export { ListCustomRolesUseCase } from './application/useCases/ListCustomRolesUseCase.js';
export type { ListCustomRolesInput } from './application/useCases/ListCustomRolesUseCase.js';
export { CreateRoleGrantUseCase } from './application/useCases/CreateRoleGrantUseCase.js';
export type { CreateRoleGrantInput } from './application/useCases/CreateRoleGrantUseCase.js';
export { DeleteRoleGrantUseCase } from './application/useCases/DeleteRoleGrantUseCase.js';
export type { DeleteRoleGrantInput } from './application/useCases/DeleteRoleGrantUseCase.js';
export { ListRoleGrantsUseCase } from './application/useCases/ListRoleGrantsUseCase.js';
export type { ListRoleGrantsInput } from './application/useCases/ListRoleGrantsUseCase.js';
export { SetPermissionOverrideUseCase } from './application/useCases/SetPermissionOverrideUseCase.js';
export type { SetPermissionOverrideInput } from './application/useCases/SetPermissionOverrideUseCase.js';
export { DeletePermissionOverrideUseCase } from './application/useCases/DeletePermissionOverrideUseCase.js';
export type { DeletePermissionOverrideInput } from './application/useCases/DeletePermissionOverrideUseCase.js';
export { ListPermissionOverridesUseCase } from './application/useCases/ListPermissionOverridesUseCase.js';
export type { ListPermissionOverridesInput } from './application/useCases/ListPermissionOverridesUseCase.js';
export { ResolvePermissionsUseCase } from './application/useCases/ResolvePermissionsUseCase.js';
export type { ResolvePermissionsInput } from './application/useCases/ResolvePermissionsUseCase.js';

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------
export { PgAccessRepository } from './infrastructure/persistence/PgAccessRepository.js';
export { PgOrgStructureReader } from './infrastructure/persistence/PgOrgStructureReader.js';
export type { OrgStructureReader } from './application/ports/OrgStructureReader.js';
export { PgAuditLogger } from './infrastructure/audit/PgAuditLogger.js';
export type { Queryable } from './infrastructure/persistence/Queryable.js';

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------
export { createAccessRouter } from './presentation/routes.js';
export type { AccessRouterDeps } from './presentation/routes.js';
export { mapAccessError } from './presentation/errorMapping.js';

// ===========================================================================
// DI Composition — registerAccessModule
// ===========================================================================
import type { Hono } from 'hono';
import type { Pool } from 'pg';

import { systemClock as _systemClock } from './application/ports/Clock.js';
import { CreateCustomRoleUseCase as _CreateCustomRoleUseCase } from './application/useCases/CreateCustomRoleUseCase.js';
import { CreateRoleGrantUseCase as _CreateRoleGrantUseCase } from './application/useCases/CreateRoleGrantUseCase.js';
import { DeleteCustomRoleUseCase as _DeleteCustomRoleUseCase } from './application/useCases/DeleteCustomRoleUseCase.js';
import { DeletePermissionOverrideUseCase as _DeletePermissionOverrideUseCase } from './application/useCases/DeletePermissionOverrideUseCase.js';
import { DeleteRoleGrantUseCase as _DeleteRoleGrantUseCase } from './application/useCases/DeleteRoleGrantUseCase.js';
import { ListCustomRolesUseCase as _ListCustomRolesUseCase } from './application/useCases/ListCustomRolesUseCase.js';
import { ListPermissionOverridesUseCase as _ListPermissionOverridesUseCase } from './application/useCases/ListPermissionOverridesUseCase.js';
import { ListRoleGrantsUseCase as _ListRoleGrantsUseCase } from './application/useCases/ListRoleGrantsUseCase.js';
import { ResolvePermissionsUseCase as _ResolvePermissionsUseCase } from './application/useCases/ResolvePermissionsUseCase.js';
import { SetPermissionOverrideUseCase as _SetPermissionOverrideUseCase } from './application/useCases/SetPermissionOverrideUseCase.js';
import { UpdateCustomRoleUseCase as _UpdateCustomRoleUseCase } from './application/useCases/UpdateCustomRoleUseCase.js';
import { PgAuditLogger as _PgAuditLogger } from './infrastructure/audit/PgAuditLogger.js';
import { PgAccessRepository as _PgAccessRepository } from './infrastructure/persistence/PgAccessRepository.js';
import { PgOrgStructureReader as _PgOrgStructureReader } from './infrastructure/persistence/PgOrgStructureReader.js';
import { createAccessRouter as _createAccessRouter } from './presentation/routes.js';

export interface AccessModuleDeps {
  pool: Pool;
}

export interface RegisteredAccessModule {
  router: Hono;
}

/**
 * Access modülünü PostgreSQL persistence + REST router'ı ile birlikte hazırlar.
 *
 * Kullanım (app bootstrap'ta):
 *   const access = registerAccessModule({ pool });
 *   v1.route('/access', access.router);
 */
export function registerAccessModule(deps: AccessModuleDeps): RegisteredAccessModule {
  const repo = new _PgAccessRepository(deps.pool);
  const audit = new _PgAuditLogger(deps.pool);
  const clock = _systemClock;

  const createCustomRole = new _CreateCustomRoleUseCase(repo, clock, audit);
  const updateCustomRole = new _UpdateCustomRoleUseCase(repo, clock, audit);
  const deleteCustomRole = new _DeleteCustomRoleUseCase(repo, clock, audit);
  const listCustomRoles = new _ListCustomRolesUseCase(repo);

  const createRoleGrant = new _CreateRoleGrantUseCase(repo, clock, audit);
  const deleteRoleGrant = new _DeleteRoleGrantUseCase(repo, clock, audit);
  const listRoleGrants = new _ListRoleGrantsUseCase(repo);

  const setPermissionOverride = new _SetPermissionOverrideUseCase(repo, clock, audit);
  const deletePermissionOverride = new _DeletePermissionOverrideUseCase(repo, clock, audit);
  const listPermissionOverrides = new _ListPermissionOverridesUseCase(repo);

  const resolvePermissions = new _ResolvePermissionsUseCase(repo, clock);
  const orgStructureReader = new _PgOrgStructureReader(deps.pool);

  const router = _createAccessRouter({
    createCustomRole,
    updateCustomRole,
    deleteCustomRole,
    listCustomRoles,
    createRoleGrant,
    deleteRoleGrant,
    listRoleGrants,
    setPermissionOverride,
    deletePermissionOverride,
    listPermissionOverrides,
    resolvePermissions,
    orgStructureReader,
  });

  return { router };
}
