/**
 * PgReportRunRepository — ReportRunRepository PG implementasyonu.
 * Tablo: report_runs (append-only, metadata-only). ANA RW pool kullanır.
 */
import type { Pool } from 'pg';

import type {
  NewReportRun,
  ReportRun,
  ReportRunRepository,
} from '../../application/ports/ReportRunRepository.js';
import type { ReportMode, ReportRunStatus } from '../../domain/valueObjects/ReportEnums.js';

interface RunRow {
  id: string; // BIGSERIAL → string
  company_id: number;
  report_id: number | null;
  mode: ReportMode;
  status: ReportRunStatus;
  row_count: number | null;
  duration_ms: number | null;
  truncated: boolean;
  sql_hash: string | null;
  error_code: string | null;
  error_message: string | null;
  run_by: number | null;
  created_at: Date;
}

export class PgReportRunRepository implements ReportRunRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewReportRun): Promise<{ id: number }> {
    const r = await this.pool.query<{ id: string }>(
      `INSERT INTO report_runs
         (company_id, report_id, mode, status, row_count, duration_ms, truncated,
          sql_hash, error_code, error_message, run_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        input.companyId,
        input.reportId,
        input.mode,
        input.status,
        input.rowCount,
        input.durationMs,
        input.truncated,
        input.sqlHash,
        input.errorCode,
        input.errorMessage?.slice(0, 2000) ?? null,
        input.runBy,
      ],
    );
    return { id: Number(r.rows[0]!.id) };
  }

  async listByCompany(companyId: number, limit = 100): Promise<ReadonlyArray<ReportRun>> {
    const r = await this.pool.query<RunRow>(
      `SELECT id, company_id, report_id, mode, status, row_count, duration_ms, truncated,
              sql_hash, error_code, error_message, run_by, created_at
         FROM report_runs
        WHERE company_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [companyId, Math.min(Math.max(limit, 1), 1000)],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      companyId: row.company_id,
      reportId: row.report_id,
      mode: row.mode,
      status: row.status,
      rowCount: row.row_count,
      durationMs: row.duration_ms,
      truncated: row.truncated,
      sqlHash: row.sql_hash,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      runBy: row.run_by,
      createdAt: row.created_at,
    }));
  }
}
