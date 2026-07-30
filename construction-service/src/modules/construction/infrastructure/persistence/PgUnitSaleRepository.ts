/**
 * PgUnitSaleRepository — UnitSaleRepository PG implementasyonu (FAZ 10).
 * Tablolar: cs_unit_sales, cs_unit_prices, cs_unit_payments,
 * cs_unit_change_requests; görünümler: cs_v_unit_inventory,
 * cs_v_project_sales_summary.
 *
 * BIGINT kolonları node-pg'de STRING döner — mapper Number() çevirir.
 */
import type { Pool } from 'pg';

import type {
  NewChangeRequestInput,
  NewUnitPaymentInput,
  NewUnitSaleInput,
  ProjectSalesSummaryRow,
  UnitInventoryRow,
  UnitPaymentRow,
  UnitSaleFilter,
  UnitSaleRepository,
} from '../../application/ports/UnitSaleRepository.js';
import {
  UnitChangeRequest,
  type ChangeRequestStatus,
  type UnitChangeRequestProps,
} from '../../domain/entities/UnitChangeRequest.js';
import {
  UnitSale,
  type UnitSaleProps,
  type UnitSaleSource,
  type UnitSaleStatus,
  type UnitPaymentKind,
  type UnitPaymentMethod,
} from '../../domain/entities/UnitSale.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';

const n = (v: string | number | null): number | null =>
  v === null ? null : typeof v === 'number' ? v : Number(v);
const nn = (v: string | number): number => (typeof v === 'number' ? v : Number(v));

function codeSeq(code: string): number {
  const m = /(\d+)\s*$/.exec(code);
  return m === null ? 0 : Number(m[1]);
}

// ===== SATIŞ ================================================================

