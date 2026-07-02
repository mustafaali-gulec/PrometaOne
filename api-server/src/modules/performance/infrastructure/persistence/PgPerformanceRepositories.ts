/**
 * PgPerfCycleRepository / PgPerfReviewRepository — Performans PORT'larının PG
 * implementasyonu. Tablolar: hr_perf_cycles, hr_perf_reviews
 * (040_hr_performance.sql).
 *
 * Upsert ON CONFLICT (id) iledir; cross-tenant id ele geçirmesine karşı
 * DO UPDATE yalnızca company_id eşleşiyorsa yazar (aksi halde sessiz no-op —
 * istemci-üretimi id'lerde çakışma pratikte imkânsız). timestamptz kolonları
 * ISO string kabul eder; okuma tarafında Date → ISO string'e çevrilir.
 */
import type {
  PerfCycleRepository,
  PerfReviewRepository,
} from '../../application/ports/PerformanceRepository.js';
import type { PerfCompetencyDef, PerfCycleStatus } from '../../domain/entities/PerfCycle.js';
import { PerfCycle } from '../../domain/entities/PerfCycle.js';
import type {
  PerfCompetency,
  PerfGoal,
  PerfRatingKey,
  PerfReviewStatus,
} from '../../domain/entities/PerfReview.js';
import { PerfReview } from '../../domain/entities/PerfReview.js';

import type { Queryable } from './Queryable.js';

