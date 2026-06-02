/**
 * PgApplicationStageHistoryRepository — application_stage_history PG impl.
 *
 * Tablo: application_stage_history (012_hr.sql).
 *
 * Migration'da bir trigger var: applications.stage her değiştiğinde otomatik
 * satır ekler. Use-case'lerin explicit record() çağrısı için manuel insert
 * de destekleniyor (uzun vadede paralel yazılım için).
 */
import type {
  ApplicationStageHistoryEntry,
  ApplicationStageHistoryRepository,
  NewApplicationStageHistoryInput,
} from '../../application/ports/ApplicationStageHistoryRepository.js';
import type { RecruitmentStage } from '../../domain/valueObjects/RecruitmentStage.js';

import type { Queryable } from './Queryable.js';

interface HistoryRow {
  id: number;
  application_id: number;
  from_stage: RecruitmentStage | null;
  to_stage: RecruitmentStage;
  changed_by: number | null;
  changed_at: Date;
  note: string | null;
}

const COLS = 'id, application_id, from_stage, to_stage, changed_by, changed_at, note';

export class PgApplicationStageHistoryRepository implements ApplicationStageHistoryRepository {
  constructor(private readonly pool: Queryable) {}

  async findByApplication(
    applicationId: number,
  ): Promise<ReadonlyArray<ApplicationStageHistoryEntry>> {
    const r = await this.pool.query<HistoryRow>(
      `SELECT ${COLS} FROM application_stage_history
        WHERE application_id = $1
        ORDER BY changed_at ASC, id ASC`,
      [applicationId],
    );
    return r.rows.map(rowToEntry);
  }

  async record(input: NewApplicationStageHistoryInput): Promise<ApplicationStageHistoryEntry> {
    const r = await this.pool.query<HistoryRow>(
      `INSERT INTO application_stage_history
         (application_id, from_stage, to_stage, changed_by, changed_at, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLS}`,
      [
        input.applicationId,
        input.fromStage,
        input.toStage,
        input.changedBy,
        input.changedAt,
        input.note,
      ],
    );
    return rowToEntry(r.rows[0]!);
  }
}

function rowToEntry(row: HistoryRow): ApplicationStageHistoryEntry {
  return {
    id: row.id,
    applicationId: row.application_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    note: row.note,
  };
}
