/**
 * Access (RBAC / Özel Roller) frontend modülü — Public API.
 *
 * Faz B-4: özel rol yönetimi + izin kataloğu (modüle göre gruplu).
 */

// ---------------------------------------------------------------------------
// DTO tipleri
// ---------------------------------------------------------------------------
export type {
  AccessAction,
  SubjectType,
  CatalogResource,
  CatalogResponse,
  CustomRoleDto,
  RolesResponse,
  RoleGrantDto,
  GrantsResponse,
  PermissionOverrideDto,
  OverridesResponse,
  EffectivePermissionsDto,
} from './application/dto/AccessDtos';

// ---------------------------------------------------------------------------
// Application — ports
// ---------------------------------------------------------------------------
export type {
  AccessApi,
  CreateRoleBody,
  UpdateRoleBody,
  CreateGrantBody,
  SetOverrideBody,
} from './application/ports/AccessApi';
export type { AuthTokenProvider } from './application/ports/AuthTokenProvider';
export { StaticAuthTokenProvider } from './application/ports/AuthTokenProvider';

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------
export { AccessApiClient } from './infrastructure/api/AccessApiClient';
export {
  LocalStorageAuthTokenProvider,
  createTokenRefresher,
  hasRefreshToken,
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
} from './infrastructure/auth/RefreshingAuthTokenProvider';
export type { RefreshFn } from './infrastructure/auth/RefreshingAuthTokenProvider';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export { useCustomRoles } from './presentation/hooks/useCustomRoles';
export type {
  UseCustomRolesOptions,
  UseCustomRolesResult,
} from './presentation/hooks/useCustomRoles';
export { useRoleGrants } from './presentation/hooks/useRoleGrants';
export type { UseRoleGrantsOptions, UseRoleGrantsResult } from './presentation/hooks/useRoleGrants';
export { usePermissionOverrides } from './presentation/hooks/usePermissionOverrides';
export type {
  UsePermissionOverridesOptions,
  UsePermissionOverridesResult,
} from './presentation/hooks/usePermissionOverrides';

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------
export { RolesManager } from './presentation/components/RolesManager';
export type { RolesManagerProps } from './presentation/components/RolesManager';
export { GrantsManager } from './presentation/components/GrantsManager';
export type { GrantsManagerProps } from './presentation/components/GrantsManager';
export { OverridesManager } from './presentation/components/OverridesManager';
export type { OverridesManagerProps } from './presentation/components/OverridesManager';
export { EffectivePermissionsViewer } from './presentation/components/EffectivePermissionsViewer';
export type { EffectivePermissionsViewerProps } from './presentation/components/EffectivePermissionsViewer';
export { AccessPanel } from './presentation/components/AccessPanel';
export type { AccessPanelProps } from './presentation/components/AccessPanel';
