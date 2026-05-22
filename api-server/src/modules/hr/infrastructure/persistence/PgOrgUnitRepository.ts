/**
 * PgOrgUnitRepository — OrgUnitRepository port'unun PostgreSQL implementasyonu.
 *
 * Tablo: org_units (012_hr.sql).
 * Multi-tenant: tüm sorgular companyId ile sınırlanır.
 */
import type { Pool } from 'pg';

import type {
  NewOrgUnitInput,
  OrgUnitRepository,
} from '../../application/ports/OrgUnitRepository.js';
import { OrgUnit } from '../../domain/entities/OrgUnit.js';
import { OrgUnitCode } from '../../domain/valueObjects/OrgUnitCode.js';

interface OrgUnitRow {
  id: number;
  company_id: number;
  parent_id: number | null;
  name: string;
  code: string | null;
  sort_order: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const COLS = 'id, company_id, parent_id, name, code, sort_order, active, created_at, updated_at';

export class PgOrgUnitRepository implements OrgUnitRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewOrgUnitInput): Promise<OrgUnit> {
    const r = await this.pool.query<OrgUnitRow>(
      `INSERT INTO org_units (company_id, parent_id, name, code, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLS}`,
      [input.companyId, input.parentId, input.name, input.code, input.sortOrder, input.active],
    );
    return rowToOrgUnit(r.rows[0]!);
  }

  async update(unit: OrgUnit): Promise<void> {
    await this.pool.query(
      `UPDATE org_units
         SET parent_id = $1,
             name = $2,
             code = $3,
             sort_order = $4,
             active = $5,
             updated_at = NOW()
       WHERE id = $6 AND company_id = $7`,
      [
        unit.parentId,
        unit.name,
        unit.code?.value ?? null,
        unit.sortOrder,
        unit.active,
        unit.id,
        unit.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<OrgUnit | null> {
    const r = await this.pool.query<OrgUnitRow>(
      `SELECT ${COLS} FROM org_units WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToOrgUnit(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { includeInactive?: boolean },
  ): Promise<ReadonlyArray<OrgUnit>> {
    const includeInactive = options?.includeInactive ?? false;
    const r = await this.pool.query<OrgUnitRow>(
      includeInactive
        ? `SELECT ${COLS} FROM org_units WHERE company_id = $1
             ORDER BY sort_order ASC, id ASC`
        : `SELECT ${COLS} FROM org_units WHERE company_id = $1 AND active = TRUE
             ORDER BY sort_order ASC, id ASC`,
      [companyId],
    );
    return r.rows.map(rowToOrgUnit);
  }

  async hasChildren(unitId: number, companyId: number): Promise<boolean> {
    const r = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM org_units
          WHERE parent_id = $1 AND company_id = $2
       ) AS exists`,
      [unitId, companyId],
    );
    return r.rows[0]?.exists ?? false;
  }
}

function rowToOrgUnit(row: OrgUnitRow): OrgUnit {
  return OrgUnit.create({
    id: row.id,
    companyId: row.company_id,
    parentId: row.parent_id,
    name: row.name,
    code: row.code ? OrgUnitCode.create(row.code) : null,
    sortOrder: row.sort_order,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
