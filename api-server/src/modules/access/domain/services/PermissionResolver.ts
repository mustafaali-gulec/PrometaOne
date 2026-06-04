/**
 * PermissionResolver — legacy `can()` (App.jsx ~3857–3947) ile AYNI 3 katmanlı
 * yetki çözümünü uygulayan saf (pure) domain servisi.
 *
 * Katmanlar (sırayla):
 *   (a) session.role === 'admin' → her zaman true.
 *   (b) overrides: deny (allow=false) kazanır, sonra allow (allow=true).
 *   (c) grants: kullanıcıya/scope'una uyan (cascade + geçerlilik penceresi)
 *       bir grant'in rolü izni içeriyorsa → true.
 *   Aksi halde → false.
 *
 * SAPMA NOTU (frontend'ten kasıtlı fark):
 *   Legacy `can()` view aksiyonları için `res.legacyPerm` + `PERMS` haritası
 *   üzerinden bir "sistem rolü base layer" fallback'i uygular. Bu harita SADECE
 *   frontend'e özgüdür (App.jsx içinde). Backend'de 5 sistem rolünün base
 *   erişimi KAPSAM DIŞIDIR; bu resolver YALNIZCA admin + özel-rol grant'ları +
 *   override'ları üst katman olarak çözer. Yani 'admin' dışındaki sistem rolleri
 *   için, kendisine grant/override verilmemiş bir izin `false` döner.
 */
import { splitPermission } from '../valueObjects/Permission.js';

export interface ResolverSession {
  username: string;
  role: string;
}

export interface UserScope {
  employeeId?: number;
  jobTitleId?: number;
  departmentId?: number;
  orgUnitId?: number;
}

/** Cascade-descendant hesabı için minimal org/dept şekilleri. */
export interface OrgUnitNode {
  id: number;
  parentId: number | null;
}
export interface DepartmentNode {
  id: number;
  parentDeptId: number | null;
}

export interface ResolverGrant {
  roleId: number;
  subjectType: 'user' | 'employee' | 'job_title' | 'department' | 'org_unit';
  /** 'user' → username; diğerleri → numeric id'nin text hali. */
  subjectId: string;
  cascade: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
}

export interface ResolverCustomRole {
  id: number;
  permissions: ReadonlyArray<string>;
}

export interface ResolverOverride {
  username: string;
  resource: string;
  action: string;
  allow: boolean;
  expiresAt: Date | null;
}

export interface ResolverContext {
  customRoles: ReadonlyArray<ResolverCustomRole>;
  grants: ReadonlyArray<ResolverGrant>;
  overrides: ReadonlyArray<ResolverOverride>;
  userScope?: UserScope;
  orgUnits?: ReadonlyArray<OrgUnitNode>;
  departments?: ReadonlyArray<DepartmentNode>;
  /** Test/saatleme için; verilmezse new Date(). */
  now?: Date;
}

/**
 * Tek bir `resource.action` için yetki çözer.
 */
export function resolvePermission(
  session: ResolverSession,
  permission: string,
  ctx: ResolverContext,
): boolean {
  const now = ctx.now ?? new Date();
  const { resource, action } = splitPermission(permission);

  // (a) admin her şeyi yapabilir
  if (session.role === 'admin') return true;

  // (b) override kontrolü (deny her zaman önceliklidir)
  const userOverrides = ctx.overrides.filter(
    (o) =>
      o.username === session.username &&
      o.resource === resource &&
      o.action === action &&
      (o.expiresAt === null || o.expiresAt.getTime() >= now.getTime()),
  );
  if (userOverrides.some((o) => o.allow === false)) return false;
  if (userOverrides.some((o) => o.allow === true)) return true;

  // (c) custom-role grant kontrolü
  const orgUnits = ctx.orgUnits ?? [];
  const departments = ctx.departments ?? [];
  const userScope = ctx.userScope;

  for (const g of ctx.grants) {
    if (!grantAppliesToUser(g, session, userScope, { orgUnits, departments })) continue;
    if (g.validFrom !== null && g.validFrom.getTime() > now.getTime()) continue;
    if (g.validUntil !== null && g.validUntil.getTime() < now.getTime()) continue;
    const role = ctx.customRoles.find((r) => r.id === g.roleId);
    if (role === undefined) continue;
    if (role.permissions.includes(`${resource}.${action}`)) return true;
  }

  return false;
}

/**
 * Katalogdaki tüm izinler (ya da verilen aday liste) içinden kullanıcının
 * etkin (allow olan) izin setini hesaplar.
 */
export function resolveEffectivePermissions(
  session: ResolverSession,
  catalogPermissions: ReadonlyArray<string>,
  ctx: ResolverContext,
): string[] {
  return catalogPermissions.filter((p) => resolvePermission(session, p, ctx));
}

/**
 * Grant kullanıcıya/scope'una uygulanıyor mu? (cascade desteği ile)
 * Legacy `grantAppliesToUser` ile birebir aynı mantık.
 */
export function grantAppliesToUser(
  grant: ResolverGrant,
  session: ResolverSession,
  userScope: UserScope | undefined,
  opts: { orgUnits: ReadonlyArray<OrgUnitNode>; departments: ReadonlyArray<DepartmentNode> },
): boolean {
  const cascade = grant.cascade !== false; // default true
  const { orgUnits, departments } = opts;

  switch (grant.subjectType) {
    case 'user':
      return grant.subjectId === session.username;

    case 'employee':
      return (
        userScope?.employeeId !== undefined && String(userScope.employeeId) === grant.subjectId
      );

    case 'job_title':
      return (
        userScope?.jobTitleId !== undefined && String(userScope.jobTitleId) === grant.subjectId
      );

    case 'department': {
      if (userScope?.departmentId === undefined) return false;
      if (String(userScope.departmentId) === grant.subjectId) return true;
      if (!cascade) return false;
      return isDescendantDepartment(userScope.departmentId, Number(grant.subjectId), departments);
    }

    case 'org_unit': {
      if (userScope?.orgUnitId === undefined) return false;
      if (String(userScope.orgUnitId) === grant.subjectId) return true;
      if (!cascade) return false;
      return isDescendantOrgUnit(userScope.orgUnitId, Number(grant.subjectId), orgUnits);
    }

    default:
      return false;
  }
}

/** childId departmanı, ancestorId departmanının (recursive) alt-departmanı mı? */
export function isDescendantDepartment(
  childId: number,
  ancestorId: number,
  departments: ReadonlyArray<DepartmentNode>,
): boolean {
  if (childId <= 0 || ancestorId <= 0) return false;
  const visited = new Set<number>();
  let cur = departments.find((d) => d.id === childId);
  while (cur !== undefined && cur.parentDeptId !== null && !visited.has(cur.id)) {
    visited.add(cur.id);
    if (cur.parentDeptId === ancestorId) return true;
    const parentId: number = cur.parentDeptId;
    cur = departments.find((d) => d.id === parentId);
  }
  return false;
}

/** childId birimi, ancestorId biriminin (recursive) alt-birimi mi? */
export function isDescendantOrgUnit(
  childId: number,
  ancestorId: number,
  orgUnits: ReadonlyArray<OrgUnitNode>,
): boolean {
  if (childId <= 0 || ancestorId <= 0) return false;
  const visited = new Set<number>();
  let cur = orgUnits.find((o) => o.id === childId);
  while (cur !== undefined && cur.parentId !== null && !visited.has(cur.id)) {
    visited.add(cur.id);
    if (cur.parentId === ancestorId) return true;
    const parentId: number = cur.parentId;
    cur = orgUnits.find((o) => o.id === parentId);
  }
  return false;
}