interface SaleRow {
  id: string;
  company_id: number;
  project_id: string;
  location_id: string;
  status: UnitSaleStatus;
  source: UnitSaleSource;
  ref_no: string | null;
  buyer_name: string | null;
  vendor_id: string | null;
  list_price: string;
  sale_price: string;
  currency: CurrencyCode;
  reserved_at: string | null;
  sold_at: string | null;
  cancelled_at: Date | null;
  cancel_note: string | null;
  note: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const SALE_COLS =
  'id, company_id, project_id, location_id, status, source, ref_no, buyer_name, vendor_id, ' +
  'list_price, sale_price, currency, reserved_at::text AS reserved_at, sold_at::text AS sold_at, ' +
  'cancelled_at, cancel_note, note, created_by, created_at, updated_at';

function toSale(r: SaleRow): UnitSale {
  const props: UnitSaleProps = {
    id: nn(r.id),
    companyId: r.company_id,
    projectId: nn(r.project_id),
    locationId: nn(r.location_id),
    status: r.status,
    source: r.source,
    refNo: r.ref_no,
    buyerName: r.buyer_name,
    vendorId: n(r.vendor_id),
    listPrice: Number(r.list_price),
    salePrice: Number(r.sale_price),
    currency: r.currency,
    reservedAt: r.reserved_at,
    soldAt: r.sold_at,
    cancelledAt: r.cancelled_at,
    cancelNote: r.cancel_note,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return UnitSale.create(props);
}

// ===== DEĞİŞİKLİK İSTEĞİ ====================================================

interface CrRow {
  id: string;
  company_id: number;
  sale_id: string;
  code: string;
  title: string;
  description: string | null;
  cost: string;
  status: ChangeRequestStatus;
  requested_at: string;
  decided_at: string | null;
  decided_by: number | null;
  done_at: string | null;
  note: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const CR_COLS =
  'id, company_id, sale_id, code, title, description, cost, status, ' +
  'requested_at::text AS requested_at, decided_at::text AS decided_at, decided_by, ' +
  'done_at::text AS done_at, note, created_by, created_at, updated_at';

function toCr(r: CrRow): UnitChangeRequest {
  const props: UnitChangeRequestProps = {
    id: nn(r.id),
    companyId: r.company_id,
    saleId: nn(r.sale_id),
    code: r.code,
    title: r.title,
    description: r.description,
    cost: Number(r.cost),
    status: r.status,
    requestedAt: r.requested_at,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by,
    doneAt: r.done_at,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return UnitChangeRequest.create(props);
}

// ===== TAHSİLAT =============================================================

interface PaymentRow {
  id: string;
  sale_id: string;
  kind: UnitPaymentKind;
  paid_at: string;
  amount: string;
  method: UnitPaymentMethod | null;
  note: string | null;
  created_by: number | null;
  created_at: Date;
}

const PAY_COLS =
  'id, sale_id, kind, paid_at::text AS paid_at, amount, method, note, created_by, created_at';

function toPayment(r: PaymentRow): UnitPaymentRow {
  return {
    id: nn(r.id),
    saleId: nn(r.sale_id),
    kind: r.kind,
    paidAt: r.paid_at,
    amount: Number(r.amount),
    method: r.method,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export class PgUnitSaleRepository implements UnitSaleRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewUnitSaleInput): Promise<UnitSale> {
    const res = await this.pool.query<SaleRow>(
      `INSERT INTO cs_unit_sales
         (company_id, project_id, location_id, status, source, ref_no, buyer_name,
          vendor_id, list_price, sale_price, currency, reserved_at, sold_at, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING ${SALE_COLS}`,
      [
        input.companyId,
        input.projectId,
        input.locationId,
        input.status,
        input.source,
        input.refNo,
        input.buyerName,
        input.vendorId,
        input.listPrice,
        input.salePrice,
        input.currency,
        input.reservedAt,
        input.soldAt,
        input.note,
        input.createdBy,
      ],
    );
    return toSale(res.rows[0]!);
  }

  async findById(id: number, companyId: number): Promise<UnitSale | null> {
    const res = await this.pool.query<SaleRow>(
      `SELECT ${SALE_COLS} FROM cs_unit_sales WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toSale(res.rows[0]);
  }

  async findByRef(
    companyId: number,
    source: UnitSaleSource,
    refNo: string,
  ): Promise<UnitSale | null> {
    const res = await this.pool.query<SaleRow>(
      `SELECT ${SALE_COLS} FROM cs_unit_sales
        WHERE company_id = $1 AND source = $2 AND ref_no = $3`,
      [companyId, source, refNo],
    );
    return res.rows[0] === undefined ? null : toSale(res.rows[0]);
  }

  async findActiveByLocation(locationId: number, companyId: number): Promise<UnitSale | null> {
    const res = await this.pool.query<SaleRow>(
      `SELECT ${SALE_COLS} FROM cs_unit_sales
        WHERE location_id = $1 AND company_id = $2 AND status <> 'cancelled'`,
      [locationId, companyId],
    );
    return res.rows[0] === undefined ? null : toSale(res.rows[0]);
  }

  async list(companyId: number, filter: UnitSaleFilter = {}): Promise<ReadonlyArray<UnitSale>> {
    const where = ['s.company_id = $1'];
    const params: unknown[] = [companyId];
    const p = (v: unknown): string => {
      params.push(v);
      return `$${String(params.length)}`;
    };
    if (filter.projectId !== undefined) where.push(`s.project_id = ${p(filter.projectId)}`);
    if (filter.locationId !== undefined) where.push(`s.location_id = ${p(filter.locationId)}`);
    if (filter.status !== undefined) where.push(`s.status = ${p(filter.status)}`);
    if (filter.source !== undefined) where.push(`s.source = ${p(filter.source)}`);
    if (filter.search !== undefined && filter.search.trim() !== '') {
      const term = p(`%${filter.search.trim()}%`);
      where.push(`(s.buyer_name ILIKE ${term} OR s.ref_no ILIKE ${term})`);
    }
    const res = await this.pool.query<SaleRow>(
      `SELECT ${SALE_COLS} FROM cs_unit_sales s
        WHERE ${where.join(' AND ')}
        ORDER BY s.status <> 'cancelled' DESC, s.created_at DESC, s.id DESC`,
      params,
    );
    return res.rows.map(toSale);
  }

  async update(sale: UnitSale): Promise<UnitSale> {
    const j = sale.toJSON();
    const res = await this.pool.query<SaleRow>(
      `UPDATE cs_unit_sales SET
         status = $1, buyer_name = $2, vendor_id = $3, list_price = $4, sale_price = $5,
         reserved_at = $6, sold_at = $7, cancelled_at = $8, cancel_note = $9, note = $10,
         updated_at = NOW()
       WHERE id = $11 AND company_id = $12
       RETURNING ${SALE_COLS}`,
      [
        j.status,
        j.buyerName,
        j.vendorId,
        j.listPrice,
        j.salePrice,
        j.reservedAt,
        j.soldAt,
        j.cancelledAt,
        j.cancelNote,
        j.note,
        j.id,
        j.companyId,
      ],
    );
    return toSale(res.rows[0]!);
  }

  // ===== ENVANTER ===========================================================

  async inventory(companyId: number, projectId: number): Promise<ReadonlyArray<UnitInventoryRow>> {
    const res = await this.pool.query<{
      location_id: string;
      project_id: string;
      code: string;
      name: string;
      path: string;
      unit_type: string | null;
      gross_area: string | null;
      net_area: string | null;
      facade: string | null;
      book_list_price: string | null;
      sale_id: string | null;
      sale_status: string;
      source: string | null;
      ref_no: string | null;
      buyer_name: string | null;
      vendor_id: string | null;
      sale_list_price: string | null;
      sale_price: string | null;
      discount: string | null;
      reserved_at: string | null;
      sold_at: string | null;
      change_order_total: string | null;
      collected: string | null;
      remaining: string | null;
      open_change_requests: string;
    }>(
      `SELECT location_id, project_id, code, name, path, unit_type, gross_area, net_area,
              facade, book_list_price, sale_id, sale_status, source, ref_no, buyer_name,
              vendor_id, sale_list_price, sale_price, discount,
              reserved_at::text AS reserved_at, sold_at::text AS sold_at,
              change_order_total, collected, remaining, open_change_requests
         FROM cs_v_unit_inventory
        WHERE company_id = $1 AND project_id = $2
        ORDER BY path`,
      [companyId, projectId],
    );
    return res.rows.map((r) => ({
      locationId: nn(r.location_id),
      projectId: nn(r.project_id),
      code: r.code,
      name: r.name,
      path: r.path,
      unitType: r.unit_type,
      grossArea: n(r.gross_area),
      netArea: n(r.net_area),
      facade: r.facade,
      bookListPrice: n(r.book_list_price),
      saleId: n(r.sale_id),
      saleStatus: r.sale_status,
      source: r.source,
      refNo: r.ref_no,
      buyerName: r.buyer_name,
      vendorId: n(r.vendor_id),
      saleListPrice: n(r.sale_list_price),
      salePrice: n(r.sale_price),
      discount: n(r.discount),
      reservedAt: r.reserved_at,
      soldAt: r.sold_at,
      changeOrderTotal: n(r.change_order_total),
      collected: n(r.collected),
      remaining: n(r.remaining),
      openChangeRequests: Number(r.open_change_requests),
    }));
  }

  async projectSummary(
    companyId: number,
    projectId: number,
  ): Promise<ProjectSalesSummaryRow | null> {
    const res = await this.pool.query<{
      project_id: string;
      unit_count: string;
      available_count: string;
      reserved_count: string;
      sold_count: string;
      barter_count: string;
      sold_value: string;
      reserved_value: string;
      barter_value: string;
      change_order_total: string;
      collected_total: string;
      remaining_total: string;
      available_list_value: string | null;
      unpriced_available_count: string;
      open_change_requests: string;
      cancelled_count: string;
      refund_liability: string;
    }>(`SELECT * FROM cs_v_project_sales_summary WHERE company_id = $1 AND project_id = $2`, [
      companyId,
      projectId,
    ]);
    const r = res.rows[0];
    if (r === undefined) return null;
    return {
      projectId: nn(r.project_id),
      unitCount: Number(r.unit_count),
      availableCount: Number(r.available_count),
      reservedCount: Number(r.reserved_count),
      soldCount: Number(r.sold_count),
      barterCount: Number(r.barter_count),
      soldValue: Number(r.sold_value),
      reservedValue: Number(r.reserved_value),
      barterValue: Number(r.barter_value),
      changeOrderTotal: Number(r.change_order_total),
      collectedTotal: Number(r.collected_total),
      remainingTotal: Number(r.remaining_total),
      availableListValue: n(r.available_list_value),
      unpricedAvailableCount: Number(r.unpriced_available_count),
      openChangeRequests: Number(r.open_change_requests),
      cancelledCount: Number(r.cancelled_count),
      refundLiability: Number(r.refund_liability),
    };
  }

  // ===== LİSTE FİYATI =======================================================

  async upsertListPrice(input: {
    companyId: number;
    projectId: number;
    locationId: number;
    listPrice: number;
    note: string | null;
    updatedBy: number | null;
  }): Promise<{ locationId: number; listPrice: number }> {
    const res = await this.pool.query<{ location_id: string; list_price: string }>(
      `INSERT INTO cs_unit_prices (company_id, project_id, location_id, list_price, note, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (location_id) DO UPDATE
         SET list_price = EXCLUDED.list_price, note = EXCLUDED.note,
             updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING location_id, list_price`,
      [
        input.companyId,
        input.projectId,
        input.locationId,
        input.listPrice,
        input.note,
        input.updatedBy,
      ],
    );
    const r = res.rows[0]!;
    return { locationId: nn(r.location_id), listPrice: Number(r.list_price) };
  }

  async getListPrice(locationId: number, companyId: number): Promise<number | null> {
    const res = await this.pool.query<{ list_price: string }>(
      `SELECT list_price FROM cs_unit_prices WHERE location_id = $1 AND company_id = $2`,
      [locationId, companyId],
    );
    return res.rows[0] === undefined ? null : Number(res.rows[0].list_price);
  }

  // ===== TAHSİLAT ===========================================================

  async insertPayment(input: NewUnitPaymentInput): Promise<UnitPaymentRow> {
    const res = await this.pool.query<PaymentRow>(
      `INSERT INTO cs_unit_payments (company_id, sale_id, kind, paid_at, amount, method, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${PAY_COLS}`,
      [
        input.companyId,
        input.saleId,
        input.kind,
        input.paidAt,
        input.amount,
        input.method,
        input.note,
        input.createdBy,
      ],
    );
    return toPayment(res.rows[0]!);
  }

  async deletePayment(id: number, companyId: number): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM cs_unit_payments WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listPayments(saleId: number, companyId: number): Promise<ReadonlyArray<UnitPaymentRow>> {
    const res = await this.pool.query<PaymentRow>(
      `SELECT ${PAY_COLS} FROM cs_unit_payments
        WHERE sale_id = $1 AND company_id = $2
        ORDER BY paid_at, id`,
      [saleId, companyId],
    );
    return res.rows.map(toPayment);
  }

  async collectedFor(saleId: number): Promise<number> {
    const res = await this.pool.query<{ collected: string }>(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE kind = 'collection'), 0)
            - COALESCE(SUM(amount) FILTER (WHERE kind = 'refund'), 0) AS collected
         FROM cs_unit_payments WHERE sale_id = $1`,
      [saleId],
    );
    return Number(res.rows[0]!.collected);
  }

  // ===== DEĞİŞİKLİK İSTEĞİ ==================================================

  async insertChangeRequest(input: NewChangeRequestInput): Promise<UnitChangeRequest> {
    const res = await this.pool.query<CrRow>(
      `INSERT INTO cs_unit_change_requests
         (company_id, sale_id, code, title, description, cost, requested_at, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${CR_COLS}`,
      [
        input.companyId,
        input.saleId,
        input.code,
        input.title,
        input.description,
        input.cost,
        input.requestedAt,
        input.note,
        input.createdBy,
      ],
    );
    return toCr(res.rows[0]!);
  }

  async findChangeRequestById(id: number, companyId: number): Promise<UnitChangeRequest | null> {
    const res = await this.pool.query<CrRow>(
      `SELECT ${CR_COLS} FROM cs_unit_change_requests WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toCr(res.rows[0]);
  }

  async listChangeRequests(
    saleId: number,
    companyId: number,
  ): Promise<ReadonlyArray<UnitChangeRequest>> {
    const res = await this.pool.query<CrRow>(
      `SELECT ${CR_COLS} FROM cs_unit_change_requests
        WHERE sale_id = $1 AND company_id = $2
        ORDER BY requested_at, id`,
      [saleId, companyId],
    );
    return res.rows.map(toCr);
  }

  async updateChangeRequest(cr: UnitChangeRequest): Promise<UnitChangeRequest> {
    const j = cr.toJSON();
    const res = await this.pool.query<CrRow>(
      `UPDATE cs_unit_change_requests SET
         title = $1, description = $2, cost = $3, status = $4, decided_at = $5,
         decided_by = $6, done_at = $7, note = $8, updated_at = NOW()
       WHERE id = $9 AND company_id = $10
       RETURNING ${CR_COLS}`,
      [
        j.title,
        j.description,
        j.cost,
        j.status,
        j.decidedAt,
        j.decidedBy,
        j.doneAt,
        j.note,
        j.id,
        j.companyId,
      ],
    );
    return toCr(res.rows[0]!);
  }

  async nextChangeRequestCode(companyId: number): Promise<string> {
    const res = await this.pool.query<{ code: string }>(
      `SELECT code FROM cs_unit_change_requests WHERE company_id = $1`,
      [companyId],
    );
    const max = res.rows.reduce((m, r) => Math.max(m, codeSeq(r.code)), 0);
    return `DGS-${String(max + 1).padStart(4, '0')}`;
  }
}
