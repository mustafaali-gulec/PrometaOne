/**
 * PgPurchaseOrderRepository — PurchaseOrderRepository PG implementasyonu.
 * Tablolar: purchase_orders, purchase_order_lines (022_purchasing.sql).
 *
 * insert/update header + lines'ı tek transaction'da yazar (Pool.connect).
 */
import type { Pool, PoolClient } from 'pg';

import type {
  ListPurchaseOrdersOptions,
  NewPurchaseOrderInput,
  PurchaseOrderRepository,
} from '../../application/ports/PurchaseOrderRepository.js';
import { PurchaseOrder, type PurchaseOrderLine } from '../../domain/entities/PurchaseOrder.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { PoStatus } from '../../domain/valueObjects/PoStatus.js';

interface PoRow {
  id: number;
  company_id: number;
  po_no: string;
  vendor_id: number;
  pr_id: number | null;
  status: PoStatus;
  currency: CurrencyCode;
  note: string | null;
  ordered_at: Date | null;
  delivered_at: Date | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

interface LineRow {
  po_id: number;
  line_no: number;
  description: string;
  quantity: string;
  received_qty: string;
  unit_price: string;
}

const HCOLS =
  'id, company_id, po_no, vendor_id, pr_id, status, currency, note, ordered_at, delivered_at, created_by, created_at, updated_at';

export class PgPurchaseOrderRepository implements PurchaseOrderRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewPurchaseOrderInput): Promise<PurchaseOrder> {
    const total = round2(input.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query<PoRow>(
        `INSERT INTO purchase_orders
           (company_id, po_no, vendor_id, pr_id, status, currency, total_amount, note,
            ordered_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING ${HCOLS}`,
        [
          input.companyId,
          input.poNo,
          input.vendorId,
          input.prId,
          input.status,
          input.currency,
          total,
          input.note,
          input.orderedAt,
          input.createdBy,
        ],
      );
      const header = r.rows[0]!;
      await insertLines(client, header.id, input.lines);
      await client.query('COMMIT');
      return rowsToPo(header, input.lines);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(po: PurchaseOrder): Promise<void> {
    const j = po.toJSON();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE purchase_orders
           SET status = $1, currency = $2, total_amount = $3, note = $4,
               ordered_at = $5, delivered_at = $6, updated_at = NOW()
         WHERE id = $7 AND company_id = $8`,
        [
          j.status,
          j.currency,
          po.totalAmount,
          j.note,
          j.orderedAt,
          j.deliveredAt,
          j.id,
          j.companyId,
        ],
      );
      await client.query('DELETE FROM purchase_order_lines WHERE po_id = $1', [j.id]);
      await insertLines(client, j.id, j.lines);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: number, companyId: number): Promise<PurchaseOrder | null> {
    const r = await this.pool.query<PoRow>(
      `SELECT ${HCOLS} FROM purchase_orders WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const header = r.rows[0];
    if (!header) return null;
    const lines = await this.loadLines([header.id]);
    return rowsToPo(header, lines.get(header.id) ?? []);
  }

  async listByCompany(
    companyId: number,
    options?: ListPurchaseOrdersOptions,
  ): Promise<ReadonlyArray<PurchaseOrder>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options?.vendorId !== undefined) {
      params.push(options.vendorId);
      conditions.push(`vendor_id = $${params.length}`);
    }
    const r = await this.pool.query<PoRow>(
      `SELECT ${HCOLS} FROM purchase_orders
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC, id DESC`,
      params,
    );
    if (r.rows.length === 0) return [];
    const linesByPo = await this.loadLines(r.rows.map((h) => h.id));
    return r.rows.map((h) => rowsToPo(h, linesByPo.get(h.id) ?? []));
  }

  async countByNoPrefix(companyId: number, prefix: string): Promise<number> {
    const r = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM purchase_orders
        WHERE company_id = $1 AND po_no LIKE $2`,
      [companyId, `${prefix}%`],
    );
    return Number(r.rows[0]?.count ?? 0);
  }

  private async loadLines(poIds: number[]): Promise<Map<number, PurchaseOrderLine[]>> {
    const r = await this.pool.query<LineRow>(
      `SELECT po_id, line_no, description, quantity, received_qty, unit_price
         FROM purchase_order_lines
        WHERE po_id = ANY($1::bigint[])
        ORDER BY po_id, line_no`,
      [poIds],
    );
    const map = new Map<number, PurchaseOrderLine[]>();
    for (const row of r.rows) {
      const arr = map.get(row.po_id) ?? [];
      arr.push({
        lineNo: row.line_no,
        description: row.description,
        quantity: Number(row.quantity),
        receivedQty: Number(row.received_qty),
        unitPrice: Number(row.unit_price),
      });
      map.set(row.po_id, arr);
    }
    return map;
  }
}

async function insertLines(
  client: PoolClient,
  poId: number,
  lines: ReadonlyArray<PurchaseOrderLine>,
): Promise<void> {
  for (const ln of lines) {
    await client.query(
      `INSERT INTO purchase_order_lines
         (po_id, line_no, description, quantity, received_qty, unit_price)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [poId, ln.lineNo, ln.description, ln.quantity, ln.receivedQty, ln.unitPrice],
    );
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function rowsToPo(h: PoRow, lines: ReadonlyArray<PurchaseOrderLine>): PurchaseOrder {
  return PurchaseOrder.create({
    id: h.id,
    companyId: h.company_id,
    poNo: h.po_no,
    vendorId: h.vendor_id,
    prId: h.pr_id,
    status: h.status,
    currency: h.currency,
    note: h.note,
    orderedAt: h.ordered_at,
    deliveredAt: h.delivered_at,
    createdBy: h.created_by,
    createdAt: h.created_at,
    updatedAt: h.updated_at,
    lines: [...lines],
  });
}
