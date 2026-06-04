/**
 * ResolvePermissionsUseCase — bir kullanıcının (session) etkin izin setini çözer.
 *
 * Read-only. Şirketin custom rollerini, grant'larını ve kullanıcının
 * override'larını repo'dan toplar, PermissionResolver (domain) ile çözer.
 *
 * userScope ve org/dept hiyerarşisi opsiyoneldir; verilmezse yalnızca
 * subjectType='user' grant'ları ve override'lar (+admin) çözülür.
 */
import {
  resolveEffectivePermissions,
  type DepartmentNode,
  type OrgUnitNode,
  type ResolverContext,
  type ResolverCustomRole,
  type ResolverGrant,
  type ResolverOverride,
  type UserScope,
} from '../../domain/services/PermissionResolver.js';
import { allCatalogPermissions } from '../../domain/valueObjects/Permission.js';
import type { EffectivePermissionsDto } from '../dto/EffectivePermissionsDto.js';
import type { AccessRepository } from '../ports/AccessRepository.js';
import type { Clock } from '../ports/Clock.js';

export interface ResolvePermissionsInput {
  companyId: number;
  username: string;
  role: string;
  userScope?: UserScope;
  orgUnits?: ReadonlyArray<OrgUnitNode>;
  departments?: ReadonlyArray<DepartmentNode>;
}

export class ResolvePermissionsUseCase {
  constructor(
    private readonly repo: AccessRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ResolvePermissionsInput): Promise<EffectivePermissionsDto> {
    const [roles, grants, overrides] = await Promise.all([
      this.repo.listRolesByCompany(input.companyId),
      this.repo.listGrantsByCompany(input.companyId),
      this.repo.listOverridesForUser(input.username, input.companyId),
    ]);

    const customRoles: ResolverCustomRole[] = roles.map((r) => ({
      id: r.id,
      permissions: r.permissions,
    }));

    const resolverGrants: ResolverGrant[] = grants.map((g) => ({
      roleId: g.roleId,
      subjectType: g.subjectType,
      subjectId: g.subjectId,
      cascade: g.cascade,
      validFrom: g.validFrom,
      validUntil: g.validUntil,
    }));

    const resolverOverrides: ResolverOverride[] = overrides.map((o) => ({
      username: o.username,
      resource: o.resource,
      action: o.action,
      allow: o.allow,
      expiresAt: o.expiresAt,
    }));

    const ctx: ResolverContext = {
      customRoles,
      grants: resolverGrants,
      overrides: resolverOverrides,
      now: this.clock.now(),
      ...(input.userScope !== undefined ? { userScope: input.userScope } : {}),
      ...(input.orgUnits !== undefined ? { orgUnits: input.orgUnits } : {}),
      ...(input.departments !== undefined ? { departments: input.departments } : {}),
    };

    const permissions = resolveEffectivePermissions(
      { username: input.username, role: input.role },
      allCatalogPermissions(),
      ctx,
    );

    return {
      username: input.username,
      role: input.role,
      permissions,
    };
  }
}
