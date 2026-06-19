/**
 * PgProductionOrderRepository — ProductionOrderRepository PG implementasyonu.
 * Tablolar: production_orders + production_order_materials + production_order_operations.
 *
 * Insert aggregate'i tek transaction'da yazar (başlık + malzeme + operasyon).
 * Update yalnız başlık alanlarını günceller (durum/üretilen/maliyet); malzeme
 * ve operasyon satırları üretim emri oluşturulurken sabitlenir.
 */
import type { Pool } from 'pg';

import type {
  NewProductionOrderInput,
  ProductionOrderRepository,
} from '../../application/ports/ProductionOrderRepository.js';
import {
  ProductionOrder,
  type CostSnapshot,
  type ProductionOrderMaterial,
  type ProductionOrderOperation,
  type ProductionOrderPriority,
  type ProductionOrderSource,
} from '../../domain/entities/ProductionOrder.js';
import type { ProductionOrderStatusValue } from '../../domain/valueObjects/ProductionOrderStatus.js';

interface OrderRow {
  id: number;
  company_id: number;
  no: string;
  bom_id: number | null;
  product_material_ref: string;
  qty: string;
  unit: string | null;
  status: ProductionOrderStatusValue;
  planned_start: Date | string | null;
  planned_end: Date | string | null;
  warehouse_ref: string | null;
  priority: ProductionOrderPriority;
  source: ProductionOrderSource;
  produced_qty: string;
  scrap_qty: string;
  cost_snapshot: CostSnapshot | null;
  consumed: boolean;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

interface OrderMaterialRow {
  id: number;
  order_id: number;
  material_ref: string;
  required_qty: string;
  unit: string | null;
  consumed_qty: string;
}

interface OrderOperationRow {
  id: number;
  order_id: number;
  work_center_id: number | null;
  name: string;
  planned_min: string;
  status: 'pending' | 'done';
  seq: number;
}

const ORDER_COLS =
  'id, company_id, no, bom_id, product_material_ref, qty, unit, status, planned_start, planned_end, warehouse_ref, priority, source, produced_qty, scrap_qty, cost_snapshot, consumed, created_at, updated_at, completed_at';

export class PgProductionOrderRepository implements ProductionOrderRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewProductionOrderInput): Promise<ProductionOrder> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const head = await client.query<OrderRow>(
        `INSERT INTO production_orders
           (company_id, no, bom_id, product_material_ref, qty, unit, status,
            planned_start, planned_end, warehouse_ref, priority, source,
            produced_qty, scrap_qty, cost_snapshot, consumed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING ${ORDER_COLS}`,
        [
          input.companyId,
          input.no,
          input.bomId,
          input.productMaterialRef,
          input.qty,
          input.unit,
          input.status,
          input.plannedStart,
          input.plannedEnd,
          input.warehouseRef,
          input.priority,
          input.source,
          input.producedQty,
          input.scrapQty,
          input.costSnapshot ? JSON.stringify(input.costSnapshot) : null,
          input.consumed,
        ],
      );
      const orderId = head.rows[0]!.id;
      for (const m of input.materials) {
        await client.query(
          `INSERT INTO production_order_materials
             (order_id, material_ref, required_qty, unit, consumed_qty)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, m.materialRef, m.requiredQty, m.unit, m.consumedQty],
        );
      }
      for (const op of input.operations) {
        await client.query(
          `INSERT INTO production_order_operations
             (order_id, work_center_id, name, planned_min, status, seq)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [orderId, op.workCenterId, op.name, op.plannedMin, op.status, op.seq],
        );
      }
      await client.query('COMMIT');
      return await this.loadById(orderId, input.companyId);
    } catch (err) {
      await safeRollback(client);
      throw err;
    } finally {
      client.release();
    }
  }

  async update(order: ProductionOrder): Promise<void> {
    await this.pool.query(
      `UPDATE production_orders
          SET status = $1, planned_start = $2, planned_end = $3, warehouse_ref = $4,
              priority = $5, produced_qty = $6, scrap_qty = $7, cost_snapshot = $8,
              consumed = $9, completed_at = $10, updated_at = NOW()
        WHERE id = $11 AND company_id = $12`,
      [
        order.status,
        order.plannedStart,
        order.plannedEnd,
        order.warehouseRef,
        order.priority,
        order.producedQty,
        order.scrapQty,
        order.costSnapshot ? JSON.stringify(order.costSnapshot) : null,
        order.consumed,
        order.completedAt,
        order.id,
        order.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<ProductionOrder | null> {
    const head = await this.pool.query<OrderRow>(
      `SELECT ${ORDER_COLS} FROM production_orders WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    if (!head.rows[0]) {
      return null;
    }
    return this.loadById(id, companyId);
  }

  async listByCompany(
    companyId: number,
    options?: { status?: ProductionOrderStatusValue },
  ): Promise<ReadonlyArray<ProductionOrder>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    const heads = await this.pool.query<OrderRow>(
      `SELECT ${ORDER_COLS} FROM production_orders
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC, id DESC`,
      params,
    );
    if (heads.rows.length === 0) {
      return [];
    }
    const ids = heads.rows.map((h) => h.id);
    const { matsByOrder, opsByOrder } = await this.loadChildren(ids);
    return heads.rows.map((h) =>
      rowToOrder(h, matsByOrder.get(h.id) ?? [], opsByOrder.get(h.id) ?? []),
    );
  }

  async existsByNo(companyId: number, no: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, no];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM production_orders
        WHERE company_id = $1 AND LOWER(no) = LOWER($2)`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.pool.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }

  // --- yardımcılar ---------------------------------------------------------

  private async loadById(id: number, companyId: number): Promise<ProductionOrder> {
    const head = await this.pool.query<OrderRow>(
      `SELECT ${ORDER_COLS} FROM production_orders WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = head.rows[0]!;
    const { matsByOrder, opsByOrder } = await this.loadChildren([id]);
    return rowToOrder(row, matsByOrder.get(id) ?? [], opsByOrder.get(id) ?? []);
  }

  private async loadChildren(orderIds: number[]): Promise<{
    matsByOrder: Map<number, ProductionOrderMaterial[]>;
    opsByOrder: Map<number, ProductionOrderOperation[]>;
  }> {
    const mats = await this.pool.query<OrderMaterialRow>(
      `SELECT id, order_id, material_ref, required_qty, unit, consumed_qty
         FROM production_order_materials
        WHERE order_id = ANY($1::int[])
        ORDER BY id ASC`,
      [orderIds],
    );
    const ops = await this.pool.query<OrderOperationRow>(
      `SELECT id, order_id, work_center_id, name, planned_min, status, seq
         FROM production_order_operations
        WHERE order_id = ANY($1::int[])
        ORDER BY seq ASC, id ASC`,
      [orderIds],
    );

    const matsByOrder = new Map<number, ProductionOrderMaterial[]>();
    for (const m of mats.rows) {
      const list = matsByOrder.get(m.order_id) ?? [];
      list.push({
        id: m.id,
        materialRef: m.material_ref,
        requiredQty: Number(m.required_qty),
        unit: m.unit,
        consumedQty: Number(m.consumed_qty),
      });
      matsByOrder.set(m.order_id, list);
    }

    const opsByOrder = new Map<number, ProductionOrderOperation[]>();
    for (const o of ops.rows) {
      const list = opsByOrder.get(o.order_id) ?? [];
      list.push({
        id: o.id,
        workCenterId: o.work_center_id,
        name: o.name,
        plannedMin: Number(o.planned_min),
        status: o.status,
        seq: o.seq,
      });
      opsByOrder.set(o.order_id, list);
    }

    return { matsByOrder, opsByOrder };
  }
}

async function safeRollback(client: { query: (q: string) => Promise<unknown> }): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // ROLLBACK hatası orijinal hatayı gölgelememeli
  }
}

/** DATE kolonu → YYYY-MM-DD string. pg DATE'i Date olarak döndürebilir. */
function toDateStr(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  // Zaten string ("YYYY-MM-DD" veya tam ISO) — ilk 10 karakteri al.
  return value.slice(0, 10);
}

function rowToOrder(
  row: OrderRow,
  materials: ProductionOrderMaterial[],
  operations: ProductionOrderOperation[],
): ProductionOrder {
  return ProductionOrder.create({
    id: row.id,
    companyId: row.company_id,
    no: row.no,
    bomId: row.bom_id,
    productMaterialRef: row.product_material_ref,
    qty: Number(row.qty),
    unit: row.unit,
    status: row.status,
    plannedStart: toDateStr(row.planned_start),
    plannedEnd: toDateStr(row.planned_end),
    warehouseRef: row.warehouse_ref,
    priority: row.priority,
    source: row.source,
    producedQty: Number(row.produced_qty),
    scrapQty: Number(row.scrap_qty),
    costSnapshot: row.cost_snapshot,
    consumed: row.consumed,
    materials,
    operations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  });
}
