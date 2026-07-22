/**
 * PgAdoptHrOrgRepository — AdoptHrOrgRepository PG implementasyonu.
 * Tablolar: org_units, departments (012_hr_core.sql + 047_hr_projection.sql
 * client_id kolonları). Emsal: purchasing PgAdoptBlobRepository.
 *
 * adoptAll TEK transaction'da (BEGIN/COMMIT/ROLLBACK):
 *   1. org_units upsert — ON CONFLICT (company_id, client_id) DO UPDATE;
 *      1. geçişte parent_id=NULL (cycle trigger'ı pas geçer).
 *   2. parent bağları 2. geçişte: önce bu çağrının haritası, sonra DB'deki
 *      mevcut client_id'ler (önceki adopt); çözülemezse NULL kalır.
 *   3. managerEmployeeClientId'ler employees.client_id'den (şirket kapsamlı)
 *      toplu çözülür; bulunamayan NULL.
 *   4. departments upsert — org_unit_id aynı iki kademeli çözümle.
 *
 * (company_id, code) partial unique çakışması (CRUD ile aynı kodda kayıt zaten
 * var) 23505 olarak yakalanır ve HrOrgAdoptConflictError'a çevrilir (409).
 */
import type {
  NormalizedAdoptDepartment,
  NormalizedAdoptOrgUnit,
} from '../../application/dto/AdoptHrOrgDtos.js';
import { HrOrgAdoptConflictError } from '../../application/errors/HrErrors.js';
import type {
  AdoptHrOrgOutcome,
  AdoptHrOrgPayload,
  AdoptHrOrgRepository,
} from '../../application/ports/AdoptHrOrgRepository.js';

/** pg.PoolClient'ın burada kullanılan alt kümesi (testte mock'lanabilir). */
export interface AdoptHrOrgPoolClient {
  query(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<{ rows?: unknown[]; rowCount?: number | null }>;
  release(): void;
}

/** pg.Pool'un burada kullanılan alt kümesi. */
export interface AdoptHrOrgPool {
  connect(): Promise<AdoptHrOrgPoolClient>;
}

function isUniqueViolation(err: unknown): err is { code: string; detail?: string } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505';
}

interface IdRow {
  id: number;
}

interface IdClientRow {
  id: number;
  client_id: string;
}

function firstIdOf(result: { rows?: unknown[] }): number | null {
  const row = result.rows?.[0] as IdRow | undefined;
  if (row === undefined) return null;
  const id = Number(row.id);
  return Number.isFinite(id) ? id : null;
}

export class PgAdoptHrOrgRepository implements AdoptHrOrgRepository {
  constructor(private readonly pool: AdoptHrOrgPool) {}

  async adoptAll(companyId: number, payload: AdoptHrOrgPayload): Promise<AdoptHrOrgOutcome> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const orgUnitIdByClient = await this.upsertOrgUnits(client, companyId, payload.orgUnits);
      await this.linkOrgUnitParents(client, companyId, payload.orgUnits, orgUnitIdByClient);
      const departmentIdByClient = await this.upsertDepartments(
        client,
        companyId,
        payload.departments,
        orgUnitIdByClient,
      );

