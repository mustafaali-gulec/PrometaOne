/**
 * AccessProjection — app-state blob'unun RBAC koleksiyonlarını access_*
 * tablolarının satırlarına projeksiyonlar (046_access_projection.sql).
 *
 * SAF fonksiyon: IO yok, birim testlenebilir. PUT /v1/app-state/promet:data
 * sonrası SetAppStateUseCase bunu çağırıp PgAccessProjectionRepository
 * .replaceAll'a verir (mirror ile aynı fire-and-forget kalıbı).
 *
 * Blob kaynak şekilleri (frontend/src/App.jsx'ten DOĞRULANDI):
 *   companyData[cid].hrCustomRoles  = [{ id:"role_...", name, description?,
 *     color?, permissions:["res.action",...], createdAt, createdBy }]
 *   companyData[cid].hrRoleGrants   = [{ id:"grant_...", roleId,
 *     subjectType:'user'|'employee'|'job_title'|'department'|'org_unit',
 *     subjectId, cascade (default true), validFrom?, validUntil?, note?,
 *     source? ("user_role") }]
 *   companyData[cid].hrPermOverrides= [{ id:"ovr_...", userId (username!),
 *     resource, action, allow:boolean, expiresAt?, createdAt, createdBy }]
 *
 * ŞİRKET AYRIMI KARARI: access_* şeması company_id INT NOT NULL FK
 * companies(id) ile şirket ayrımını DESTEKLER; ancak blob companyData
 * anahtarları istemci-üretimi STRING'dir ("comp_promet") ve sunucu companies
 * SERIAL id'lerine haritası YOKTUR. Kod tabanındaki yerleşik kalıp
 * (einvBackendCompanyId, syncPerfBackend: Number(cid) pozitif tamsayıysa o,
 * değilse 1) burada da uygulanır:
 *   - Number(cid) pozitif tamsayı → company_id = Number(cid) (ayrım korunur).
 *   - Aksi hâlde → DEFAULT_ACCESS_COMPANY_ID (1); birden çok istemci şirketi
 *     buraya düşerse koleksiyonlar BİRLEŞTİRİLİR (client_id satırları ayrık
 *     tutar; aynı ada iki rol düşerse doğal anahtar gereği SON kazanır).
 * Var olmayan company_id'lerin FK koruması repository'de (companies lookup +
 * satır düşürme) ele alınır — projeksiyon saf kalır.
 *
 * Eleme kuralları (çöp satır yerine atlama):
 *   - id'siz / adsız rol atlanır.
 *   - roleId'siz, geçersiz subjectType'lı veya subjectId'siz grant atlanır.
 *   - username/resource/action'sız override atlanır.
 *   - Çift client_id'de SON kazanır; override'larda ek olarak doğal anahtar
 *     (companyId, username, resource, action) üzerinde de SON kazanır
 *     (uq_access_overrides_company_user_perm ihlali olmasın).
 */

export const DEFAULT_ACCESS_COMPANY_ID = 1;

export const ACCESS_SUBJECT_TYPES = [
  'user',
  'employee',
  'job_title',
  'department',
  'org_unit',
] as const;
export type AccessSubjectType = (typeof ACCESS_SUBJECT_TYPES)[number];

export interface AccessRoleProjection {
  companyId: number;
  /** Blob rol id'si ("role_..."). */
  clientId: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface AccessGrantProjection {
  companyId: number;
  /** Blob grant id'si ("grant_..."). */
  clientId: string;
  /** Blob rol id'si — repository access_custom_roles.client_id üzerinden çözer. */
  roleClientId: string;
  subjectType: AccessSubjectType;
  subjectId: string;
  cascade: boolean;
  validFrom: string | null;
  validUntil: string | null;
}

export interface AccessOverrideProjection {
  companyId: number;
  /** Blob override id'si ("ovr_..."). */
  clientId: string;
  username: string;
  resource: string;
  action: string;
  allow: boolean;
  expiresAt: string | null;
}

export interface AccessProjection {
  roles: AccessRoleProjection[];
  grants: AccessGrantProjection[];
  overrides: AccessOverrideProjection[];
}

export interface ProjectAccessOptions {
  /** Sayısal olmayan blob şirket anahtarlarının düşeceği company_id (öndeğer 1). */
  defaultCompanyId?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** id/subjectId gibi kimlikler: dolu string veya sonlu sayı → string; aksi null. */
function idString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** Dolu string → trim'li hâli; aksi null. */
function textOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return null;
}

/** Tarih alanları: dolu string aynen taşınır (PG timestamptz'e cast eder); aksi null. */
function dateOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return null;
}

