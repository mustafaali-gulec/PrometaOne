/**
 * PgMaterialGroupRepository — MaterialGroupRepository PG implementasyonu.
 * Tablo: material_groups. Tüm sorgular company_id ile multi-tenant izole edilir.
 */
import type { Pool } from 'pg';

import type {
  MaterialGroupRepository,
  NewMaterialGroupInput,
} from '../../application/ports/MaterialGroupRepository.js';
import { MaterialGroup } from '../../domain/entities/MaterialGroup.js';
import type { GroupStatus } from '../../domain/valueObjects/AuxStatuses.js';

interface GroupRow {
  id: number;
  company_id: number;
  code: string;
  name: string;
  status: GroupStatus;
  created_at: Date;
  updated_at: Date;
}

const GROUP_COLS = 'id, company_id, code, name, status, created_at, updated_at';

export class PgMaterialGroupRepository implements MaterialGroupRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewMaterialGroupInput): Promise<MaterialGroup> {
    const r = await this.pool.query<GroupRow>(
      `INSERT INTO material_groups (company_id, code, name, status)
       VALUES ($1, $2, $3, $4)
       RETURNING ${GROUP_COLS}`,
      [input.companyId, input.code, input.name, input.status],
    );
    return rowToGroup(r.rows[0]!);
  }

  async update(group: MaterialGroup): Promise<void> {
    await this.pool.query(
      `UPDATE material_groups
          SET code = $1, name = $2, status = $3, updated_at = NOW()
        WHERE id = $4 AND company_id = $5`,
      [group.code, group.name, group.status, group.id, group.companyId],
    );
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.pool.query('DELETE FROM material_groups WHERE id = $1 AND company_id = $2', [
      id,
      companyId,
    ]);
  }

  async findById(id: number, companyId: number): Promise<MaterialGroup | null> {
    const r = await this.pool.query<GroupRow>(
      `SELECT ${GROUP_COLS} FROM material_groups WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToGroup(row) : null;
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, code];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM material_groups
        WHERE company_id = $1 AND lower(code) = lower($2)`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.pool.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }

  async listByCompany(
    companyId: number,
    options?: { status?: GroupStatus },
  ): Promise<ReadonlyArray<MaterialGroup>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    const r = await this.pool.query<GroupRow>(
      `SELECT ${GROUP_COLS} FROM material_groups
        WHERE ${conditions.join(' AND ')}
        ORDER BY code ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToGroup);
  }
}

function rowToGroup(row: GroupRow): MaterialGroup {
  return MaterialGroup.create({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