function iso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function isoDateOnly(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

// ===== CYCLES ==============================================================

interface PerfCycleRow {
  id: string;
  company_id: number;
  name: string;
  period_start: Date | string | null;
  period_end: Date | string | null;
  status: PerfCycleStatus;
  self_assessment: boolean;
  competencies_enabled: boolean;
  scale_max: number;
  weight_goals: number;
  weight_competencies: number;
  competency_defs: PerfCompetencyDef[] | null;
  created_by: string | null;
  activated_at: Date | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const CYCLE_COLS =
  'id, company_id, name, period_start, period_end, status, self_assessment, competencies_enabled, scale_max, weight_goals, weight_competencies, competency_defs, created_by, activated_at, closed_at, created_at, updated_at';

export class PgPerfCycleRepository implements PerfCycleRepository {
  constructor(private readonly db: Queryable) {}

  async upsertMany(cycles: readonly PerfCycle[]): Promise<number> {
    let count = 0;
    for (const c of cycles) {
      const r = await this.db.query(
        `INSERT INTO hr_perf_cycles
           (id, company_id, name, period_start, period_end, status, self_assessment,
            competencies_enabled, scale_max, weight_goals, weight_competencies,
            competency_defs, created_by, activated_at, closed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, COALESCE($16::timestamptz, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           period_start = EXCLUDED.period_start,
           period_end = EXCLUDED.period_end,
           status = EXCLUDED.status,
           self_assessment = EXCLUDED.self_assessment,
           competencies_enabled = EXCLUDED.competencies_enabled,
           scale_max = EXCLUDED.scale_max,
           weight_goals = EXCLUDED.weight_goals,
           weight_competencies = EXCLUDED.weight_competencies,
           competency_defs = EXCLUDED.competency_defs,
           activated_at = EXCLUDED.activated_at,
           closed_at = EXCLUDED.closed_at
         WHERE hr_perf_cycles.company_id = EXCLUDED.company_id`,
        [
          c.id,
          c.companyId,
          c.name,
          c.periodStart,
          c.periodEnd,
          c.status,
          c.selfAssessment,
          c.competenciesEnabled,
          c.scaleMax,
          c.weightGoals,
          c.weightCompetencies,
          JSON.stringify(c.competencyDefs ?? []),
          c.createdBy,
          c.activatedAt,
          c.closedAt,
          c.createdAt,
        ],
      );
      count += r.rowCount ?? 0;
    }
    return count;
  }

  async pruneExcept(companyId: number, keepIds: readonly string[]): Promise<number> {
    const r = await this.db.query(
      `DELETE FROM hr_perf_cycles WHERE company_id = $1 AND NOT (id = ANY($2::varchar[]))`,
      [companyId, [...keepIds]],
    );
    return r.rowCount ?? 0;
  }

  async list(companyId: number): Promise<ReadonlyArray<PerfCycle>> {
    const r = await this.db.query<PerfCycleRow>(
      `SELECT ${CYCLE_COLS} FROM hr_perf_cycles WHERE company_id = $1 ORDER BY created_at DESC, id`,
      [companyId],
    );
    return r.rows.map(rowToPerfCycle);
  }
}

function rowToPerfCycle(row: PerfCycleRow): PerfCycle {
  return PerfCycle.create({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    periodStart: isoDateOnly(row.period_start),
    periodEnd: isoDateOnly(row.period_end),
    status: row.status,
    selfAssessment: row.self_assessment,
    competenciesEnabled: row.competencies_enabled,
    scaleMax: row.scale_max,
    weightGoals: row.weight_goals,
    weightCompetencies: row.weight_competencies,
    competencyDefs: row.competency_defs ?? [],
    createdBy: row.created_by,
    activatedAt: iso(row.activated_at),
    closedAt: iso(row.closed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

// ===== REVIEWS =============================================================

interface PerfReviewRow {
  id: string;
  company_id: number;
  cycle_id: string;
  employee_id: string;
  reviewer_user_id: string | null;
  status: PerfReviewStatus;
  goals: PerfGoal[] | null;
  competencies: PerfCompetency[] | null;
  self_overall_comment: string;
  manager_overall_comment: string;
  self_submitted_at: Date | null;
  manager_submitted_at: Date | null;
  manager_user_id: string | null;
  overall_score: string | number;
  rating_key: PerfRatingKey | null;
  calibrated_rating_key: PerfRatingKey | null;
  acknowledged_at: Date | null;
  acknowledged_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const REVIEW_COLS =
  'id, company_id, cycle_id, employee_id, reviewer_user_id, status, goals, competencies, self_overall_comment, manager_overall_comment, self_submitted_at, manager_submitted_at, manager_user_id, overall_score, rating_key, calibrated_rating_key, acknowledged_at, acknowledged_by, created_at, updated_at';

export class PgPerfReviewRepository implements PerfReviewRepository {
  constructor(private readonly db: Queryable) {}

  async upsertMany(reviews: readonly PerfReview[]): Promise<number> {
    let count = 0;
    for (const v of reviews) {
      const r = await this.db.query(
        `INSERT INTO hr_perf_reviews
           (id, company_id, cycle_id, employee_id, reviewer_user_id, status, goals,
            competencies, self_overall_comment, manager_overall_comment,
            self_submitted_at, manager_submitted_at, manager_user_id, overall_score,
            rating_key, calibrated_rating_key, acknowledged_at, acknowledged_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13,
                 $14, $15, $16, $17, $18, COALESCE($19::timestamptz, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           cycle_id = EXCLUDED.cycle_id,
           employee_id = EXCLUDED.employee_id,
           reviewer_user_id = EXCLUDED.reviewer_user_id,
           status = EXCLUDED.status,
           goals = EXCLUDED.goals,
           competencies = EXCLUDED.competencies,
           self_overall_comment = EXCLUDED.self_overall_comment,
           manager_overall_comment = EXCLUDED.manager_overall_comment,
           self_submitted_at = EXCLUDED.self_submitted_at,
           manager_submitted_at = EXCLUDED.manager_submitted_at,
           manager_user_id = EXCLUDED.manager_user_id,
           overall_score = EXCLUDED.overall_score,
           rating_key = EXCLUDED.rating_key,
           calibrated_rating_key = EXCLUDED.calibrated_rating_key,
           acknowledged_at = EXCLUDED.acknowledged_at,
           acknowledged_by = EXCLUDED.acknowledged_by
         WHERE hr_perf_reviews.company_id = EXCLUDED.company_id`,
        [
          v.id,
          v.companyId,
          v.cycleId,
          v.employeeId,
          v.reviewerUserId,
          v.status,
          JSON.stringify(v.goals ?? []),
          JSON.stringify(v.competencies ?? []),
          v.selfOverallComment,
          v.managerOverallComment,
          v.selfSubmittedAt,
          v.managerSubmittedAt,
          v.managerUserId,
          v.overallScore,
          v.ratingKey,
          v.calibratedRatingKey,
          v.acknowledgedAt,
          v.acknowledgedBy,
          v.createdAt,
        ],
      );
      count += r.rowCount ?? 0;
    }
    return count;
  }

  async pruneExcept(companyId: number, keepIds: readonly string[]): Promise<number> {
    const r = await this.db.query(
      `DELETE FROM hr_perf_reviews WHERE company_id = $1 AND NOT (id = ANY($2::varchar[]))`,
      [companyId, [...keepIds]],
    );
    return r.rowCount ?? 0;
  }

  async list(companyId: number, cycleId?: string): Promise<ReadonlyArray<PerfReview>> {
    const conditions = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (cycleId) {
      params.push(cycleId);
      conditions.push(`cycle_id = $${params.length}`);
    }
    const r = await this.db.query<PerfReviewRow>(
      `SELECT ${REVIEW_COLS} FROM hr_perf_reviews
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC, id`,
      params,
    );
    return r.rows.map(rowToPerfReview);
  }
}

function rowToPerfReview(row: PerfReviewRow): PerfReview {
  return PerfReview.create({
    id: row.id,
    companyId: row.company_id,
    cycleId: row.cycle_id,
    employeeId: row.employee_id,
    reviewerUserId: row.reviewer_user_id,
    status: row.status,
    goals: row.goals ?? [],
    competencies: row.competencies ?? [],
    selfOverallComment: row.self_overall_comment,
    managerOverallComment: row.manager_overall_comment,
    selfSubmittedAt: iso(row.self_submitted_at),
    managerSubmittedAt: iso(row.manager_submitted_at),
    managerUserId: row.manager_user_id,
    overallScore: Number(row.overall_score) || 0,
    ratingKey: row.rating_key,
    calibratedRatingKey: row.calibrated_rating_key,
    acknowledgedAt: iso(row.acknowledged_at),
    acknowledgedBy: row.acknowledged_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}
