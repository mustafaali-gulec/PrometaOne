/**
 * PgUnitRepository — UnitRepository PG implementasyonu.
 * Tablo: units. Tüm sorgular company_id ile multi-tenant izole edilir.
 */
import type { Pool } from 'pg';

import type { NewUnitInput, UnitRepository } from '../../application/ports/UnitRepository.js';
import { Unit } from '../../domain/entities/Unit.js';

interface UnitRow {
  id: number;
  company_id: number;
  code: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

const UNIT_COLS = 'id, company_id, code, name, created_at, updated_at';

export class PgUnitRepository implements UnitRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewUnitInput): Promise<Unit> {
    const r = await this.pool.query<UnitRow>(
      `INSERT INTO units (company_id, code, name)
       VALUES ($1, $2, $3)
       RETURNING ${UNIT_COLS}`,
      [input.companyId, input.code, input.name],
    );
    return rowToUnit(r.rows[0]!);
  }

  async update(unit: Unit): Promise<void> {
    await this.pool.query(
      `UPDATE units
          SET code = $1, name = $2, updated_at = NOW()
        WHERE id = $3 AND company_id = $4`,
      [unit.code, unit.name, unit.id, unit.companyId],
    );
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.pool.query('DELETE FROM units WHERE id = $1 AND company_id = $2', [id, companyId]);
  }

  async findById(id: number, companyId: number): Promise<Unit | null> {
    const r = await this.pool.query<UnitRow>(
      `SELECT ${UNIT_COLS} FROM units WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToUnit(row) : null;
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, code];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM units
        WHERE company_id = $1 AND lower(code) = lower($2)`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.pool.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }

  async listByCompany(companyId: number): Promise<ReadonlyArray<Unit>> {
    const r = await this.pool.query<UnitRow>(
      `SELECT ${UNIT_COLS} FROM units
        WHERE company_id = $1
        ORDER BY code ASC, id ASC`,
      [companyId],
    );
    return r.rows.map(rowToUnit);
  }
}

function rowToUnit(row: UnitRow): Unit {
  return Unit.create({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
