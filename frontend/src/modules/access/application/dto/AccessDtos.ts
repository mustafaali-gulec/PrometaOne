/**
 * Access (RBAC / Özel Roller) DTO tipleri — backend /v1/access response'ları.
 */

export type AccessAction = 'view' | 'create' | 'update' | 'delete' | 'export';

export type SubjectType = 'user' | 'employee' | 'job_title' | 'department' | 'org_unit';

/** Katalog girdisi — bir resource ve izin verilen aksiyonları. */
export interface CatalogResource {
  resource: string;
  module: string;
  label: string;
  actions: ReadonlyArray<AccessAction>;
}

export interface CatalogResponse {
  actions: ReadonlyArray<AccessAction>;
  resources: ReadonlyArray<CatalogResource>;
}

export interface CustomRoleDto {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  permissions: ReadonlyArray<string>;
  createdAt: string;
  updatedAt: string;
}

export interface RolesResponse {
  roles: ReadonlyArray<CustomRoleDto>;
}

export interface RoleGrantDto {
  id: number;
  companyId: number;
  roleId: number;
  subjectType: SubjectType;
  subjectId: string;
  cascade: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GrantsResponse {
  grants: ReadonlyArray<RoleGrantDto>;
}

export interface PermissionOverrideDto {
  id: number;
  companyId: number;
  username: string;
  resource: string;
  action: string;
  allow: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OverridesResponse {
  overrides: ReadonlyArray<PermissionOverrideDto>;
}

export interface EffectivePermissionsDto {
  username: string;
  role: string;
  permissions: ReadonlyArray<string>;
}
