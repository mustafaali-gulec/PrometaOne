/**
 * PgAccessRepository — AccessRepository PG implementasyonu.
 *
 * Tablolar: access_custom_roles, access_role_grants, access_permission_overrides
 * (021_access_rbac.sql). Tüm sorgular company_id ile scope'lanır.
 */
import type {
  AccessRepository,
  NewCustomRoleInput,
  NewPermissionOverrideInput,
  NewRoleGrantInput,
} from '../../application/ports/AccessRepository.js';
import { CustomRole } from '../../domain/entities/CustomRole.js';
import { PermissionOverride } from '../../domain/entities/PermissionOverride.js';
import { RoleGrant } from '../../domain/entities/RoleGrant.js';
import type { SubjectType } from '../../domain/valueObjects/SubjectType.js';

import type { Queryable } from './Queryable.js';

// --- row types ---
interface CustomRoleRow {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

interface RoleGrantRow {
  id: number;
  company_id: number;
  role_id: number;
  subject_type: SubjectType;
  subject_id: string;
  cascade: boolean;
  valid_from: Date | null;
  valid_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface PermissionOverrideRow {
  id: number;
  company_id: number;
  username: string;
  resource: string;
  action: string;
  allow: boolean;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const ROLE_COLS = 'id, company_id, name, description, permissions, created_at, updated_at';
const GRANT_COLS =
  'id, company_id, role_id, subject_type, subject_id, cascade, valid_from, valid_until, created_at, updated_at';
const OVERRIDE_COLS =
  'id, company_id, username, resource, action, allow, expires_at, created_at, updated_at';

export class PgAccessRepository implements AccessRepository {
  constructor(private readonly pool: Queryable) {}

  // --- custom roles ---

  async createRole(input: NewCustomRoleInput): Promise<CustomRole> {
    const r = await this.pool.query<CustomRoleRow>(
      `INSERT INTO access_custom_roles (company_id, name, description, permissions)
       VALUES ($1, $2, $3, $4)
       RETURNING ${ROLE_COLS}`,
      [input.companyId, input.name, input.description, input.permissions],
    );
    return rowToCustomRole(r.rows[0]!);
  }

  async updateRole(role: CustomRole): Promise<void> {
    await this.pool.query(
      `UPDATE access_custom_roles
         SET name = $1, description = $2, permissions = $3, updated_at = NOW()
       WHERE id = $4 AND company_id = $5`,
      [role.name, role.description, role.permissions as string[], role.id, role.companyId],
    );
  }

  async deleteRole(id: number, companyId: number): Promise<void> {
    await this.pool.query(`DELETE FROM access_custom_roles WHERE id = $1 AND company_id = $2`, [
      id,
      companyId,
    ]);
  }

  async findRoleById(id: number, companyId: number): Promise<CustomRole | null> {
    const r = await this.pool.query<CustomRoleRow>(
      `SELECT ${ROLE_COLS} FROM access_custom_roles WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToCustomRole(row) : null;
  }

  async findRoleByName(name: string, companyId: number): Promise<CustomRole | null> {
    const r = await this.pool.query<CustomRoleRow>(
      `SELECT ${ROLE_COLS} FROM access_custom_roles WHERE name = $1 AND company_id = $2 LIMIT 1`,
      [name, companyId],
    );
    const row = r.rows[0];
    return row ? rowToCustomRole(row) : null;
  }

  async listRolesByCompany(companyId: number): Promise<ReadonlyArray<CustomRole>> {
    const r = await this.pool.query<CustomRoleRow>(
      `SELECT ${ROLE_COLS} FROM access_custom_roles WHERE company_id = $1 ORDER BY name ASC, id ASC`,
      [companyId],
    );
    return r.rows.map(rowToCustomRole);
  }

  // --- role grants ---

  async createGrant(input: NewRoleGrantInput): Promise<RoleGrant> {
    const r = await this.pool.query<RoleGrantRow>(
      `INSERT INTO access_role_grants
         (company_id, role_id, subject_type, subject_id, cascade, valid_from, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${GRANT_COLS}`,
      [
        input.companyId,
        input.roleId,
        input.subjectType,
        input.subjectId,
        input.cascade,
        input.validFrom,
        input.validUntil,
      ],
    );
    return rowToRoleGrant(r.rows[0]!);
  }

  async deleteGrant(id: number, companyId: number): Promise<void> {
    await this.pool.query(`DELETE FROM access_role_grants WHERE id = $1 AND company_id = $2`, [
      id,
      companyId,
    ]);
  }

  async findGrantById(id: number, companyId: number): Promise<RoleGrant | null> {
    const r = await this.pool.query<RoleGrantRow>(
      `SELECT ${GRANT_COLS} FROM access_role_grants WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToRoleGrant(row) : null;
  }

  async listGrantsByCompany(companyId: number): Promise<ReadonlyArray<RoleGrant>> {
    const r = await this.pool.query<RoleGrantRow>(
      `SELECT ${GRANT_COLS} FROM access_role_grants WHERE company_id = $1 ORDER BY id ASC`,
      [companyId],
    );
    return r.rows.map(rowToRoleGrant);
  }

  // --- permission overrides ---

  async upsertOverride(input: NewPermissionOverrideInput): Promise<PermissionOverride> {
    const r = await this.pool.query<PermissionOverrideRow>(
      `INSERT INTO access_permission_overrides
         (company_id, username, resource, action, allow, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (company_id, username, resource, action)
       DO UPDATE SET allow = EXCLUDED.allow,
                     expires_at = EXCLUDED.expires_at,
                     updated_at = NOW()
       RETURNING ${OVERRIDE_COLS}`,
      [input.companyId, input.username, input.resource, input.action, input.allow, input.expiresAt],
    );
    return rowToPermissionOverride(r.rows[0]!);
  }

  async deleteOverride(id: number, companyId: number): Promise<void> {
    await this.pool.query(
      `DELETE FROM access_permission_overrides WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
  }

  async findOverrideById(id: number, companyId: number): Promise<PermissionOverride | null> {
    const r = await this.pool.query<PermissionOverrideRow>(
      `SELECT ${OVERRIDE_COLS} FROM access_permission_overrides WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToPermissionOverride(row) : null;
  }

  async listOverridesByCompany(companyId: number): Promise<ReadonlyArray<PermissionOverride>> {
    const r = await this.pool.query<PermissionOverrideRow>(
      `SELECT ${OVERRIDE_COLS} FROM access_permission_overrides WHERE company_id = $1 ORDER BY username ASC, id ASC`,
      [companyId],
    );
    return r.rows.map(rowToPermissionOverride);
  }

  async listOverridesForUser(
    username: string,
    companyId: number,
  ): Promise<ReadonlyArray<PermissionOverride>> {
    const r = await this.pool.query<PermissionOverrideRow>(
      `SELECT ${OVERRIDE_COLS} FROM access_permission_overrides
        WHERE company_id = $1 AND username = $2 ORDER BY id ASC`,
      [companyId, username],
    );
    return r.rows.map(rowToPermissionOverride);
  }
}

// --- row mappers ---

function rowToCustomRole(row: CustomRoleRow): CustomRole {
  return CustomRole.create({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
    permissions: row.permissions ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function rowToRoleGrant(row: RoleGrantRow): RoleGrant {
  return RoleGrant.create({
    id: row.id,
    companyId: row.company_id,
    roleId: row.role_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    cascade: row.cascade,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function rowToPermissionOverride(row: PermissionOverrideRow): PermissionOverride {
  return PermissionOverride.create({
    id: row.id,
    companyId: row.company_id,
    username: row.username,
    resource: row.resource,
    action: row.action,
    allow: row.allow,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
