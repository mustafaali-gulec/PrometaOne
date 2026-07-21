/**
 * PgAdoptBlobRepository — AdoptBlobRepository PG implementasyonu.
 * Tablolar: vendors, purchase_requests(+items), purchase_orders(+lines)
 * (022_purchasing.sql + 024_vendor_address.sql + 046 client_id kolonları).
 *
 * adoptAll TEK transaction'da (pool.connect() + BEGIN/COMMIT/ROLLBACK):
 *   1. vendors upsert — ON CONFLICT (company_id, client_id) DO UPDATE.
 *   2. requesterUsername'ler users tablosundan toplu çözülür (yoksa NULL).
 *   3. purchase_requests upsert + items delete-then-insert.
 *   4. orders: vendorClientId/prClientId önce bu çağrının haritasından, sonra
 *      DB'deki mevcut client_id'lerden (önceki adopt) çözülür. Tedarikçisi
 *      çözülemeyen order atlanır (vendor_id NOT NULL); pr çözülemezse NULL.
 *   5. purchase_orders upsert + lines delete-then-insert.
 *
 * (company_id, code) / (company_id, pr_no) / (company_id, po_no) unique
 * kısıtlarıyla çakışma (CRUD ile aynı kod/no'da kayıt zaten var) 23505 olarak
 * yakalanır ve AdoptConflictError'a çevrilir (409).
 */
import type { Pool, PoolClient } from 'pg';

import type {
  NormalizedOrder,
  NormalizedRequest,
  NormalizedVendor,
} from '../../application/dto/AdoptBlobDtos.js';
import type {
  AdoptAllOutcome,
  AdoptAllPayload,
  AdoptBlobRepository,
} from '../../application/ports/AdoptBlobRepository.js';
import { AdoptConflictError } from '../../domain/errors/PurchasingErrors.js';

function isUniqueViolation(err: unknown): err is { code: string; detail?: string } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505';
}

export class PgAdoptBlobRepository implements AdoptBlobRepository {
  constructor(private readonly pool: Pool) {}

  async adoptAll(companyId: number, payload: AdoptAllPayload): Promise<AdoptAllOutcome> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const vendorIdByClient = await this.upsertVendors(client, companyId, payload.vendors);
      const requestIdByClient = await this.upsertRequests(client, companyId, payload.requests);
      const { orderIdByClient, skippedOrders } = await this.upsertOrders(
        client,
        companyId,
        payload.orders,
        vendorIdByClient,
        requestIdByClient,
      );

