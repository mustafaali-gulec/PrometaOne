/**
 * PgWarehouseRepository — WarehouseRepository PG implementasyonu.
 * Tablo: warehouses (locations JSONB kolonunda taşınır).
 *
 * locations çocuk koleksiyonu ayrı tablo yerine JSONB olarak saklanır; entity
 * onu aggregate olarak serialize eder ve update'te tamamen yeniden yazar.
 * Tüm sorgular company_id ile multi-tenant izole edilir.
 * (production/PgBomRepository + finance/infrastructure desenleriyle aynı stil.)
 */
import type { Pool } from 'pg';

import type {
  NewWarehouseInput,
  WarehouseRepository,
} from '../../application/ports/WarehouseRepository.js';
import { Warehouse, type WarehouseLocation } from '../../domain/entities/Warehouse.js';
import type { WarehouseStatus } from '../../domain/valueObjects/WarehouseStatus.js';

interface WarehouseRow {
  id: number;
  company_id: number;
  code: string;
  name: string;
  unit_name: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  manager: string | null;
  status: WarehouseStatus;
  locations: WarehouseLocation[] | null;
  created_at: Date;
  updated_at: Date;
}

const WAREHOUSE_COLS =
  'id, company_id, code, name, unit_name, city, district, address, manager, status, locations, created_at, updated_at';

export class PgWarehouseRepository implements WarehouseRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewWarehouseInput): Promise<Warehouse> {
    const r = await this.pool.query<WarehouseRow>(
      `INSERT INTO warehouses
         (company_id, code, name, unit_name, city, district, address, manager, status, locations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING ${WAREHOUSE_COLS}`,
      [
        input.companyId,
        input.code,
        input.name,
        input.unitName,
        input.city,
        input.district,
        input.address,
        input.manager,
        input.status,
        JSON.stringify(input.locations),
      ],
    );
    return rowToWarehouse(r.rows[0]!);
  }

  async update(warehouse: Warehouse): Promise<void> {
    await this.pool.query(
      `UPDATE warehouses
          SET code = $1, name = $2, unit_name = $3, city = $4, district = $5,
              address = $6, manager = $7, status = $8, locations = $9::jsonb,
              updated_at = NOW()
        WHERE id = $10 AND company_id = $11`,
      [
        warehouse.code,
        warehouse.name,
        warehouse.unitName,
        warehouse.city,
        warehouse.district,
        warehouse.address,
        warehouse.manager,
        warehouse.status,
        JSON.stringify(warehouse.locations),
        warehouse.id,
        warehouse.companyId,
      ],
    );
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.pool.query('DELETE FROM warehouses WHERE id = $1 AND company_id = $2', [
      id,
      companyId,
    ]);
  }

  async findById(id: number, companyId: number): Promise<Warehouse | null> {
    const r = await this.pool.query<WarehouseRow>(
      `SELECT ${WAREHOUSE_COLS} FROM warehouses WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToWarehouse(row) : null;
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, code];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM warehouses
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
    options?: { status?: WarehouseStatus },
  ): Promise<ReadonlyArray<Warehouse>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    const r = await this.pool.query<WarehouseRow>(
      `SELECT ${WAREHOUSE_COLS} FROM warehouses
        WHERE ${conditions.join(' AND ')}
        ORDER BY code ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToWarehouse);
  }
}

function rowToWarehouse(row: WarehouseRow): Warehouse {
  return Warehouse.create({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    unitName: row.unit_name,
    city: row.city,
    district: row.district,
    address: row.address,
    manager: row.manager,
    status: row.status,
    locations: (row.locations ?? []).map((l) => ({
      id: l.id ?? null,
      code: l.code,
      name: l.name,
      room: l.room ?? null,
      aisle: l.aisle ?? null,
      shelf: l.shelf ?? null,
      bin: l.bin ?? null,
      status: l.status,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
