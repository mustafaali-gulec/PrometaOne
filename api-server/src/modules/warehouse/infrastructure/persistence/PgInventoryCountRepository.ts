/**
 * PgInventoryCountRepository — InventoryCountRepository PG implementasyonu.
 * Tablo: inventory_counts (items JSONB kolonunda taşınır).
 *
 * items çocuk koleksiyonu JSONB olarak saklanır; entity aggregate olarak
 * serialize eder. Tüm sorgular company_id ile multi-tenant izole edilir.
 */
import type { Pool } from 'pg';

import type {
  InventoryCountRepository,
  NewInventoryCountInput,
} from '../../application/ports/InventoryCountRepository.js';
import { InventoryCount, type InventoryCountItem } from '../../domain/entities/InventoryCount.js';
import type { InventoryCountStatus } from '../../domain/valueObjects/AuxStatuses.js';

interface CountRow {
  id: number;
  company_id: number;
  no: string;
  date: Date | string;
  warehouse_id: number;
  period: string | null;
  status: InventoryCountStatus;
  items: RawItem[] | null;
  created_at: Date;
  updated_at: Date;
}

interface RawItem {
  materialId: number;
  systemQty: number | string;
  countedQty: number | string;
}

const COUNT_COLS =
  'id, company_id, no, date, warehouse_id, period, status, items, created_at, updated_at';

export class PgInventoryCountRepository implements InventoryCountRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewInventoryCountInput): Promise<InventoryCount> {
    const r = await this.pool.query<CountRow>(
      `INSERT INTO inventory_counts
         (company_id, no, date, warehouse_id, period, status, items)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING ${COUNT_COLS}`,
      [
        input.companyId,
        input.no,
        input.date,
        input.warehouseId,
        input.period,
        input.status,
        JSON.stringify(input.items),
      ],
    );
    return rowToCount(r.rows[0]!);
  }

  async update(count: InventoryCount): Promise<void> {
    await this.pool.query(
      `UPDATE inventory_counts
          SET date = $1, warehouse_id = $2, period = $3, status = $4, items = $5::jsonb,
              updated_at = NOW()
        WHERE id = $6 AND company_id = $7`,
      [
        count.date,
        count.warehouseId,
        count.period,
        count.status,
        JSON.stringify(count.items),
        count.id,
        count.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<InventoryCount | null> {
    const r = await this.pool.query<CountRow>(
      `SELECT ${COUNT_COLS} FROM inventory_counts WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToCount(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { status?: InventoryCountStatus; warehouseId?: number },
  ): Promise<ReadonlyArray<InventoryCount>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options?.warehouseId !== undefined) {
      params.push(options.warehouseId);
      conditions.push(`warehouse_id = $${params.length}`);
    }
    const r = await this.pool.query<CountRow>(
      `SELECT ${COUNT_COLS} FROM inventory_counts
        WHERE ${conditions.join(' AND ')}
        ORDER BY date DESC, id DESC`,
      params,
    );
    return r.rows.map(rowToCount);
  }

  async nextSequence(companyId: number, year: number): Promise<number> {
    const r = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM inventory_counts
        WHERE company_id = $1
          AND date >= make_date($2, 1, 1) AND date < make_date($2 + 1, 1, 1)`,
      [companyId, year],
    );
    return Number(r.rows[0]?.count ?? 0) + 1;
  }
}

function toDateStr(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function rowToCount(row: CountRow): InventoryCount {
  return InventoryCount.create({
    id: row.id,
    companyId: row.company_id,
    no: row.no,
    date: toDateStr(row.date),
    warehouseId: row.warehouse_id,
    period: row.period,
    status: row.status,
    items: (row.items ?? []).map(
      (it): InventoryCountItem => ({
        materialId: it.materialId,
        systemQty: Number(it.systemQty),
        countedQty: Number(it.countedQty),
      }),
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
