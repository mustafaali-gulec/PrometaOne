/**
 * PgScheduleRepository — ScheduleRepository PG implementasyonu (FAZ 8).
 * Tablolar: cs_schedule_activities, cs_schedule_progress_log;
 * görünümler: cs_v_schedule_summary, cs_v_tracking_progress (006).
 *
 * BIGINT kolonları node-pg'de STRING döner — mapper Number() çevirir.
 */
import type { Pool } from 'pg';

import type {
  NewActivityInput,
  ProgressLogRow,
  ScheduleRepository,
  ScheduleSummaryRow,
} from '../../application/ports/ScheduleRepository.js';
import {
  ScheduleActivity,
  type ActivityKind,
  type ScheduleActivityProps,
} from '../../domain/entities/ScheduleActivity.js';

const n = (v: string | number | null): number | null =>
  v === null ? null : typeof v === 'number' ? v : Number(v);
const nn = (v: string | number): number => (typeof v === 'number' ? v : Number(v));

interface ActivityRow {
  id: string;
  company_id: number;
  project_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  kind: ActivityKind;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  progress_pct: string;
  weight_pct: string;
  tracking_id: string | null;
  boq_line_id: string | null;
  location_id: string | null;
  depends_on: string | null;
  sort_order: number;
  note: string | null;
  active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, project_id, parent_id, code, name, kind, ' +
  'planned_start::text AS planned_start, planned_end::text AS planned_end, ' +
  'actual_start::text AS actual_start, actual_end::text AS actual_end, ' +
  'progress_pct, weight_pct, tracking_id, boq_line_id, location_id, depends_on, ' +
  'sort_order, note, active, created_by, created_at, updated_at';

function toActivity(r: ActivityRow): ScheduleActivity {
  const props: ScheduleActivityProps = {
    id: nn(r.id),
    companyId: r.company_id,
    projectId: nn(r.project_id),
    parentId: n(r.parent_id),
    code: r.code,
    name: r.name,
    kind: r.kind,
    plannedStart: r.planned_start,
    plannedEnd: r.planned_end,
    actualStart: r.actual_start,
    actualEnd: r.actual_end,
    progressPct: Number(r.progress_pct),
    weightPct: Number(r.weight_pct),
    trackingId: n(r.tracking_id),
    boqLineId: n(r.boq_line_id),
    locationId: n(r.location_id),
    dependsOn: n(r.depends_on),
    sortOrder: r.sort_order,
    note: r.note,
    active: r.active,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return ScheduleActivity.create(props);
}

export class PgScheduleRepository implements ScheduleRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewActivityInput): Promise<ScheduleActivity> {
    const res = await this.pool.query<ActivityRow>(
      `INSERT INTO cs_schedule_activities
         (company_id, project_id, parent_id, code, name, kind, planned_start, planned_end,
          weight_pct, tracking_id, boq_line_id, location_id, depends_on, sort_order, note,
          created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.projectId,
        input.parentId,
        input.code,
        input.name,
        input.kind,
        input.plannedStart,
        input.plannedEnd,
        input.weightPct,
        input.trackingId,
        input.boqLineId,
        input.locationId,
        input.dependsOn,
        input.sortOrder,
        input.note,
        input.createdBy,
      ],
    );
    return toActivity(res.rows[0]!);
  }

  async findById(id: number, companyId: number): Promise<ScheduleActivity | null> {
    const res = await this.pool.query<ActivityRow>(
      `SELECT ${COLS} FROM cs_schedule_activities WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toActivity(res.rows[0]);
  }

  async listByProject(
    projectId: number,
    companyId: number,
    options: { includeInactive?: boolean } = {},
  ): Promise<ReadonlyArray<ScheduleActivity>> {
    const res = await this.pool.query<ActivityRow>(
      `SELECT ${COLS} FROM cs_schedule_activities
        WHERE project_id = $1 AND company_id = $2 ${options.includeInactive === true ? '' : 'AND active'}
        ORDER BY sort_order, planned_start, id`,
      [projectId, companyId],
    );
    return res.rows.map(toActivity);
  }

  async update(activity: ScheduleActivity): Promise<ScheduleActivity> {
    const j = activity.toJSON();
    const res = await this.pool.query<ActivityRow>(
      `UPDATE cs_schedule_activities SET
         parent_id = $1, name = $2, kind = $3, planned_start = $4, planned_end = $5,
         actual_start = $6, actual_end = $7, progress_pct = $8, weight_pct = $9,
         tracking_id = $10, boq_line_id = $11, location_id = $12, depends_on = $13,
         sort_order = $14, note = $15, updated_at = NOW()
       WHERE id = $16 AND company_id = $17
       RETURNING ${COLS}`,
      [
        j.parentId,
        j.name,
        j.kind,
        j.plannedStart,
        j.plannedEnd,
        j.actualStart,
        j.actualEnd,
        j.progressPct,
        j.weightPct,
        j.trackingId,
        j.boqLineId,
        j.locationId,
        j.dependsOn,
        j.sortOrder,
        j.note,
        j.id,
        j.companyId,
      ],
    );
    return toActivity(res.rows[0]!);
  }

