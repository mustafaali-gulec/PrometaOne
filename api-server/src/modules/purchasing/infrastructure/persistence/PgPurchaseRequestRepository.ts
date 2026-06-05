/**
 * PgPurchaseRequestRepository — PurchaseRequestRepository PG implementasyonu.
 * Tablolar: purchase_requests, purchase_request_items (022_purchasing.sql).
 *
 * insert/update header + items'ı tek transaction'da yazar (Pool.connect).
 */
import type { Pool, PoolClient } from 'pg';

import type {
  ListPurchaseRequestsOptions,
  NewPurchaseRequestInput,
  PurchaseRequestRepository,
} from '../../application/ports/PurchaseRequestRepository.js';
import {
  PurchaseRequest,
  type PurchaseRequestItem,
} from '../../domain/entities/PurchaseRequest.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { PrStatus } from '../../domain/valueObjects/PrStatus.js';

interface PrRow {
  id: number;
  company_id: number;
  pr_no: string;
  requester_user_id: number | null;
  department_id: number | null;
  category: string;
  priority: string;
  status: PrStatus;
  currency: CurrencyCode;
  justification: string | null;
  required_by: Date | null;
  requested_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface ItemRow {
  pr_id: number;
  line_no: number;
  description: string;
  quantity: string;
  unit_price: string;
  note: string | null;
}

const HCOLS =
  'id, company_id, pr_no, requester_user_id, department_id, category, priority, status, currency, justification, required_by, requested_at, created_at, updated_at';

export class PgPurchaseRequestRepository implements PurchaseRequestRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewPurchaseRequestInput): Promise<PurchaseRequest> {
    const total = round2(input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query<PrRow>(
        `INSERT INTO purchase_requests
           (company_id, pr_no, requester_user_id, department_id, category, priority,
            status, currency, total_amount, justification, required_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING ${HCOLS}`,
        [
          input.companyId,
          input.prNo,
          input.requesterUserId,
          input.departmentId,
          input.category,
          input.priority,
          input.status,
          input.currency,
          total,
          input.justification,
          input.requiredBy,
        ],
      );
      const header = r.rows[0]!;
      await insertItems(client, header.id, input.items);
      await client.query('COMMIT');
      return rowsToPr(header, input.items);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(pr: PurchaseRequest): Promise<void> {
    const j = pr.toJSON();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE purchase_requests
           SET category = $1, priority = $2, status = $3, currency = $4,
               total_amount = $5, justification = $6, required_by = $7, updated_at = NOW()
         WHERE id = $8 AND company_id = $9`,
        [
          j.category,
          j.priority,
          j.status,
          j.currency,
          pr.totalAmount,
          j.justification,
          j.requiredBy,
          j.id,
          j.companyId,
        ],
      );
      await client.query('DELETE FROM purchase_request_items WHERE pr_id = $1', [j.id]);
      await insertItems(client, j.id, j.items);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: number, companyId: number): Promise<PurchaseRequest | null> {
    const r = await this.pool.query<PrRow>(
      `SELECT ${HCOLS} FROM purchase_requests WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const header = r.rows[0];
    if (!header) return null;
    const items = await this.loadItems([header.id]);
    return rowsToPr(header, items.get(header.id) ?? []);
  }

  async listByCompany(
    companyId: number,
    options?: ListPurchaseRequestsOptions,
  ): Promise<ReadonlyArray<PurchaseRequest>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options?.requesterUserId !== undefined) {
      params.push(options.requesterUserId);
      conditions.push(`requester_user_id = $${params.length}`);
    }
    const r = await this.pool.query<PrRow>(
      `SELECT ${HCOLS} FROM purchase_requests
        WHERE ${conditions.join(' AND ')}
        ORDER BY requested_at DESC, id DESC`,
      params,
    );
    if (r.rows.length === 0) return [];
    const itemsByPr = await this.loadItems(r.rows.map((h) => h.id));
    return r.rows.map((h) => rowsToPr(h, itemsByPr.get(h.id) ?? []));
  }

  async countByNoPrefix(companyId: number, prefix: string): Promise<number> {
    const r = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM purchase_requests
        WHERE company_id = $1 AND pr_no LIKE $2`,
      [companyId, `${prefix}%`],
    );
    return Number(r.rows[0]?.count ?? 0);
  }

  private async loadItems(prIds: number[]): Promise<Map<number, PurchaseRequestItem[]>> {
    const r = await this.pool.query<ItemRow>(
      `SELECT pr_id, line_no, description, quantity, unit_price, note
         FROM purchase_request_items
        WHERE pr_id = ANY($1::bigint[])
        ORDER BY pr_id, line_no`,
      [prIds],
    );
    const map = new Map<number, PurchaseRequestItem[]>();
    for (const row of r.rows) {
      const arr = map.get(row.pr_id) ?? [];
      arr.push({
        lineNo: row.line_no,
        description: row.description,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        note: row.note,
      });
      map.set(row.pr_id, arr);
    }
    return map;
  }
}

async function insertItems(
  client: PoolClient,
  prId: number,
  items: ReadonlyArray<PurchaseRequestItem>,
): Promise<void> {
  for (const it of items) {
    await client.query(
      `INSERT INTO purchase_request_items (pr_id, line_no, description, quantity, unit_price, note)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [prId, it.lineNo, it.description, it.quantity, it.unitPrice, it.note],
    );
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function rowsToPr(h: PrRow, items: ReadonlyArray<PurchaseRequestItem>): PurchaseRequest {
  return PurchaseRequest.create({
    id: h.id,
    companyId: h.company_id,
    prNo: h.pr_no,
    requesterUserId: h.requester_user_id,
    departmentId: h.department_id,
    category: h.category,
    priority: h.priority,
    status: h.status,
    currency: h.currency,
    justification: h.justification,
    requiredBy: h.required_by,
    requestedAt: h.requested_at,
    createdAt: h.created_at,
    updatedAt: h.updated_at,
    items: [...items],
  });
}
