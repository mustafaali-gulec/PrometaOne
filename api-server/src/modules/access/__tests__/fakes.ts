/**
 * In-memory test doubles for the access module.
 *
 * InMemoryAccessRepository AccessRepository sözleşmesini honor eder —
 * DB UNIQUE constraint'lerini (rol adı; override (company,username,resource,action))
 * JS Map/Array ile taklit eder.
 */
import type {
  AccessRepository,
  NewCustomRoleInput,
  NewPermissionOverrideInput,
  NewRoleGrantInput,
} from '../application/ports/AccessRepository.js';
import type { AuditEntry, AuditLogger } from '../application/ports/AuditLogger.js';
import type { Clock } from '../application/ports/Clock.js';
import type { OrgStructureReader } from '../application/ports/OrgStructureReader.js';
import { CustomRole } from '../domain/entities/CustomRole.js';
import { PermissionOverride } from '../domain/entities/PermissionOverride.js';
import { RoleGrant } from '../domain/entities/RoleGrant.js';
import type {
  DepartmentNode,
  OrgUnitNode,
  UserScope,
} from '../domain/services/PermissionResolver.js';

// ============================================================================
// Clock
// ============================================================================
export class FakeClock implements Clock {
  constructor(public current: Date = new Date('2026-06-04T09:00:00Z')) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(date: Date): void {
    this.current = new Date(date);
  }
}

// ============================================================================
// AuditLogger
// ============================================================================
export class RecordingAuditLogger implements AuditLogger {
  public readonly entries: AuditEntry[] = [];

  async log(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }

  findByAction(action: string): AuditEntry[] {
    return this.entries.filter((e) => e.action === action);
  }

  clear(): void {
    this.entries.length = 0;
  }
}

// ============================================================================
// AccessRepository fake
// ============================================================================
export class InMemoryAccessRepository implements AccessRepository {
  private roles = new Map<number, CustomRole>();
  private grants = new Map<number, RoleGrant>();
  private overrides = new Map<number, PermissionOverride>();
  private seqRole = 0;
  private seqGrant = 0;
  private seqOverride = 0;
  private now = new Date('2026-06-04T09:00:00Z');

  // --- roles ---
  async createRole(input: NewCustomRoleInput): Promise<CustomRole> {
    const id = ++this.seqRole;
    const role = CustomRole.create({
      id,
      companyId: input.companyId,
      name: input.name,
      description: input.description,
      permissions: input.permissions,
      createdAt: this.now,
      updatedAt: this.now,
    });
    this.roles.set(id, role);
    return role;
  }

  async updateRole(role: CustomRole): Promise<void> {
    this.roles.set(role.id, role);
  }

  async deleteRole(id: number, companyId: number): Promise<void> {
    const r = this.roles.get(id);
    if (r && r.companyId === companyId) {
      this.roles.delete(id);
      // CASCADE — ilişkili grant'ları sil
      for (const [gid, g] of this.grants) {
        if (g.roleId === id) this.grants.delete(gid);
      }
    }
  }

  async findRoleById(id: number, companyId: number): Promise<CustomRole | null> {
    const r = this.roles.get(id);
    return r && r.companyId === companyId ? r : null;
  }

  async findRoleByName(name: string, companyId: number): Promise<CustomRole | null> {
    for (const r of this.roles.values()) {
      if (r.companyId === companyId && r.name === name) return r;
    }
    return null;
  }

  async listRolesByCompany(companyId: number): Promise<ReadonlyArray<CustomRole>> {
    return [...this.roles.values()]
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // --- grants ---
  async createGrant(input: NewRoleGrantInput): Promise<RoleGrant> {
    const id = ++this.seqGrant;
    const grant = RoleGrant.create({
      id,
      companyId: input.companyId,
      roleId: input.roleId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      cascade: input.cascade,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      createdAt: this.now,
      updatedAt: this.now,
    });
    this.grants.set(id, grant);
    return grant;
  }

  async deleteGrant(id: number, companyId: number): Promise<void> {
    const g = this.grants.get(id);
    if (g && g.companyId === companyId) this.grants.delete(id);
  }

  async findGrantById(id: number, companyId: number): Promise<RoleGrant | null> {
    const g = this.grants.get(id);
    return g && g.companyId === companyId ? g : null;
  }

  async listGrantsByCompany(companyId: number): Promise<ReadonlyArray<RoleGrant>> {
    return [...this.grants.values()].filter((g) => g.companyId === companyId);
  }

  // --- overrides ---
  async upsertOverride(input: NewPermissionOverrideInput): Promise<PermissionOverride> {
    // UNIQUE (company_id, username, resource, action)
    for (const [oid, o] of this.overrides) {
      if (
        o.companyId === input.companyId &&
        o.username === input.username &&
        o.resource === input.resource &&
        o.action === input.action
      ) {
        const updated = PermissionOverride.create({
          id: oid,
          companyId: input.companyId,
          username: input.username,
          resource: input.resource,
          action: input.action,
          allow: input.allow,
          expiresAt: input.expiresAt,
          createdAt: o.createdAt,
          updatedAt: this.now,
        });
        this.overrides.set(oid, updated);
        return updated;
      }
    }
    const id = ++this.seqOverride;
    const created = PermissionOverride.create({
      id,
      companyId: input.companyId,
      username: input.username,
      resource: input.resource,
      action: input.action,
      allow: input.allow,
      expiresAt: input.expiresAt,
      createdAt: this.now,
      updatedAt: this.now,
    });
    this.overrides.set(id, created);
    return created;
  }

  async deleteOverride(id: number, companyId: number): Promise<void> {
    const o = this.overrides.get(id);
    if (o && o.companyId === companyId) this.overrides.delete(id);
  }

  async findOverrideById(id: number, companyId: number): Promise<PermissionOverride | null> {
    const o = this.overrides.get(id);
    return o && o.companyId === companyId ? o : null;
  }

  async listOverridesByCompany(companyId: number): Promise<ReadonlyArray<PermissionOverride>> {
    return [...this.overrides.values()].filter((o) => o.companyId === companyId);
  }

  async listOverridesForUser(
    username: string,
    companyId: number,
  ): Promise<ReadonlyArray<PermissionOverride>> {
    return [...this.overrides.values()].filter(
      (o) => o.companyId === companyId && o.username === username,
    );
  }
}

// ============================================================================
// OrgStructureReader fake
// ============================================================================
export class InMemoryOrgStructureReader implements OrgStructureReader {
  constructor(
    private readonly orgUnits: ReadonlyArray<OrgUnitNode> = [],
    private readonly departments: ReadonlyArray<DepartmentNode> = [],
    private readonly scopes: ReadonlyMap<string, UserScope> = new Map(),
  ) {}

  async listOrgUnits(_companyId: number): Promise<ReadonlyArray<OrgUnitNode>> {
    return this.orgUnits;
  }

  async listDepartments(_companyId: number): Promise<ReadonlyArray<DepartmentNode>> {
    return this.departments;
  }

  async resolveUserScope(username: string, _companyId: number): Promise<UserScope | null> {
    return this.scopes.get(username) ?? null;
  }
}

export function makeFakeAccessContext(): {
  repo: InMemoryAccessRepository;
  clock: FakeClock;
  audit: RecordingAuditLogger;
} {
  return {
    repo: new InMemoryAccessRepository(),
    clock: new FakeClock(),
    audit: new RecordingAuditLogger(),
  };
}
