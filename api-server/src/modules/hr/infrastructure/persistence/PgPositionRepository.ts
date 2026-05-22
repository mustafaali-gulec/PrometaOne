/**
 * PgPositionRepository — PositionRepository PG implementasyonu.
 *
 * Tablo: positions (012_hr.sql). PG NUMERIC alanlar string olarak döner,
 * domain'e geçirmeden Number'a parse edilir.
 */
import type { Pool } from 'pg';

import type {
  NewPositionInput,
  PositionRepository,
} from '../../application/ports/PositionRepository.js';
import { Position } from '../../domain/entities/Position.js';
import type { PositionStatus } from '../../domain/valueObjects/PositionStatus.js';

interface PositionRow {
  id: number;
  company_id: number;
  department_id: number | null;
  title: string;
  description: string | null;
  status: PositionStatus;
  headcount_target: number;
  min_salary: string | null;
  max_salary: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, department_id, title, description, status, headcount_target, min_salary, max_salary, created_at, updated_at';

export class PgPositionRepository implements PositionRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewPositionInput): Promise<Position> {
    const r = await this.pool.query<PositionRow>(
      `INSERT INTO positions
         (company_id, department_id, title, description, status,
          headcount_target, min_salary, max_salary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.departmentId,
        input.title,
        input.description,
        input.status,
        input.headcountTarget,
        input.minSalary,
        input.maxSalary,
      ],
    );
    return rowToPosition(r.rows[0]!);
  }

  async update(position: Position): Promise<void> {
    await this.pool.query(
      `UPDATE positions
         SET department_id = $1,
             title = $2,
             description = $3,
             status = $4,
             headcount_target = $5,
             min_salary = $6,
             max_salary = $7,
             updated_at = NOW()
       WHERE id = $8 AND company_id = $9`,
      [
        position.departmentId,
        position.title,
        position.description,
        position.status,
        position.headcountTarget,
        position.minSalary,
        position.maxSalary,
        position.id,
        position.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Position | null> {
    const r = await this.pool.query<PositionRow>(
      `SELECT ${COLS} FROM positions WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToPosition(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { status?: PositionStatus; departmentId?: number | null },
  ): Promise<ReadonlyArray<Position>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];

    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options?.departmentId !== undefined) {
      if (options.departmentId === null) {
        conditions.push('department_id IS NULL');
      } else {
        params.push(options.departmentId);
        conditions.push(`department_id = $${params.length}`);
      }
    }

    const r = await this.pool.query<PositionRow>(
      `SELECT ${COLS} FROM positions
        WHERE ${conditions.join(' AND ')}
        ORDER BY title ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToPosition);
  }

  async hasActiveEmployees(positionId: number, companyId: number): Promise<boolean> {
    const r = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM employees
          WHERE position_id = $1
            AND company_id = $2
            AND status <> 'terminated'
       ) AS exists`,
      [positionId, companyId],
    );
    return r.rows[0]?.exists ?? false;
  }
}

function rowToPosition(row: PositionRow): Position {
  return Position.create({
    id: row.id,
    companyId: row.company_id,
    departmentId: row.department_id,
    title: row.title,
    description: row.description,
    status: row.status,
    headcountTarget: row.headcount_target,
    minSalary: row.min_salary === null ? null : Number(row.min_salary),
    maxSalary: row.max_salary === null ? null : Number(row.max_salary),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
