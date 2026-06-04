/**
 * AccessRepository — özel rol + grant + override persistence portu.
 *
 * Concrete: infrastructure/persistence/PgAccessRepository.ts.
 * Tüm sorgular company_id ile scope'lanır (multi-tenant izolasyon).
 */
import type { CustomRole } from '../../domain/entities/CustomRole.js';
import type { PermissionOverride } from '../../domain/entities/PermissionOverride.js';
import type { RoleGrant } from '../../domain/entities/RoleGrant.js';
import type { SubjectType } from '../../domain/valueObjects/SubjectType.js';

export interface AccessRepository {
  // --- custom roles ---
  createRole(input: NewCustomRoleInput): Promise<CustomRole>;
  updateRole(role: CustomRole): Promise<void>;
  deleteRole(id: number, companyId: number): Promise<void>;
  findRoleById(id: number, companyId: number): Promise<CustomRole | null>;
  findRoleByName(name: string, companyId: number): Promise<CustomRole | null>;
  listRolesByCompany(companyId: number): Promise<ReadonlyArray<CustomRole>>;

  // --- role grants ---
  createGrant(input: NewRoleGrantInput): Promise<RoleGrant>;
  deleteGrant(id: number, companyId: number): Promise<void>;
  findGrantById(id: number, companyId: number): Promise<RoleGrant | null>;
  listGrantsByCompany(companyId: number): Promise<ReadonlyArray<RoleGrant>>;

  // --- permission overrides ---
  /** allow/deny upsert: (company_id, username, resource, action) UNIQUE. */
  upsertOverride(input: NewPermissionOverrideInput): Promise<PermissionOverride>;
  deleteOverride(id: number, companyId: number): Promise<void>;
  findOverrideById(id: number, companyId: number): Promise<PermissionOverride | null>;
  listOverridesByCompany(companyId: number): Promise<ReadonlyArray<PermissionOverride>>;
  listOverridesForUser(
    username: string,
    companyId: number,
  ): Promise<ReadonlyArray<PermissionOverride>>;
}

export interface NewCustomRoleInput {
  companyId: number;
  name: string;
  description: string | null;
  permissions: ReadonlyArray<string>;
}

export interface NewRoleGrantInput {
  companyId: number;
  roleId: number;
  subjectType: SubjectType;
  subjectId: string;
  cascade: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
}

export interface NewPermissionOverrideInput {
  companyId: number;
  username: string;
  resource: string;
  action: string;
  allow: boolean;
  expiresAt: Date | null;
}
