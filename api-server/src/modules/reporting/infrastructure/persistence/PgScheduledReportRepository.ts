/**
 * PgScheduledReportRepository — ScheduledReportRepository PG implementasyonu.
 * Tablo: scheduled_reports. recipients text[], param_values jsonb. ANA RW pool.
 */
import type { Pool } from 'pg';

import type {
  NewScheduledReport,
  ScheduledReport,
  ScheduledReportRepository,
  ScheduleFrequency,
  UpdateScheduledReportFields,
} from '../../application/ports/ScheduledReportRepository.js';
import type { ReportRunStatus } from '../../domain/valueObjects/ReportEnums.js';

interface SchedRow {
  id: number;
  company_id: number;
  report_id: number;
  frequency: ScheduleFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  recipients: string[] | null;
  param_values: Record<string, unknown> | null;
  format: string;
  enabled: boolean;
  last_run_at: Date | null;
  last_status: ReportRunStatus | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, report_id, frequency, day_of_week, day_of_month, time_of_day, recipients, param_values, format, enabled, last_run_at, last_status, created_by, created_at, updated_at';

export class PgScheduledReportRepository implements ScheduledReportRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewScheduledReport): Promise<ScheduledReport> {
    const r = await this.pool.query<SchedRow>(
      `INSERT INTO scheduled_reports
         (company_id, report_id, frequency, day_of_week, day_of_month, time_of_day,
          recipients, param_values, format, enabled, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.reportId,
        input.frequency,
        input.dayOfWeek,
        input.dayOfMonth,
        input.timeOfDay,
        input.recipients,
        JSON.stringify(input.paramValues ?? {}),
        input.format,
        input.enabled,
        input.createdBy,
      ],
    );
    return rowToSched(r.rows[0]!);
  }

  async update(
    id: number,
    companyId: number,
    fields: UpdateScheduledReportFields,
  ): Promise<ScheduledReport | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    const push = (col: string, val: unknown, cast = ''): void => {
      values.push(val);
      sets.push(`${col} = $${values.length}${cast}`);
    };
    if (fields.frequency !== undefined) push('frequency', fields.frequency);
    if (fields.dayOfWeek !== undefined) push('day_of_week', fields.dayOfWeek);
    if (fields.dayOfMonth !== undefined) push('day_of_month', fields.dayOfMonth);
    if (fields.timeOfDay !== undefined) push('time_of_day', fields.timeOfDay);
    if (fields.recipients !== undefined) push('recipients', fields.recipients);
    if (fields.paramValues !== undefined)
      push('param_values', JSON.stringify(fields.paramValues), '::jsonb');
    if (fields.format !== undefined) push('format', fields.format);
    if (fields.enabled !== undefined) push('enabled', fields.enabled);

    if (sets.length === 0) return this.findById(id, companyId);

    values.push(id, companyId);
    const r = await this.pool.query<SchedRow>(
      `UPDATE scheduled_reports SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length - 1} AND company_id = $${values.length}
        RETURNING ${COLS}`,
      values,
    );
    const row = r.rows[0];
    return row ? rowToSched(row) : null;
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.pool.query('DELETE FROM scheduled_reports WHERE id = $1 AND company_id = $2', [
      id,
      companyId,
    ]);
  }

  async findById(id: number, companyId: number): Promise<ScheduledReport | null> {
    const r = await this.pool.query<SchedRow>(
      `SELECT ${COLS} FROM scheduled_reports WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToSched(row) : null;
  }

  async listByCompany(
    companyId: number,
    reportId?: number,
  ): Promise<ReadonlyArray<ScheduledReport>> {
    const params: unknown[] = [companyId];
    let sql = `SELECT ${COLS} FROM scheduled_reports WHERE company_id = $1`;
    if (reportId !== undefined) {
      params.push(reportId);
      sql += ` AND report_id = $${params.length}`;
    }
    sql += ' ORDER BY id DESC';
    const r = await this.pool.query<SchedRow>(sql, params);
    return r.rows.map(rowToSched);
  }

  async listEnabled(): Promise<ReadonlyArray<ScheduledReport>> {
    const r = await this.pool.query<SchedRow>(
      `SELECT ${COLS} FROM scheduled_reports WHERE enabled = TRUE`,
    );
    return r.rows.map(rowToSched);
  }

  async markRun(id: number, status: ReportRunStatus, at: Date): Promise<void> {
    await this.pool.query(
      `UPDATE scheduled_reports SET last_run_at = $1, last_status = $2 WHERE id = $3`,
      [at, status, id],
    );
  }
}

function rowToSched(row: SchedRow): ScheduledReport {
  return {
    id: row.id,
    companyId: row.company_id,
    reportId: row.report_id,
    frequency: row.frequency,
    dayOfWeek: row.day_of_week,
    dayOfMonth: row.day_of_month,
    timeOfDay: row.time_of_day,
    recipients: row.recipients ?? [],
    paramValues: row.param_values ?? {},
    format: row.format,
    enabled: row.enabled,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