  async childCount(id: number, companyId: number): Promise<number> {
    const res = await this.pool.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM cs_schedule_activities
        WHERE parent_id = $1 AND company_id = $2 AND active`,
      [id, companyId],
    );
    return Number(res.rows[0]!.cnt);
  }

  async deactivate(id: number, companyId: number): Promise<void> {
    await this.pool.query(
      `UPDATE cs_schedule_activities SET active = FALSE, updated_at = NOW()
        WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
  }

  async saveProgress(
    activity: ScheduleActivity,
    asOf: string,
    note: string | null,
    actor: number | null,
  ): Promise<void> {
    const j = activity.toJSON();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE cs_schedule_activities SET
           progress_pct = $1, actual_start = $2, actual_end = $3, updated_at = NOW()
         WHERE id = $4 AND company_id = $5`,
        [j.progressPct, j.actualStart, j.actualEnd, j.id, j.companyId],
      );
      // Aynı güne ikinci kayıt ÜZERİNE YAZAR — düzeltmedir, yeni ölçüm değil.
      await client.query(
        `INSERT INTO cs_schedule_progress_log
           (company_id, activity_id, as_of, progress_pct, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (activity_id, as_of)
         DO UPDATE SET progress_pct = EXCLUDED.progress_pct, note = EXCLUDED.note,
                       created_by = EXCLUDED.created_by, created_at = NOW()`,
        [j.companyId, j.id, asOf, j.progressPct, note, actor],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async progressLog(activityId: number, companyId: number): Promise<ReadonlyArray<ProgressLogRow>> {
    return this.logRows('l.activity_id = $2', [activityId], companyId);
  }

  async progressLogByProject(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<ProgressLogRow>> {
    return this.logRows(
      'l.activity_id IN (SELECT id FROM cs_schedule_activities WHERE project_id = $2 AND active)',
      [projectId],
      companyId,
    );
  }

  private async logRows(
    cond: string,
    params: unknown[],
    companyId: number,
  ): Promise<ProgressLogRow[]> {
    const res = await this.pool.query<{
      id: string;
      activity_id: string;
      as_of: string;
      progress_pct: string;
      note: string | null;
      created_by: number | null;
      created_at: Date;
    }>(
      `SELECT l.id, l.activity_id, l.as_of::text AS as_of, l.progress_pct, l.note,
              l.created_by, l.created_at
         FROM cs_schedule_progress_log l
        WHERE l.company_id = $1 AND ${cond}
        ORDER BY l.as_of, l.id`,
      [companyId, ...params],
    );
    return res.rows.map((r) => ({
      id: nn(r.id),
      activityId: nn(r.activity_id),
      asOf: r.as_of,
      progressPct: Number(r.progress_pct),
      note: r.note,
      createdBy: r.created_by,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async summary(projectId: number, companyId: number): Promise<ScheduleSummaryRow | null> {
    const res = await this.pool.query<{
      project_id: string;
      task_count: string;
      done_count: string;
      overdue_count: string;
      not_started_late_count: string;
      project_start: string | null;
      project_end: string | null;
    }>(
      `SELECT project_id, task_count, done_count, overdue_count, not_started_late_count,
              project_start::text AS project_start, project_end::text AS project_end
         FROM cs_v_schedule_summary WHERE company_id = $1 AND project_id = $2`,
      [companyId, projectId],
    );
    const r = res.rows[0];
    if (r === undefined) return null;
    return {
      projectId: nn(r.project_id),
      taskCount: Number(r.task_count),
      doneCount: Number(r.done_count),
      overdueCount: Number(r.overdue_count),
      notStartedLateCount: Number(r.not_started_late_count),
      projectStart: r.project_start,
      projectEnd: r.project_end,
    };
  }

  async trackingProgress(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyMap<number, number>> {
    const res = await this.pool.query<{ tracking_id: string; progress_pct: string | null }>(
      `SELECT tracking_id, progress_pct FROM cs_v_tracking_progress
        WHERE company_id = $1 AND project_id = $2`,
      [companyId, projectId],
    );
    const map = new Map<number, number>();
    for (const r of res.rows) {
      if (r.progress_pct !== null) map.set(nn(r.tracking_id), Number(r.progress_pct));
    }
    return map;
  }
}
