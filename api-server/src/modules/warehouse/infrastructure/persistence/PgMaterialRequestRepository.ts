/**
 * PgMaterialRequestRepository — MaterialRequestRepository PG implementasyonu.
 * Tablo: material_requests (items JSONB kolonunda taşınır).
 *
 * items çocuk koleksiyonu JSONB olarak saklanır; entity aggregate olarak
 * serialize eder. Tüm sorgular company_id ile multi-tenant izole edilir.
 */
import type { Pool } from 'pg';

import type {
  MaterialRequestRepository,
  NewMaterialRequestInput,
} from '../../application/ports/MaterialRequestRepository.js';
import {
  MaterialRequest,
  type MaterialRequestItem,
} from '../../domain/entities/MaterialRequest.js';
import type { MaterialRequestStatus } from '../../domain/valueObjects/AuxStatuses.js';

interface RequestRow {
  id: number;
  company_id: number;
  no: string;
  date: Date | string;
  requester_unit: string | null;
  requester: string | null;
  requested_warehouse_id: number | null;
  validity_days: number | null;
  status: MaterialRequestStatus;
  items: RawItem[] | null;
  note: string | null;
  reject_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

interface RawItem {
  materialId: number;
  qty: number | string;
  unit?: string | null;
}

const REQUEST_COLS =
  'id, company_id, no, date, requester_unit, requester, requested_warehouse_id, ' +
  'validity_days, status, items, note, reject_reason, created_at, updated_at';

export class PgMaterialRequestRepository implements MaterialRequestRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewMaterialRequestInput): Promise<MaterialRequest> {
    const r = await this.pool.query<RequestRow>(
      `INSERT INTO material_requests
         (company_id, no, date, requester_unit, requester, requested_warehouse_id,
          validity_days, status, items, note, reject_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
       RETURNING ${REQUEST_COLS}`,
      [
        input.companyId,
        input.no,
        input.date,
        input.requesterUnit,
        input.requester,
        input.requestedWarehouseId,
        input.validityDays,
        input.status,
        JSON.stringify(input.items),
        input.note,
        input.rejectReason,
      ],
    );
    return rowToRequest(r.rows[0]!);
  }

  async update(request: MaterialRequest): Promise<void> {
    await this.pool.query(
      `UPDATE material_requests
          SET date = $1, requester_unit = $2, requester = $3, requested_warehouse_id = $4,
              validity_days = $5, status = $6, items = $7::jsonb, note = $8,
              reject_reason = $9, updated_at = NOW()
        WHERE id = $10 AND company_id = $11`,
      [
        request.date,
        request.requesterUnit,
        request.requester,
        request.requestedWarehouseId,
        request.validityDays,
        request.status,
        JSON.stringify(request.items),
        request.note,
        request.rejectReason,
        request.id,
        request.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<MaterialRequest | null> {
    const r = await this.pool.query<RequestRow>(
      `SELECT ${REQUEST_COLS} FROM material_requests WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToRequest(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { status?: MaterialRequestStatus },
  ): Promise<ReadonlyArray<MaterialRequest>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    const r = await this.pool.query<RequestRow>(
      `SELECT ${REQUEST_COLS} FROM material_requests
        WHERE ${conditions.join(' AND ')}
        ORDER BY date DESC, id DESC`,
      params,
    );
    return r.rows.map(rowToRequest);
  }

  async nextSequence(companyId: number, year: number): Promise<number> {
    const r = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM material_requests
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

function rowToRequest(row: RequestRow): MaterialRequest {
  return MaterialRequest.create({
    id: row.id,
    companyId: row.company_id,
    no: row.no,
    date: toDateStr(row.date),
    requesterUnit: row.requester_unit,
    requester: row.requester,
    requestedWarehouseId: row.requested_warehouse_id,
    validityDays: row.validity_days,
    status: row.status,
    items: (row.items ?? []).map(
      (it): MaterialRequestItem => ({
        materialId: it.materialId,
        qty: Number(it.qty),
        unit: it.unit ?? null,
      }),
    ),
    note: row.note,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
