/**
 * PgWorkCenterRepository — WorkCenterRepository PG implementasyonu.
 * Tablo: production_work_centers (033_production_mrp.sql).
 */
import type {
  NewWorkCenterInput,
  WorkCenterRepository,
} from '../../application/ports/WorkCenterRepository.js';
import { WorkCenter } from '../../domain/entities/WorkCenter.js';
import type { WorkCenterStatus } from '../../domain/valueObjects/WorkCenterStatus.js';

import type { Queryable } from './Queryable.js';

interface WorkCenterRow {
  id: number;
  company_id: number;
  code: string;
  name: string;
  daily_hours: string;
  cost_per_hour: string;
  status: WorkCenterStatus;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, code, name, daily_hours, cost_per_hour, status, created_at, updated_at';

export class PgWorkCenterRepository implements WorkCenterRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewWorkCenterInput): Promise<WorkCenter> {
    const r = await this.db.query<WorkCenterRow>(
      `INSERT INTO production_work_centers
         (company_id, code, name, daily_hours, cost_per_hour, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLS}`,
      [input.companyId, input.code, input.name, input.dailyHours, input.costPerHour, input.status],
    );
    return rowToWorkCenter(r.rows[0]!);
  }

  async update(workCenter: WorkCenter): Promise<void> {
    await this.db.query(
      `UPDATE production_work_centers
          SET code = $1, name = $2, daily_hours = $3, cost_per_hour = $4,
              status = $5, updated_at = NOW()
        WHERE id = $6 AND company_id = $7`,
      [
        workCenter.code,
        workCenter.name,
        workCenter.dailyHours,
        workCenter.costPerHour,
        workCenter.status,
        workCenter.id,
        workCenter.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<WorkCenter | null> {
    const r = await this.db.query<WorkCenterRow>(
      `SELECT ${COLS} FROM production_work_centers WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToWorkCenter(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { includeArchived?: boolean },
  ): Promise<ReadonlyArray<WorkCenter>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.includeArchived !== true) {
      conditions.push("status = 'active'");
    }
    const r = await this.db.query<WorkCenterRow>(
      `SELECT ${COLS} FROM production_work_centers
        WHERE ${conditions.join(' AND ')}
        ORDER BY code ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToWorkCenter);
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, code];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM production_work_centers
        WHERE company_id = $1 AND LOWER(code) = LOWER($2)`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.db.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }
}

function rowToWorkCenter(row: WorkCenterRow): WorkCenter {
  return WorkCenter.create({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    dailyHours: Number(row.daily_hours),
    costPerHour: Number(row.cost_per_hour),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
