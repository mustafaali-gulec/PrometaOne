/**
 * AdoptBlobHrOrgUseCase — blob (promet:data) HR org yapısının (hrOrgUnits +
 * hrDepartments) TEK SEFERLİK, İDEMPOTENT devralınması.
 * Emsal: purchasing/application/useCases/AdoptBlobPurchasing.ts.
 *
 * Girdi blob alan adlarıyla GEVŞEK gelir; bu use-case blob kayıtlarını
 * savunmacı coercion ile NormalizedAdopt* satırlara çevirir ve
 * AdoptHrOrgRepository.adoptAll'a (tek transaction) verir. Kimliksiz (id'siz)
 * veya adsız kayıtlar atlanır — client_id idempotens anahtarıdır ve
 * name NOT NULL + not-empty CHECK'i vardır.
 *
 * Şema uyum kuralları (HrProjection ile aynı):
 *   - (company_id, code) partial unique: batch içi çift kodda SON kazanır,
 *     öncekiler NULL'lanır. CRUD satırıyla çakışma repo'da 23505 → 409.
 *   - org_units parent self/cycle (çağrı-içi küme) kırılır → NULL
 *     (DB cycle trigger'ı transaction'ı bozmasın). Çağrı dışı parent'lar
 *     repo'da DB'den (önceki adopt) çözülür.
 *   - Kolonu olmayan alanlar taşınmaz (type, color, parentDeptId,
 *     authorizedUsers, org unit managerEmployeeId).
 */
import type {
  AdoptHrOrgInput,
  AdoptHrOrgResultDto,
  NormalizedAdoptDepartment,
  NormalizedAdoptOrgUnit,
} from '../dto/AdoptHrOrgDtos.js';
import type { AdoptHrOrgRepository } from '../ports/AdoptHrOrgRepository.js';

// ===== yardımcı coercion'lar ================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function idString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim().slice(0, max);
  return null;
}

// ===== normalizasyon ========================================================

function normalizeOrgUnit(raw: Record<string, unknown>): NormalizedAdoptOrgUnit | null {
  const clientId = idString(raw['id']);
  const name = text(raw['name'], 200);
  if (clientId === null || name === null) return null;
  return {
    clientId,
    name,
    code: text(raw['code'], 40),
    parentClientId: idString(raw['parentId']),
  };
}

function normalizeDepartment(raw: Record<string, unknown>): NormalizedAdoptDepartment | null {
  const clientId = idString(raw['id']);
  const name = text(raw['name'], 200);
  if (clientId === null || name === null) return null;
  return {
    clientId,
    name,
    code: text(raw['code'], 40),
    orgUnitClientId: idString(raw['orgUnitId']),
    managerEmployeeClientId: idString(raw['managerEmployeeId']),
  };
}

/** clientId çakışmasında SON kazanır (aynı batch'te dupe upsert hedefi olmasın). */
function dedupeByClientId<T extends { clientId: string }>(rows: ReadonlyArray<T>): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(row.clientId, row);
  return [...map.values()];
}

/** (company_id, code) partial unique: batch içi çift kodda öncekiler NULL'lanır. */
function dedupeCodes(rows: ReadonlyArray<{ code: string | null }>): void {
  const owner = new Map<string, { code: string | null }>();
  for (const row of rows) {
    if (row.code === null) continue;
    const prev = owner.get(row.code);
    if (prev !== undefined) prev.code = null; // SON kazanır
    owner.set(row.code, row);
  }
}

/**
 * Çağrı-içi self/cycle parent kırma (HrProjection kalıbı). Çağrı dışı
 * parent'lar (DB'de önceki adopt satırları) yürüyüşü sonlandırır — kök sayılır.
 */
function breakParentCycles(orgUnits: ReadonlyArray<NormalizedAdoptOrgUnit>): void {
  const byId = new Map(orgUnits.map((ou) => [ou.clientId, ou]));
  for (const ou of orgUnits) {
    if (ou.parentClientId === ou.clientId) ou.parentClientId = null;
  }
  for (const ou of orgUnits) {
    const seen = new Set<string>([ou.clientId]);
    let cursor = ou.parentClientId;
    while (cursor !== null) {
      if (seen.has(cursor)) {
        ou.parentClientId = null;
        break;
      }
      seen.add(cursor);
      cursor = byId.get(cursor)?.parentClientId ?? null;
    }
  }
}

// ===== use case =============================================================

export class AdoptBlobHrOrgUseCase {
  constructor(private readonly repo: AdoptHrOrgRepository) {}

  async execute(input: AdoptHrOrgInput): Promise<AdoptHrOrgResultDto> {
    const orgUnits = dedupeByClientId(
      (input.orgUnits ?? []).filter(isPlainObject).flatMap((raw) => {
        const ou = normalizeOrgUnit(raw);
        return ou ? [ou] : [];
      }),
    );
    const departments = dedupeByClientId(
      (input.departments ?? []).filter(isPlainObject).flatMap((raw) => {
        const d = normalizeDepartment(raw);
        return d ? [d] : [];
      }),
    );

    breakParentCycles(orgUnits);
    dedupeCodes(orgUnits);
    dedupeCodes(departments);

    if (orgUnits.length === 0 && departments.length === 0) {
      // Boş gövde — DB'ye hiç gitmeden boş sonuç (idempotent no-op).
      return {
        adopted: { orgUnits: 0, departments: 0 },
        idMap: { orgUnits: {}, departments: {} },
      };
    }

    const outcome = await this.repo.adoptAll(input.companyId, { orgUnits, departments });

    return {
      adopted: {
        orgUnits: Object.keys(outcome.orgUnitIdByClient).length,
        departments: Object.keys(outcome.departmentIdByClient).length,
      },
      idMap: {
        orgUnits: outcome.orgUnitIdByClient,
        departments: outcome.departmentIdByClient,
      },
    };
  }
}
