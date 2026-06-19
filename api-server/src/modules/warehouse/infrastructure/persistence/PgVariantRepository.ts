/**
 * PgVariantRepository — VariantRepository PG implementasyonu.
 * Tablo: variants (options JSONB kolonunda taşınır).
 *
 * options çocuk koleksiyonu ayrı tablo yerine JSONB olarak saklanır; entity
 * onu aggregate olarak serialize eder ve update'te tamamen yeniden yazar.
 * Tüm sorgular company_id ile multi-tenant izole edilir.
 */
import type { Pool } from 'pg';

import type {
  NewVariantInput,
  VariantRepository,
} from '../../application/ports/VariantRepository.js';
import { Variant, type VariantOption } from '../../domain/entities/Variant.js';
import type { VariantStatus } from '../../domain/valueObjects/AuxStatuses.js';

interface VariantRow {
  id: number;
  company_id: number;
  code: string;
  name: string;
  status: VariantStatus;
  options: VariantOption[] | null;
  created_at: Date;
  updated_at: Date;
}

const VARIANT_COLS = 'id, company_id, code, name, status, options, created_at, updated_at';

export class PgVariantRepository implements VariantRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewVariantInput): Promise<Variant> {
    const r = await this.pool.query<VariantRow>(
      `INSERT INTO variants (company_id, code, name, status, options)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING ${VARIANT_COLS}`,
      [input.companyId, input.code, input.name, input.status, JSON.stringify(input.options)],
    );
    return rowToVariant(r.rows[0]!);
  }

  async update(variant: Variant): Promise<void> {
    await this.pool.query(
      `UPDATE variants
          SET code = $1, name = $2, status = $3, options = $4::jsonb, updated_at = NOW()
        WHERE id = $5 AND company_id = $6`,
      [
        variant.code,
        variant.name,
        variant.status,
        JSON.stringify(variant.options),
        variant.id,
        variant.companyId,
      ],
    );
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.pool.query('DELETE FROM variants WHERE id = $1 AND company_id = $2', [
      id,
      companyId,
    ]);
  }

  async findById(id: number, companyId: number): Promise<Variant | null> {
    const r = await this.pool.query<VariantRow>(
      `SELECT ${VARIANT_COLS} FROM variants WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToVariant(row) : null;
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, code];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM variants
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
    options?: { status?: VariantStatus },
  ): Promise<ReadonlyArray<Variant>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    const r = await this.pool.query<VariantRow>(
      `SELECT ${VARIANT_COLS} FROM variants
        WHERE ${conditions.join(' AND ')}
        ORDER BY code ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToVariant);
  }
}

function rowToVariant(row: VariantRow): Variant {
  return Variant.create({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    status: row.status,
    options: (row.options ?? []).map((o) => ({ code: o.code, name: o.name })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