/** Blob şirket anahtarı → sunucu company_id (yerleşik Number-veya-1 kalıbı). */
export function resolveAccessCompanyId(cid: string, defaultCompanyId: number): number {
  const n = Number(cid);
  if (Number.isInteger(n) && n > 0) return n;
  return defaultCompanyId;
}

function projectRoles(
  out: Map<string, AccessRoleProjection>,
  companyId: number,
  value: unknown,
): void {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (!isPlainObject(item)) continue;
    const clientId = idString(item['id']);
    const name = textOrNull(item['name']);
    if (clientId === null || name === null) continue;
    const rawPerms = item['permissions'];
    const permissions = Array.isArray(rawPerms)
      ? rawPerms.filter((p): p is string => typeof p === 'string' && p.trim() !== '')
      : [];
    out.set(clientId, {
      companyId,
      clientId,
      name,
      description: textOrNull(item['description']),
      permissions,
    });
  }
}

function projectGrants(
  out: Map<string, AccessGrantProjection>,
  companyId: number,
  value: unknown,
): void {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (!isPlainObject(item)) continue;
    const clientId = idString(item['id']);
    const roleClientId = idString(item['roleId']);
    const subjectId = idString(item['subjectId']);
    const subjectType = item['subjectType'];
    if (clientId === null || roleClientId === null || subjectId === null) continue;
    if (
      typeof subjectType !== 'string' ||
      !(ACCESS_SUBJECT_TYPES as readonly string[]).includes(subjectType)
    ) {
      continue;
    }
    out.set(clientId, {
      companyId,
      clientId,
      roleClientId,
      subjectType: subjectType as AccessSubjectType,
      subjectId,
      cascade: item['cascade'] !== false, // blob öndeğeri true
      validFrom: dateOrNull(item['validFrom']),
      validUntil: dateOrNull(item['validUntil']),
    });
  }
}

function projectOverrides(
  out: Map<string, AccessOverrideProjection>,
  companyId: number,
  value: unknown,
): void {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (!isPlainObject(item)) continue;
    const clientId = idString(item['id']);
    // Blob alanı userId'dir (username taşır); savunmacı olarak username de kabul.
    const username = idString(item['userId']) ?? idString(item['username']);
    const resource = textOrNull(item['resource']);
    const action = textOrNull(item['action']);
    if (clientId === null || username === null || resource === null || action === null) continue;
    out.set(clientId, {
      companyId,
      clientId,
      username,
      resource,
      action,
      allow: item['allow'] === true,
      expiresAt: dateOrNull(item['expiresAt']),
    });
  }
}

/**
 * Blob değeri ('promet:data' içeriği) → access_* projeksiyon satırları.
 * Tüm şirketlerin birleşimi; boş/geçersiz girdi boş projeksiyon döndürür
 * (repository boş projeksiyonda projeksiyon-sahipli satırları budar).
 */
export function projectAccess(blobValue: unknown, opts?: ProjectAccessOptions): AccessProjection {
  const defaultCompanyId = opts?.defaultCompanyId ?? DEFAULT_ACCESS_COMPANY_ID;
  const roles = new Map<string, AccessRoleProjection>();
  const grants = new Map<string, AccessGrantProjection>();
  const overrides = new Map<string, AccessOverrideProjection>();

  if (isPlainObject(blobValue)) {
    const companyData = blobValue['companyData'];
    if (isPlainObject(companyData)) {
      for (const [cid, companyValue] of Object.entries(companyData)) {
        if (cid.trim() === '' || !isPlainObject(companyValue)) continue;
        const companyId = resolveAccessCompanyId(cid, defaultCompanyId);
        projectRoles(roles, companyId, companyValue['hrCustomRoles']);
        projectGrants(grants, companyId, companyValue['hrRoleGrants']);
        projectOverrides(overrides, companyId, companyValue['hrPermOverrides']);
      }
    }
  }

  // Override doğal anahtarı (companyId, username, resource, action) üzerinde
  // SON kazanır — DB unique kısıtı tek batch'te iki kez vurulamaz.
  const byNaturalKey = new Map<string, AccessOverrideProjection>();
  for (const o of overrides.values()) {
    byNaturalKey.set(`${o.companyId} ${o.username} ${o.resource} ${o.action}`, o);
  }

  return {
    roles: [...roles.values()],
    grants: [...grants.values()],
    overrides: [...byNaturalKey.values()],
  };
}
