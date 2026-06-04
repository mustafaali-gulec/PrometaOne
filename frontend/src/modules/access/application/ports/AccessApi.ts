/**
 * AccessApi — frontend → backend /v1/access sözleşmesi (port).
 *
 * Concrete: infrastructure/api/AccessApiClient.ts.
 */
import type {
  CatalogResponse,
  CustomRoleDto,
  EffectivePermissionsDto,
  GrantsResponse,
  OverridesResponse,
  PermissionOverrideDto,
  RoleGrantDto,
  RolesResponse,
  SubjectType,
} from '../dto/AccessDtos';

export interface CreateRoleBody {
  companyId: number;
  name: string;
  description?: string | null;
  permissions: ReadonlyArray<string>;
}

export interface UpdateRoleBody {
  companyId: number;
  name: string;
  description?: string | null;
  permissions: ReadonlyArray<string>;
}

export interface CreateGrantBody {
  companyId: number;
  roleId: number;
  subjectType: SubjectType;
  subjectId: string;
  cascade?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface SetOverrideBody {
  companyId: number;
  username: string;
  resource: string;
  action: string;
  allow: boolean;
  expiresAt?: string | null;
}

export interface AccessApi {
  // catalog
  getCatalog(): Promise<CatalogResponse>;

  // roles
  listRoles(companyId: number): Promise<RolesResponse>;
  createRole(body: CreateRoleBody): Promise<CustomRoleDto>;
  updateRole(id: number, body: UpdateRoleBody): Promise<CustomRoleDto>;
  deleteRole(id: number, companyId: number): Promise<void>;

  // grants
  listGrants(companyId: number): Promise<GrantsResponse>;
  createGrant(body: CreateGrantBody): Promise<RoleGrantDto>;
  deleteGrant(id: number, companyId: number): Promise<void>;

  // overrides
  listOverrides(companyId: number): Promise<OverridesResponse>;
  setOverride(body: SetOverrideBody): Promise<PermissionOverrideDto>;
  deleteOverride(id: number, companyId: number): Promise<void>;

  // resolve
  getEffectivePermissions(
    companyId: number,
    options?: { username?: string; role?: string },
  ): Promise<EffectivePermissionsDto>;
}
