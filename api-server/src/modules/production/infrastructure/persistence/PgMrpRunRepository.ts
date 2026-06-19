/**
 * PgMrpRunRepository — MrpRunRepository PG implementasyonu.
 * Tablo: production_mrp_runs (033_production_mrp.sql).
 *
 * params + result JSONB olarak saklanır; okurken JSON.parse gerekmez
 * (pg jsonb'yi parse edip JS objesi döndürür).
 */
import type {
  MrpRunRecord,
  MrpRunRepository,
  NewMrpRunInput,
} from '../../application/ports/MrpRunRepository.js';
import type { MrpParams, MrpResult } from '../../domain/services/MrpCalculator.js';

import type { Queryable } from './Queryable.js';

interface MrpRunRow {
  id: number;
  company_id: number;
  no: string;
  run_at: Date;
  params: MrpParams;
  result: MrpResult;
  created_at: Date;
}

const COLS = 'id, company_id, no, run_at, params, result, created_at';

export class PgMrpRunRepository implements MrpRunRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewMrpRunInput): Promise<MrpRunRecord> {
    const r = await this.db.query<MrpRunRow>(
      `INSERT INTO production_mrp_runs (company_id, no, run_at, params, result)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.no,
        input.runAt,
        JSON.stringify(input.params),
        JSON.stringify(input.result),
      ],
    );
    return rowToRecord(r.rows[0]!);
  }

  async listByCompany(
    companyId: number,
    options?: { limit?: number },
  ): Promise<ReadonlyArray<MrpRunRecord>> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const r = await this.db.query<MrpRunRow>(
      `SELECT ${COLS} FROM production_mrp_runs
        WHERE company_id = $1
        ORDER BY run_at DESC, id DESC
        LIMIT $2`,
      [companyId, limit],
    );
    return r.rows.map(rowToRecord);
  }
}

function rowToRecord(row: MrpRunRow): MrpRunRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    no: row.no,
    runAt: row.run_at,
    params: row.params,
    result: row.result,
    createdAt: row.created_at,
  };
}
