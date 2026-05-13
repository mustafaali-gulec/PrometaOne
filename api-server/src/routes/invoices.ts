/**
 * Invoices route'ları.
 * Bulk-commit endpoint'i en kritik iş kuralı — toplu yansıtma.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { pool, queryMany, queryOne, transaction } from "../db.js";
import { authMiddleware, requireCompanyAccess } from "../middleware/auth.js";
import { logAudit } from "../middleware/audit.js";

const router = new Hono();
router.use("*", authMiddleware);

// ============== LIST ==============
router.get(
  "/:cid/invoices",
  requireCompanyAccess("viewer"),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const type = c.req.query("type");
    const status = c.req.query("status");
    const from = c.req.query("from");
    const to = c.req.query("to");
    const committed = c.req.query("committed");

    let sql = `SELECT i.*, (i.total - i.paid_amount) AS remaining,
               CASE
                 WHEN i.paid_amount >= i.total - 0.01 THEN 'paid'
                 WHEN i.paid_amount > 0 THEN 'partial'
                 WHEN i.due_date < CURRENT_DATE THEN 'overdue'
                 ELSE 'open'
               END AS status
               FROM invoices i WHERE i.company_id = $1`;
    const params: any[] = [cid];
    let pi = 2;
    if (type) { sql += ` AND i.type = $${pi++}`; params.push(type); }
    if (from) { sql += ` AND i.due_date >= $${pi++}`; params.push(from); }
    if (to)   { sql += ` AND i.due_date <= $${pi++}`; params.push(to); }
    if (committed !== undefined) {
      sql += ` AND i.committed_to_cells = $${pi++}`;
      params.push(committed === "true");
    }
    sql += ` ORDER BY i.due_date DESC, i.id DESC`;

    const rows = await queryMany<any>(sql, params);
    let result = rows.map(formatInvoice);
    if (status) result = result.filter(r => r.status === status);
    return c.json(result);
  }
);

// ============== CREATE ==============
router.post(
  "/:cid/invoices",
  requireCompanyAccess("editor"),
  zValidator("json", z.object({
    type: z.enum(["in", "out"]),
    invoiceNo: z.string().optional(),
    counterparty: z.string().min(1),
    issueDate: z.string().optional(),
    dueDate: z.string(),
    currency: z.enum(["TRY", "USD", "EUR"]),
    subtotal: z.number().default(0),
    kdvRate: z.number().default(0.20),
    total: z.number().positive(),
    cashflowCatId: z.number().int().nullable().optional(),
    note: z.string().optional(),
  })),
  async (c) => {
    const authCtx = c.get("auth");
    const cid = Number(c.req.param("cid"));
    const data = c.req.valid("json");

    const kdv = data.subtotal * data.kdvRate;

    const result = await queryOne<any>(
      `INSERT INTO invoices (company_id, type, invoice_no, counterparty, issue_date, due_date,
        currency, subtotal, kdv_rate, kdv, total, cashflow_cat_id, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [cid, data.type, data.invoiceNo, data.counterparty, data.issueDate, data.dueDate,
       data.currency, data.subtotal, data.kdvRate, kdv, data.total,
       data.cashflowCatId, data.note, authCtx.userId]
    );

    await logAudit(c, "invoice_create", {
      id: result.id, type: data.type, counterparty: data.counterparty, total: data.total
    }, cid);
    return c.json(formatInvoice(result), 201);
  }
);

// ============== UPDATE ==============
router.patch(
  "/:cid/invoices/:id",
  requireCompanyAccess("editor"),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const id = Number(c.req.param("id"));
    const body = await c.req.json();

    const map: Record<string, string> = {
      invoiceNo: "invoice_no", counterparty: "counterparty",
      issueDate: "issue_date", dueDate: "due_date",
      subtotal: "subtotal", kdvRate: "kdv_rate", total: "total",
      cashflowCatId: "cashflow_cat_id", note: "note",
    };
    const fields: string[] = [];
    const params: any[] = [];
    let pi = 1;
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && map[k]) {
        fields.push(`${map[k]} = $${pi++}`);
        params.push(v);
      }
    }
    // KDV otomatik hesapla
    if (body.subtotal !== undefined && body.kdvRate !== undefined) {
      fields.push(`kdv = $${pi++}`);
      params.push(Number(body.subtotal) * Number(body.kdvRate));
    }
    if (fields.length === 0) {
      throw new HTTPException(400, { message: "Güncellenecek alan yok" });
    }
    params.push(id, cid);
    const result = await queryOne<any>(
      `UPDATE invoices SET ${fields.join(", ")}
       WHERE id = $${pi++} AND company_id = $${pi++}
       RETURNING *`,
      params
    );
    if (!result) throw new HTTPException(404, { message: "Fatura bulunamadı" });
    await logAudit(c, "invoice_update", { id, changes: body }, cid);
    return c.json(formatInvoice(result));
  }
);

// ============== DELETE ==============
router.delete(
  "/:cid/invoices/:id",
  requireCompanyAccess("editor"),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const id = Number(c.req.param("id"));
    const result = await pool.query(
      `DELETE FROM invoices WHERE id = $1 AND company_id = $2`,
      [id, cid]
    );
    if (result.rowCount === 0) {
      throw new HTTPException(404, { message: "Fatura bulunamadı" });
    }
    await logAudit(c, "invoice_delete", { id }, cid);
    return new Response(null, { status: 204 });
  }
);

// ============== PAYMENTS ==============
router.post(
  "/:cid/invoices/:id/payments",
  requireCompanyAccess("editor"),
  zValidator("json", z.object({
    amount: z.number().positive(),
    date: z.string(),
    currency: z.enum(["TRY", "USD", "EUR"]),
    bankAccountId: z.number().int().nullable().optional(),
    kasaAccountId: z.number().int().nullable().optional(),
    note: z.string().optional(),
  })),
  async (c) => {
    const authCtx = c.get("auth");
    const cid = Number(c.req.param("cid"));
    const id = Number(c.req.param("id"));
    const data = c.req.valid("json");

    // Fatura kontrol
    const invoice = await queryOne<any>(
      `SELECT id FROM invoices WHERE id = $1 AND company_id = $2`, [id, cid]
    );
    if (!invoice) throw new HTTPException(404, { message: "Fatura bulunamadı" });

    if (data.bankAccountId && data.kasaAccountId) {
      throw new HTTPException(400, { message: "Sadece banka veya kasa hesabı seçin, ikisi birden olamaz" });
    }

    await pool.query(
      `INSERT INTO invoice_payments (invoice_id, amount, date, currency, bank_account_id, kasa_account_id, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, data.amount, data.date, data.currency, data.bankAccountId, data.kasaAccountId, data.note, authCtx.userId]
    );
    // paid_amount trigger ile otomatik güncellenir
    const updated = await queryOne<any>(
      `SELECT i.*, (i.total - i.paid_amount) AS remaining FROM invoices i WHERE i.id = $1`, [id]
    );
    await logAudit(c, "invoice_payment", { invoiceId: id, amount: data.amount, date: data.date }, cid);
    return c.json(formatInvoice(updated), 201);
  }
);

// ============== BULK COMMIT — en kritik endpoint ==============
router.post(
  "/:cid/invoices/bulk-commit",
  requireCompanyAccess("cfo"),
  async (c) => {
    const authCtx = c.get("auth");
    const cid = Number(c.req.param("cid"));

    // Fiscal year bilgisi
    const comp = await queryOne<{ fiscal_year: number }>(
      `SELECT fiscal_year FROM companies WHERE id = $1`, [cid]
    );
    if (!comp) throw new HTTPException(404, { message: "Şirket bulunamadı" });
    const fy = comp.fiscal_year;

    const result = await transaction(async (client) => {
      // 1) Açık faturalar (vade ayına projeksiyon)
      const openInvoices = await client.query<any>(
        `SELECT id, due_date, total, paid_amount, cashflow_cat_id, currency
         FROM invoices
         WHERE company_id = $1 AND cashflow_cat_id IS NOT NULL
           AND committed_to_cells = FALSE AND paid_amount < total`,
        [cid]
      );

      // 2) Faturalardan tahsil edilmiş tüm ödemeler (ödeme ayına realized)
      const payments = await client.query<any>(
        `SELECT p.amount, p.date, p.currency, i.cashflow_cat_id, i.id AS invoice_id
         FROM invoice_payments p
         JOIN invoices i ON i.id = p.invoice_id
         WHERE i.company_id = $1 AND i.cashflow_cat_id IS NOT NULL
           AND i.committed_to_cells = FALSE`,
        [cid]
      );

      // 3) Kasa hareketleri (cashflow_cat_id'li, committed olmayanlar)
      const kasaEntries = await client.query<any>(
        `SELECT ke.id, ke.date, ke.amount, ke.cashflow_cat_id, ka.currency
         FROM kasa_entries ke
         JOIN kasa_accounts ka ON ka.id = ke.kasa_account_id
         WHERE ka.company_id = $1 AND ke.cashflow_cat_id IS NOT NULL
           AND ke.committed_to_cells = FALSE`,
        [cid]
      );

      // 4) Transferler
      const transfers = await client.query<any>(
        `SELECT id, date, from_amount, from_currency, cashflow_cat_id
         FROM transfers
         WHERE company_id = $1 AND cashflow_cat_id IS NOT NULL
           AND committed_to_cells = FALSE`,
        [cid]
      );

      // Hücre toplama: { "catId:monthIdx" => delta }
      const deltas = new Map<string, number>();

      const addDelta = (catId: number, dateStr: string, amount: number) => {
        const d = new Date(dateStr);
        // Calendar month (0=Oca)
        const month = d.getMonth();
        const year = d.getFullYear();
        if (year !== fy) return; // sadece aktif yıla yansıt
        const key = `${catId}:${month}`;
        deltas.set(key, (deltas.get(key) ?? 0) + amount);
      };

      let invoiceCount = 0, paymentCount = 0, kasaCount = 0, transferCount = 0;

      for (const inv of openInvoices.rows) {
        const remaining = parseFloat(inv.total) - parseFloat(inv.paid_amount);
        if (remaining > 0) {
          // TODO: çoklu para birimi için TL'ye çevirme
          addDelta(inv.cashflow_cat_id, inv.due_date, remaining);
          invoiceCount++;
        }
      }
      for (const p of payments.rows) {
        addDelta(p.cashflow_cat_id, p.date, parseFloat(p.amount));
        paymentCount++;
      }
      for (const ke of kasaEntries.rows) {
        addDelta(ke.cashflow_cat_id, ke.date, parseFloat(ke.amount));
        kasaCount++;
      }
      for (const t of transfers.rows) {
        addDelta(t.cashflow_cat_id, t.date, parseFloat(t.from_amount));
        transferCount++;
      }

      // Hücreleri güncelle (cells tablosuna ekle/güncelle)
      let totalDelta = 0;
      for (const [key, delta] of deltas.entries()) {
        const [catIdStr, monthIdxStr] = key.split(":");
        const catId = Number(catIdStr);
        const monthIdx = Number(monthIdxStr);
        await client.query(
          `INSERT INTO cells (company_id, category_id, fiscal_year, month_idx, value, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (company_id, category_id, fiscal_year, month_idx)
           DO UPDATE SET value = cells.value + EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
          [cid, catId, fy, monthIdx, delta, authCtx.userId]
        );
        totalDelta += delta;
      }

      // Kayıtları committed işaretle
      const now = new Date().toISOString();
      await client.query(
        `UPDATE invoices SET committed_to_cells = TRUE, committed_at = $1
         WHERE company_id = $2 AND cashflow_cat_id IS NOT NULL
           AND committed_to_cells = FALSE`,
        [now, cid]
      );
      await client.query(
        `UPDATE kasa_entries SET committed_to_cells = TRUE, committed_at = $1
         WHERE kasa_account_id IN (SELECT id FROM kasa_accounts WHERE company_id = $2)
           AND cashflow_cat_id IS NOT NULL AND committed_to_cells = FALSE`,
        [now, cid]
      );
      await client.query(
        `UPDATE transfers SET committed_to_cells = TRUE, committed_at = $1
         WHERE company_id = $2 AND cashflow_cat_id IS NOT NULL AND committed_to_cells = FALSE`,
        [now, cid]
      );

      return {
        fatura: invoiceCount + paymentCount,
        kasa: kasaCount,
        transfer: transferCount,
        toplam: invoiceCount + paymentCount + kasaCount + transferCount,
        etkilenenHücre: deltas.size,
        toplamTRY: totalDelta,
      };
    });

    await logAudit(c, "invoices_bulk_commit", result, cid);
    return c.json(result);
  }
);

// =================== Helper ===================
function formatInvoice(row: any): any {
  return {
    id: row.id,
    companyId: row.company_id,
    type: row.type,
    invoiceNo: row.invoice_no,
    counterparty: row.counterparty,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    subtotal: parseFloat(row.subtotal),
    kdvRate: parseFloat(row.kdv_rate),
    kdv: parseFloat(row.kdv),
    total: parseFloat(row.total),
    paidAmount: parseFloat(row.paid_amount),
    status: row.status ?? (
      parseFloat(row.paid_amount) >= parseFloat(row.total) - 0.01 ? "paid"
      : parseFloat(row.paid_amount) > 0 ? "partial"
      : new Date(row.due_date) < new Date() ? "overdue"
      : "open"
    ),
    cashflowCatId: row.cashflow_cat_id,
    committedToCells: row.committed_to_cells,
    committedAt: row.committed_at,
    note: row.note,
    payments: row.payments ?? [],
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export default router;
