/**
 * PgStockMovementRepository — StockMovementRepository PG implementasyonu.
 * Tablo: stock_movements (lots JSONB kolonunda taşınır).
 *
 * Stok bakiyesi SAKLANMAZ; hareketler listelenip StockLedger ile türetilir.
 * `warehouseId` filtresi bir deponun her rolünü (warehouse/from/to) kapsar.
 * Tüm sorgular company_id ile multi-tenant izole edilir.
 */
import type { Pool } from 'pg';

import type {
  MovementFilter,
  StockMovementRepository,
} from '../../application/ports/StockMovementRepository.js';
import { StockMovement, type MovementLot } from '../../domain/entities/StockMovement.js';
import type { MovementKind } from '../../domain/valueObjects/MovementKind.js';

interface MovementRow {
  id: number;
  company_id: number;
  no: string;
  kind: MovementKind;
  sub_type: string | null;
  date: Date | string;
  warehouse_id: number | null;
  from_warehouse_id: number | null;
  to_warehouse_id: number | null;
  material_id: number;
  qty: string;
  unit: string;
  factor: string;
  base_unit: string;
  base_qty: string;
  unit_price: string | null;
  unit_cost_base: string | null;
  total: string | null;
  lots: MovementLot[] | null;
  location_id: number | null;
  party_id: number | null;
  person: string | null;
  doc_no: string | null;
  note: string | null;
  created_by: number | null;
  created_at: Date;
}

const MOVEMENT_COLS =
  'id, company_id, no, kind, sub_type, date, warehouse_id, from_warehouse_id, ' +
  'to_warehouse_id, material_id, qty, unit, factor, base_unit, base_qty, ' +
  'unit_price, unit_cost_base, total, lots, location_id, party_id, person, ' +
  'doc_no, note, created_by, created_at';

export class PgStockMovementRepository implements StockMovementRepository {
  constructor(private readonly pool: Pool) {}

  async insert(movement: StockMovement): Promise<StockMovement> {
    const r = await this.pool.query<MovementRow>(
      `INSERT INTO stock_movements
         (company_id, no, kind, sub_type, date, warehouse_id, from_warehouse_id,
          to_warehouse_id, material_id, qty, unit, factor, base_unit, base_qty,
          unit_price, unit_cost_base, total, lots, location_id, party_id, person,
          doc_no, note, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18::jsonb, $19, $20, $21,
               $22, $23, $24, $25)
       RETURNING ${MOVEMENT_COLS}`,
      [
        movement.companyId,
        movement.no,
        movement.kind,
        movement.subType,
        movement.date,
        movement.warehouseId,
        movement.fromWarehouseId,
        movement.toWarehouseId,
        movement.materialId,
        movement.qty,
        movement.unit,
        movement.factor,
        movement.baseUnit,
        movement.baseQty,
        movement.unitPrice,
        movement.unitCostBase,
        movement.total,
        JSON.stringify(movement.lots),
        movement.locationId,
        movement.partyId,
        movement.person,
        movement.docNo,
        movement.note,
        movement.createdBy,
        movement.createdAt,
      ],
    );
    return rowToMovement(r.rows[0]!);
  }

  async findById(id: number, companyId: number): Promise<StockMovement | null> {
    const r = await this.pool.query<MovementRow>(
      `SELECT ${MOVEMENT_COLS} FROM stock_movements WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToMovement(row) : null;
  }

  async list(companyId: number, filter?: MovementFilter): Promise<ReadonlyArray<StockMovement>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (filter?.materialId !== undefined) {
      params.push(filter.materialId);
      conditions.push(`material_id = $${params.length}`);
    }
    if (filter?.kind !== undefined) {
      params.push(filter.kind);
      conditions.push(`kind = $${params.length}`);
    }
    if (filter?.warehouseId !== undefined) {
      params.push(filter.warehouseId);
      const p = `$${params.length}`;
      conditions.push(
        `(warehouse_id = ${p} OR from_warehouse_id = ${p} OR to_warehouse_id = ${p})`,
      );
    }
    if (filter?.dateFrom !== undefined) {
      params.push(filter.dateFrom);
      conditions.push(`date >= $${params.length}`);
    }
    if (filter?.dateTo !== undefined) {
      params.push(filter.dateTo);
      conditions.push(`date <= $${params.length}`);
    }
    const r = await this.pool.query<MovementRow>(
      `SELECT ${MOVEMENT_COLS} FROM stock_movements
        WHERE ${conditions.join(' AND ')}
        ORDER BY date ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToMovement);
  }

  async listByMaterial(
    companyId: number,
    materialId: number,
  ): Promise<ReadonlyArray<StockMovement>> {
    const r = await this.pool.query<MovementRow>(
      `SELECT ${MOVEMENT_COLS} FROM stock_movements
        WHERE company_id = $1 AND material_id = $2
        ORDER BY date ASC, id ASC`,
      [companyId, materialId],
    );
    return r.rows.map(rowToMovement);
  }

  async warehouseHasMovements(companyId: number, warehouseId: number): Promise<boolean> {
    const r = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM stock_movements
          WHERE company_id = $1
            AND (warehouse_id = $2 OR from_warehouse_id = $2 OR to_warehouse_id = $2)
       ) AS exists`,
      [companyId, warehouseId],
    );
    return r.rows[0]?.exists ?? false;
  }

  async materialHasMovements(companyId: number, materialId: number): Promise<boolean> {
    const r = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM stock_movements WHERE company_id = $1 AND material_id = $2
       ) AS exists`,
      [companyId, materialId],
    );
    return r.rows[0]?.exists ?? false;
  }

  async nextSequence(companyId: number, kind: MovementKind, year: number): Promise<number> {
    // In-memory repo ile aynı semantik: ilgili yıl+tür için mevcut hareket sayısı + 1.
    const r = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM stock_movements
        WHERE company_id = $1 AND kind = $2
          AND date >= make_date($3, 1, 1) AND date < make_date($3 + 1, 1, 1)`,
      [companyId, kind, year],
    );
    return Number(r.rows[0]?.count ?? 0) + 1;
  }
}

/** DATE kolonu → YYYY-MM-DD string. pg DATE'i Date olarak döndürebilir. */
function toDateStr(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

/** NUMERIC → number | null. */
function num(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function rowToMovement(row: MovementRow): StockMovement {
  return StockMovement.create({
    id: row.id,
    companyId: row.company_id,
    no: row.no,
    kind: row.kind,
    subType: row.sub_type,
    date: toDateStr(row.date),
    warehouseId: row.warehouse_id,
    fromWarehouseId: row.from_warehouse_id,
    toWarehouseId: row.to_warehouse_id,
    materialId: row.material_id,
    qty: Number(row.qty),
    unit: row.unit,
    factor: Number(row.factor),
    baseUnit: row.base_unit,
    baseQty: Number(row.base_qty),
    unitPrice: num(row.unit_price),
    unitCostBase: num(row.unit_cost_base),
    total: num(row.total),
    lots: (row.lots ?? []).map((l) => ({
      no: l.no,
      qty: Number(l.qty),
      expiry: l.expiry ?? null,
    })),
    locationId: row.location_id,
    partyId: row.party_id,
    person: row.person,
    docNo: row.doc_no,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  });
}
