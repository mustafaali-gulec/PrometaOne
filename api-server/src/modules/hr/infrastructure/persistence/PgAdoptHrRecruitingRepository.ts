/**
 * PgAdoptHrRecruitingRepository — AdoptHrRecruitingRepository PG
 * implementasyonu. Tablolar: positions, candidates, applications
 * (012_hr.sql + 047_hr_projection.sql client_id kolonları).
 * Emsal: PgAdoptHrOrgRepository (org yazma-cutover'ı).
 *
 * adoptAll TEK transaction'da (BEGIN/COMMIT/ROLLBACK):
 *   1. Departman çözücü (yalnız departmentRef'li pozisyon varsa): şirketin
 *      departments kümesi (client_id haritası + geçerli sayısal id doğrulaması
 *      — departments MEZUN, FE önbelleği sunucu id taşıyabilir).
 *   2. positions upsert — ON CONFLICT (company_id, client_id) DO UPDATE;
 *      çözülemeyen departman NULL (nullable FK).
 *   3. candidates upsert — ON CONFLICT (company_id, client_id) DO UPDATE.
 *   4. applications: candidateRef/positionRef üç kademeli çözülür (bu çağrının
 *      haritası → DB'deki client_id [önceki adopt] → geçerli sayısal sunucu
 *      id); çözülemeyen başvuru DÜŞER (NOT NULL FK'lar), transaction bozulmaz.
 *   5. applications upsert — (company_id, client_id) anahtarıyla UPDATE→INSERT.
 *      uq_applications_active_unique (aktif (candidate, position) çifti)
 *      çakışmasında SON KAZANIR/DEVRALINIR:
 *        - kendi satırı yoksa → mevcut aktif satır adopt verisiyle güncellenip
 *          client_id'yi devralır (employees doğal-anahtar devralma kalıbı);
 *        - kendi satırı da varsa → çakışan aktif satır silinir (FK'lar
 *          güvenli: stage_history CASCADE, employees.source_application_id
 *          SET NULL), kendi satırı güncellenir. 500 atılmaz.
 *
 * Kalan 23505 (beklenmedik benzersizlik çakışması) 409'a çevrilir
 * (HrRecruitingAdoptConflictError).
 */
import type {
  NormalizedAdoptApplication,
  NormalizedAdoptCandidate,
  NormalizedAdoptPosition,
} from '../../application/dto/AdoptHrRecruitingDtos.js';
import { HrRecruitingAdoptConflictError } from '../../application/errors/HrErrors.js';
import type {
  AdoptHrRecruitingOutcome,
  AdoptHrRecruitingPayload,
  AdoptHrRecruitingRepository,
} from '../../application/ports/AdoptHrRecruitingRepository.js';
import { isTerminalStage } from '../../domain/valueObjects/RecruitmentStage.js';

/** pg.PoolClient'ın burada kullanılan alt kümesi (testte mock'lanabilir). */
export interface AdoptHrRecruitingPoolClient {
  query(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<{ rows?: unknown[]; rowCount?: number | null }>;
  release(): void;
}

/** pg.Pool'un burada kullanılan alt kümesi. */
export interface AdoptHrRecruitingPool {
  connect(): Promise<AdoptHrRecruitingPoolClient>;
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

const NUMERIC_ID_RE = /^[0-9]+$/;

export class PgAdoptHrRecruitingRepository implements AdoptHrRecruitingRepository {
  constructor(private readonly pool: AdoptHrRecruitingPool) {}

  async adoptAll(
    companyId: number,
    payload: AdoptHrRecruitingPayload,
  ): Promise<AdoptHrRecruitingOutcome> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const positionIdByClient = await this.upsertPositions(client, companyId, payload.positions);
      const candidateIdByClient = await this.upsertCandidates(
        client,
        companyId,
        payload.candidates,
      );
      const applicationIdByClient = await this.upsertApplications(
        client,
        companyId,
        payload.applications,
        positionIdByClient,
        candidateIdByClient,
      );