      await client.query('COMMIT');
      return { orgUnitIdByClient, departmentIdByClient };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK hatası orijinal hatayı gölgelemesin
      }
      if (isUniqueViolation(err)) {
        throw new HrOrgAdoptConflictError(err.detail ?? 'kod benzersizlik çakışması');
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ===== ORG UNITS ==========================================================

  private async upsertOrgUnits(
    client: AdoptHrOrgPoolClient,
    companyId: number,
    orgUnits: ReadonlyArray<NormalizedAdoptOrgUnit>,
  ): Promise<Record<string, number>> {
    const idByClient: Record<string, number> = {};
    for (const ou of orgUnits) {
      // 1. geçiş: parent_id NULL — ebeveyn henüz upsert edilmemiş olabilir;
      // idempotent tekrar çağrıda da eski bağ sıfırlanıp 2. geçişte yeniden kurulur.
      const r = await client.query(
        `INSERT INTO org_units (company_id, name, code, parent_id, client_id)
         VALUES ($1, $2, $3, NULL, $4)
         ON CONFLICT (company_id, client_id)
         DO UPDATE SET name = EXCLUDED.name,
                       code = EXCLUDED.code,
                       parent_id = NULL,
                       updated_at = NOW()
         RETURNING id`,
        [companyId, ou.name, ou.code, ou.clientId],
      );
      const id = firstIdOf(r);
      if (id !== null) idByClient[ou.clientId] = id;
    }
    return idByClient;
  }

  private async linkOrgUnitParents(
    client: AdoptHrOrgPoolClient,
    companyId: number,
    orgUnits: ReadonlyArray<NormalizedAdoptOrgUnit>,
    idByClient: Readonly<Record<string, number>>,
  ): Promise<void> {
    // Bu çağrıda gelmeyen ama önceki adopt'ta yazılmış parent'lar DB'den çözülür.
    const resolved = new Map(Object.entries(idByClient));
    const missing = [
      ...new Set(
        orgUnits
          .map((ou) => ou.parentClientId)
          .filter((cid): cid is string => cid !== null && !resolved.has(cid)),
      ),
    ];
    if (missing.length > 0) {
      const res = await client.query(
        `SELECT id, client_id FROM org_units
          WHERE company_id = $1 AND client_id = ANY($2::text[])`,
        [companyId, missing],
      );
      for (const row of (res.rows ?? []) as IdClientRow[]) {
        resolved.set(row.client_id, Number(row.id));
      }
    }

    for (const ou of orgUnits) {
      if (ou.parentClientId === null) continue;
      const id = idByClient[ou.clientId];
      const parentId = resolved.get(ou.parentClientId);
      if (id === undefined || parentId === undefined || parentId === id) continue;
      await client.query('UPDATE org_units SET parent_id = $1 WHERE id = $2', [parentId, id]);
    }
  }

  // ===== DEPARTMENTS ========================================================

  private async upsertDepartments(
    client: AdoptHrOrgPoolClient,
    companyId: number,
    departments: ReadonlyArray<NormalizedAdoptDepartment>,
    orgUnitIdByClient: Readonly<Record<string, number>>,
  ): Promise<Record<string, number>> {
    // Org unit referansları: önce bu çağrının haritası, sonra DB (önceki adopt).
    const orgUnitMap = new Map(Object.entries(orgUnitIdByClient));
    const missingOrgUnits = [
      ...new Set(
        departments
          .map((d) => d.orgUnitClientId)
          .filter((cid): cid is string => cid !== null && !orgUnitMap.has(cid)),
      ),
    ];
    if (missingOrgUnits.length > 0) {
      const res = await client.query(
        `SELECT id, client_id FROM org_units
          WHERE company_id = $1 AND client_id = ANY($2::text[])`,
        [companyId, missingOrgUnits],
      );
      for (const row of (res.rows ?? []) as IdClientRow[]) {
        orgUnitMap.set(row.client_id, Number(row.id));
      }
    }

    // Yöneticiler: employees.client_id eşleşirse bağlanır (şirket kapsamlı), yoksa NULL.
    const managerClientIds = [
      ...new Set(
        departments
          .map((d) => d.managerEmployeeClientId)
          .filter((cid): cid is string => cid !== null),
      ),
    ];
    const employeeIdByClient = new Map<string, number>();
    if (managerClientIds.length > 0) {
      const res = await client.query(
        `SELECT id, client_id FROM employees
          WHERE company_id = $1 AND client_id = ANY($2::text[])`,
        [companyId, managerClientIds],
      );
      for (const row of (res.rows ?? []) as IdClientRow[]) {
        employeeIdByClient.set(row.client_id, Number(row.id));
      }
    }

    const idByClient: Record<string, number> = {};
    for (const d of departments) {
      const orgUnitId =
        d.orgUnitClientId !== null ? (orgUnitMap.get(d.orgUnitClientId) ?? null) : null;
      const managerId =
        d.managerEmployeeClientId !== null
          ? (employeeIdByClient.get(d.managerEmployeeClientId) ?? null)
          : null;
      const r = await client.query(
        `INSERT INTO departments
           (company_id, org_unit_id, name, code, manager_employee_id, client_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (company_id, client_id)
         DO UPDATE SET org_unit_id = EXCLUDED.org_unit_id,
                       name = EXCLUDED.name,
                       code = EXCLUDED.code,
                       manager_employee_id = EXCLUDED.manager_employee_id,
                       updated_at = NOW()
         RETURNING id`,
        [companyId, orgUnitId, d.name, d.code, managerId, d.clientId],
      );
      const id = firstIdOf(r);
      if (id !== null) idByClient[d.clientId] = id;
    }
    return idByClient;
  }
}