      await client.query('COMMIT');
      return { vendorIdByClient, requestIdByClient, orderIdByClient, skippedOrders };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK hatası orijinal hatayı gölgelemesin
      }
      if (isUniqueViolation(err)) {
        throw new AdoptConflictError(err.detail ?? 'kod/no benzersizlik çakışması');
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ===== VENDORS ============================================================

  private async upsertVendors(
    client: PoolClient,
    companyId: number,
    vendors: ReadonlyArray<NormalizedVendor>,
  ): Promise<Record<string, string>> {
    const idByClient: Record<string, string> = {};
    for (const v of vendors) {
      const r = await client.query<{ id: string }>(
        `INSERT INTO vendors
           (company_id, code, name, tax_id, person_type, cari_class, account_code,
            tax_office, address, active, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (company_id, client_id)
         DO UPDATE SET code = EXCLUDED.code,
                       name = EXCLUDED.name,
                       tax_id = EXCLUDED.tax_id,
                       person_type = EXCLUDED.person_type,
                       cari_class = EXCLUDED.cari_class,
                       account_code = EXCLUDED.account_code,
                       tax_office = EXCLUDED.tax_office,
                       address = EXCLUDED.address,
                       active = EXCLUDED.active,
                       updated_at = NOW()
         RETURNING id`,
        [
          companyId,
          v.code,
          v.name,
          v.taxId,
          v.personType,
          v.cariClass,
          v.accountCode,
          v.taxOffice,
          v.address,
          v.active,
          v.clientId,
        ],
      );
      idByClient[v.clientId] = String(r.rows[0]!.id);
    }
    return idByClient;
  }

  // ===== PURCHASE REQUESTS ==================================================

  private async upsertRequests(
    client: PoolClient,
    companyId: number,
    requests: ReadonlyArray<NormalizedRequest>,
  ): Promise<Record<string, string>> {
    // requesterUsername → users.id (toplu; bulunamayan NULL kalır).
    const usernames = [
      ...new Set(requests.map((r) => r.requesterUsername).filter((u): u is string => u !== null)),
    ];
    const userIdByName = new Map<string, number>();
    if (usernames.length > 0) {
      const res = await client.query<{ id: number; username: string }>(
        `SELECT id, username FROM users WHERE username = ANY($1::text[])`,
        [usernames],
      );
      for (const row of res.rows) userIdByName.set(row.username, row.id);
    }

    const idByClient: Record<string, string> = {};
    for (const r of requests) {
      const requesterId =
        r.requesterUsername !== null ? (userIdByName.get(r.requesterUsername) ?? null) : null;
      const head = await client.query<{ id: string }>(
        `INSERT INTO purchase_requests
           (company_id, pr_no, requester_user_id, department_id, category, priority,
            status, currency, total_amount, justification, required_by, requested_at, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12::timestamptz, NOW()), $13)
         ON CONFLICT (company_id, client_id)
         DO UPDATE SET pr_no = EXCLUDED.pr_no,
                       requester_user_id = EXCLUDED.requester_user_id,
                       department_id = EXCLUDED.department_id,
                       category = EXCLUDED.category,
                       priority = EXCLUDED.priority,
                       status = EXCLUDED.status,
                       currency = EXCLUDED.currency,
                       total_amount = EXCLUDED.total_amount,
                       justification = EXCLUDED.justification,
                       required_by = EXCLUDED.required_by,
                       requested_at = EXCLUDED.requested_at,
                       updated_at = NOW()
         RETURNING id`,
        [
          companyId,
          r.prNo,
          requesterId,
          r.departmentId,
          r.category,
          r.priority,
          r.status,
          r.currency,
          r.totalAmount,
          r.justification,
          r.requiredBy,
          r.requestedAt,
          r.clientId,
        ],
      );
      const prId = String(head.rows[0]!.id);
      idByClient[r.clientId] = prId;

      // items — yeniden yaz (idempotent).
      await client.query(`DELETE FROM purchase_request_items WHERE pr_id = $1`, [prId]);
      for (const item of r.items) {
        await client.query(
          `INSERT INTO purchase_request_items (pr_id, line_no, description, quantity, unit_price, note)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [prId, item.lineNo, item.description, item.quantity, item.unitPrice, item.note],
        );
      }
    }
    return idByClient;
  }

  // ===== PURCHASE ORDERS ====================================================

  private async upsertOrders(
    client: PoolClient,
    companyId: number,
    orders: ReadonlyArray<NormalizedOrder>,
    vendorIdByClient: Readonly<Record<string, string>>,
    requestIdByClient: Readonly<Record<string, string>>,
  ): Promise<{ orderIdByClient: Record<string, string>; skippedOrders: number }> {
    // Bu çağrıda gelmeyen ama önceki adopt'ta yazılmış referanslar DB'den çözülür.
    const vendorMap = new Map(Object.entries(vendorIdByClient));
    const requestMap = new Map(Object.entries(requestIdByClient));

    const missingVendorClientIds = [
      ...new Set(
        orders
          .map((o) => o.vendorClientId)
          .filter((cid): cid is string => cid !== null && !vendorMap.has(cid)),
      ),
    ];
    if (missingVendorClientIds.length > 0) {
      const res = await client.query<{ id: string; client_id: string }>(
        `SELECT id, client_id FROM vendors WHERE company_id = $1 AND client_id = ANY($2::text[])`,
        [companyId, missingVendorClientIds],
      );
      for (const row of res.rows) vendorMap.set(row.client_id, String(row.id));
    }

    const missingPrClientIds = [
      ...new Set(
        orders
          .map((o) => o.prClientId)
          .filter((cid): cid is string => cid !== null && !requestMap.has(cid)),
      ),
    ];
    if (missingPrClientIds.length > 0) {
      const res = await client.query<{ id: string; client_id: string }>(
        `SELECT id, client_id FROM purchase_requests
          WHERE company_id = $1 AND client_id = ANY($2::text[])`,
        [companyId, missingPrClientIds],
      );
      for (const row of res.rows) requestMap.set(row.client_id, String(row.id));
    }

    const orderIdByClient: Record<string, string> = {};
    let skippedOrders = 0;
    for (const o of orders) {
      const vendorId = o.vendorClientId !== null ? vendorMap.get(o.vendorClientId) : undefined;
      if (vendorId === undefined) {
        skippedOrders += 1; // vendor_id NOT NULL — çözülemeyen order atlanır
        continue;
      }
      const prId = o.prClientId !== null ? (requestMap.get(o.prClientId) ?? null) : null;

      const head = await client.query<{ id: string }>(
        `INSERT INTO purchase_orders
           (company_id, po_no, vendor_id, pr_id, status, currency, total_amount,
            ordered_at, delivered_at, note, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (company_id, client_id)
         DO UPDATE SET po_no = EXCLUDED.po_no,
                       vendor_id = EXCLUDED.vendor_id,
                       pr_id = EXCLUDED.pr_id,
                       status = EXCLUDED.status,
                       currency = EXCLUDED.currency,
                       total_amount = EXCLUDED.total_amount,
                       ordered_at = EXCLUDED.ordered_at,
                       delivered_at = EXCLUDED.delivered_at,
                       note = EXCLUDED.note,
                       updated_at = NOW()
         RETURNING id`,
        [
          companyId,
          o.poNo,
          vendorId,
          prId,
          o.status,
          o.currency,
          o.totalAmount,
          o.orderedAt,
          o.deliveredAt,
          o.note,
          o.clientId,
        ],
      );
      const poId = String(head.rows[0]!.id);
      orderIdByClient[o.clientId] = poId;

      // lines — yeniden yaz (idempotent).
      await client.query(`DELETE FROM purchase_order_lines WHERE po_id = $1`, [poId]);
      for (const line of o.lines) {
        await client.query(
          `INSERT INTO purchase_order_lines (po_id, line_no, description, quantity, received_qty, unit_price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [poId, line.lineNo, line.description, line.quantity, line.receivedQty, line.unitPrice],
        );
      }
    }
    return { orderIdByClient, skippedOrders };
  }
}