      await client.query('COMMIT');
      return { positionIdByClient, candidateIdByClient, applicationIdByClient };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK hatası orijinal hatayı gölgelemesin
      }
      if (isUniqueViolation(err)) {
        throw new HrRecruitingAdoptConflictError(err.detail ?? 'benzersizlik çakışması');
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ===== POSITIONS ==========================================================

  private async upsertPositions(
    client: AdoptHrRecruitingPoolClient,
    companyId: number,
    positions: ReadonlyArray<NormalizedAdoptPosition>,
  ): Promise<Record<string, number>> {
    const idByClient: Record<string, number> = {};
    if (positions.length === 0) return idByClient;

    // Departman çözücü: departments MEZUN — client_id haritası + geçerli
    // sayısal id kümesi (yalnız referanslı pozisyon varsa yüklenir).
    let deptByClientId: ReadonlyMap<string, number> | null = null;
    let deptValidIds: ReadonlySet<number> | null = null;
    if (positions.some((p) => p.departmentRef !== null)) {
      const res = await client.query(
        'SELECT id, client_id FROM departments WHERE company_id = $1',
        [companyId],
      );
      const byClient = new Map<string, number>();
      const valid = new Set<number>();
      for (const raw of res.rows ?? []) {
        const row = raw as { id: number; client_id: string | null };
        const id = Number(row.id);
        if (!Number.isFinite(id)) continue;
        valid.add(id);
        if (row.client_id !== null && row.client_id !== undefined) {
          byClient.set(row.client_id, id);
        }
      }
      deptByClientId = byClient;
      deptValidIds = valid;
    }

    for (const p of positions) {
      let departmentId: number | null = null;
      if (p.departmentRef !== null && deptByClientId !== null && deptValidIds !== null) {
        departmentId = deptByClientId.get(p.departmentRef) ?? null;
        if (departmentId === null && NUMERIC_ID_RE.test(p.departmentRef)) {
          const n = Number(p.departmentRef);
          if (deptValidIds.has(n)) departmentId = n; // FE önbelleği sunucu id'si
        }
      }
      const r = await client.query(
        `INSERT INTO positions
           (company_id, department_id, title, description, status, headcount_target,
            min_salary, max_salary, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (company_id, client_id)
         DO UPDATE SET department_id    = EXCLUDED.department_id,
                       title            = EXCLUDED.title,
                       description      = EXCLUDED.description,
                       status           = EXCLUDED.status,
                       headcount_target = EXCLUDED.headcount_target,
                       min_salary       = EXCLUDED.min_salary,
                       max_salary       = EXCLUDED.max_salary,
                       updated_at       = NOW()
         RETURNING id`,
        [
          companyId,
          departmentId,
          p.title,
          p.description,
          p.status,
          p.headcountTarget,
          p.minSalary,
          p.maxSalary,
          p.clientId,
        ],
      );
      const id = firstIdOf(r);
      if (id !== null) idByClient[p.clientId] = id;
    }
    return idByClient;
  }

  // ===== CANDIDATES =========================================================

  private async upsertCandidates(
    client: AdoptHrRecruitingPoolClient,
    companyId: number,
    candidates: ReadonlyArray<NormalizedAdoptCandidate>,
  ): Promise<Record<string, number>> {
    const idByClient: Record<string, number> = {};
    for (const c of candidates) {
      const r = await client.query(
        `INSERT INTO candidates
           (company_id, first_name, last_name, email, phone, source, cv_url, notes, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (company_id, client_id)
         DO UPDATE SET first_name = EXCLUDED.first_name,
                       last_name  = EXCLUDED.last_name,
                       email      = EXCLUDED.email,
                       phone      = EXCLUDED.phone,
                       source     = EXCLUDED.source,
                       cv_url     = EXCLUDED.cv_url,
                       notes      = EXCLUDED.notes,
                       updated_at = NOW()
         RETURNING id`,
        [
          companyId,
          c.firstName,
          c.lastName,
          c.email,
          c.phone,
          c.source,
          c.cvUrl,
          c.notes,
          c.clientId,
        ],
      );
      const id = firstIdOf(r);
      if (id !== null) idByClient[c.clientId] = id;
    }
    return idByClient;
  }

  // ===== APPLICATIONS =======================================================

  /**
   * candidateRef/positionRef çözümü: bu çağrının haritası → DB client_id
   * (önceki adopt) → geçerli sayısal sunucu id doğrulaması.
   */
  private async resolveRefs(
    client: AdoptHrRecruitingPoolClient,
    companyId: number,
    table: 'candidates' | 'positions',
    refs: ReadonlyArray<string>,
    inCall: Readonly<Record<string, number>>,
  ): Promise<Map<string, number>> {
    const resolved = new Map<string, number>(Object.entries(inCall));
    const missing = [...new Set(refs.filter((ref) => !resolved.has(ref)))];
    if (missing.length === 0) return resolved;

    const byClient = await client.query(
      `SELECT id, client_id FROM ${table}
        WHERE company_id = $1 AND client_id = ANY($2::text[])`,
      [companyId, missing],
    );
    for (const row of (byClient.rows ?? []) as IdClientRow[]) {
      resolved.set(row.client_id, Number(row.id));
    }

    const numeric = [
      ...new Set(
        missing.filter((ref) => !resolved.has(ref) && NUMERIC_ID_RE.test(ref)).map(Number),
      ),
    ];
    if (numeric.length > 0) {
      const byId = await client.query(
        `SELECT id FROM ${table} WHERE company_id = $1 AND id = ANY($2::int[])`,
        [companyId, numeric],
      );
      for (const row of (byId.rows ?? []) as IdRow[]) {
        resolved.set(String(row.id), Number(row.id));
      }
    }
    return resolved;
  }

  private async upsertApplications(
    client: AdoptHrRecruitingPoolClient,
    companyId: number,
    applications: ReadonlyArray<NormalizedAdoptApplication>,
    positionIdByClient: Readonly<Record<string, number>>,
    candidateIdByClient: Readonly<Record<string, number>>,
  ): Promise<Record<string, number>> {
    const idByClient: Record<string, number> = {};
    if (applications.length === 0) return idByClient;

    const candidateIds = await this.resolveRefs(
      client,
      companyId,
      'candidates',
      applications.map((a) => a.candidateRef),
      candidateIdByClient,
    );
    const positionIds = await this.resolveRefs(
      client,
      companyId,
      'positions',
      applications.map((a) => a.positionRef),
      positionIdByClient,
    );

    let unresolved = 0;
    for (const a of applications) {
      const candidateId = candidateIds.get(a.candidateRef);
      const positionId = positionIds.get(a.positionRef);
      if (candidateId === undefined || positionId === undefined) {
        unresolved += 1; // candidate_id/position_id NOT NULL — düşer
        continue;
      }

      // Kendi satırı (önceki adopt) — idempotens anahtarı (company_id, client_id).
      const own = await client.query(
        'SELECT id FROM applications WHERE company_id = $1 AND client_id = $2',
        [companyId, a.clientId],
      );
      const ownId = firstIdOf(own);

      // uq_applications_active_unique: hedef stage aktifse mevcut aktif satır
      // aranır — çakışmada SON kazanır/devralınır (500 yerine).
      let conflictId: number | null = null;
      if (!isTerminalStage(a.stage)) {
        const conflict = await client.query(
          `SELECT id FROM applications
            WHERE company_id = $1 AND candidate_id = $2 AND position_id = $3
              AND stage NOT IN ('hired', 'rejected', 'withdrawn')
              AND id IS DISTINCT FROM $4
            LIMIT 1`,
          [companyId, candidateId, positionId, ownId],
        );
        conflictId = firstIdOf(conflict);
      }

      const fieldValues = [
        companyId,
        candidateId,
        positionId,
        a.stage,
        a.stageChangedAt,
        a.rejectionReason,
        a.salaryExpectation,
        a.notes,
        a.clientId,
      ];

      let id: number | null = null;
      if (conflictId !== null && ownId === null) {
        // Devralma: mevcut aktif satır adopt verisiyle güncellenir, client_id'yi alır.
        const r = await client.query(
          `UPDATE applications
              SET company_id = $1, candidate_id = $2, position_id = $3, stage = $4,
                  stage_changed_at = COALESCE($5::timestamptz, stage_changed_at),
                  rejection_reason = $6, salary_expectation = $7, notes = $8,
                  client_id = $9, updated_at = NOW()
            WHERE id = $10
            RETURNING id`,
          [...fieldValues, conflictId],
        );
        id = firstIdOf(r);
      } else {
        if (conflictId !== null && ownId !== null) {
          // SON kazanır: kendi satırı aktifleşirken çakışan aktif satır silinir
          // (stage_history CASCADE, employees.source_application_id SET NULL).
          await client.query('DELETE FROM applications WHERE id = $1', [conflictId]);
        }
        if (ownId !== null) {
          const r = await client.query(
            `UPDATE applications
                SET company_id = $1, candidate_id = $2, position_id = $3, stage = $4,
                    stage_changed_at = COALESCE($5::timestamptz, stage_changed_at),
                    rejection_reason = $6, salary_expectation = $7, notes = $8,
                    client_id = $9, updated_at = NOW()
              WHERE id = $10
              RETURNING id`,
            [...fieldValues, ownId],
          );
          id = firstIdOf(r);
        } else {
          const r = await client.query(
            `INSERT INTO applications
               (company_id, candidate_id, position_id, stage, stage_changed_at,
                rejection_reason, salary_expectation, notes, client_id)
             VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6, $7, $8, $9)
             RETURNING id`,
            fieldValues,
          );
          id = firstIdOf(r);
        }
      }
      if (id !== null) idByClient[a.clientId] = id;
    }
    if (unresolved > 0) {
      console.error(
        `[hr:recruiting-adopt] ${unresolved} başvuru düşürüldü (candidate/position çözülemedi)`,
      );
    }
    return idByClient;
  }
}
