/**
 * PgPozCatalogRepository — PozCatalogRepository PG implementasyonu.
 * Tablo: cs_poz_catalog (024_cs_boq.sql).
 */
import type {
  ListPozOptions,
  NewPozInput,
  PozCatalogRepository,
} from '../../application/ports/PozCatalogRepository.js';
import { Poz } from '../../domain/entities/Poz.js';

import type { Queryable } from './Queryable.js';

interface PozRow {
  id: number;
  company_id: number;
  poz_no: string;
  name: string;
  unit: string;
  unit_price: string;
  source: string | null;
  year: number | null;
  active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, poz_no, name, unit, unit_price, source, year, active, created_by, created_at, updated_at';

export class PgPozCatalogRepository implements PozCatalogRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewPozInput): Promise<Poz> {
    const r = await this.db.query<PozRow>(
      `INSERT INTO cs_poz_catalog
         (company_id, poz_no, name, unit, unit_price, source, year, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.pozNo,
        input.name,
        input.unit,
        input.unitPrice,
        input.source,
        input.year,
        input.createdBy,
      ],
    );
    return rowToPoz(r.rows[0]!);
  }

  async update(poz: Poz): Promise<void> {
    await this.db.query(
      `UPDATE cs_poz_catalog
         SET name = $1, unit = $2, unit_price = $3, source = $4, year = $5,
             active = $6, updated_at = NOW()
       WHERE id = $7 AND company_id = $8`,
      [poz.name, poz.unit, poz.unitPrice, poz.source, poz.year, poz.active, poz.id, poz.companyId],
    );
  }

  async findById(id: number, companyId: number): Promise<Poz | null> {
    const r = await this.db.query<PozRow>(
      `SELECT ${COLS} FROM cs_poz_catalog WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToPoz(row) : null;
  }

  async listByCompany(companyId: number, options?: ListPozOptions): Promise<ReadonlyArray<Poz>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.includeInactive !== true) {
      conditions.push('active = TRUE');
    }
    if (options?.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(name ILIKE $${params.length} OR poz_no ILIKE $${params.length})`);
    }
    const r = await this.db.query<PozRow>(
      `SELECT ${COLS} FROM cs_poz_catalog
        WHERE ${conditions.join(' AND ')}
        ORDER BY poz_no ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToPoz);
  }

  async existsByPozNo(
    companyId: number,
    pozNo: string,
    year: number | null,
    excludeId?: number,
  ): Promise<boolean> {
    const params: unknown[] = [companyId, pozNo, year];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM cs_poz_catalog
        WHERE company_id = $1 AND poz_no = $2 AND year IS NOT DISTINCT FROM $3`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.db.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }
}

function rowToPoz(row: PozRow): Poz {
  return Poz.create({
    id: Number(row.id),
    companyId: row.company_id,
    pozNo: row.poz_no,
    name: row.name,
    unit: row.unit,
    unitPrice: Number(row.unit_price),
    source: row.source,
    year: row.year,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
