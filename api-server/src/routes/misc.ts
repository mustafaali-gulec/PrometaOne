/**
 * Diğer route'lar — kompakt implementasyon.
 * Banks, Kasa, Transfers, FX, Archives, Audit, Notifications, AI.
 *
 * Pattern aynıdır: authMiddleware → requireCompanyAccess → queryMany/transaction.
 * Yeni endpoint eklemek için bu dosyaları örnek alın.
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { pool, queryMany, queryOne, transaction, execute } from "../db.js";
import { authMiddleware, requireRole, requireCompanyAccess } from "../middleware/auth.js";
import { logAudit } from "../middleware/audit.js";
import { fetchAndStoreTodaysRates, getCurrentRates } from "../services/tcmb.js";
import { predictForCompany } from "../services/ai.js";
import { generateDailyReport, sendDailyReport } from "../services/notifications.js";

// ================================================================
// BANKS
// ================================================================
export const banks = new Hono();
banks.use("*", authMiddleware);

banks.get("/", async (c) => {
  const rows = await queryMany(
    `SELECT id, name, code, color FROM banks ORDER BY name`
  );
  return c.json(rows);
});

banks.get("/:cid/bank-accounts", requireCompanyAccess("viewer"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const rows = await queryMany(
    `SELECT ba.id, ba.company_id AS "companyId", ba.bank_id AS "bankId",
            ba.name, ba.iban, ba.account_no AS "accountNo", ba.currency,
            ba.opening_balance::float AS "openingBalance",
            ba.cashflow_cat_id AS "cashflowCatId",
            v.balance::float AS balance
     FROM bank_accounts ba
     LEFT JOIN v_bank_balances v ON v.id = ba.id
     WHERE ba.company_id = $1 AND ba.active = TRUE ORDER BY ba.id`,
    [cid]
  );
  return c.json(rows);
});

banks.post(
  "/:cid/bank-accounts",
  requireCompanyAccess("cfo"),
  zValidator("json", z.object({
    bankId: z.number().int(),
    name: z.string().min(1),
    iban: z.string().optional(),
    accountNo: z.string().optional(),
    currency: z.enum(["TRY", "USD", "EUR"]),
    openingBalance: z.number().default(0),
    cashflowCatId: z.number().int().nullable().optional(),
  })),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const data = c.req.valid("json");
    const result = await queryOne(
      `INSERT INTO bank_accounts (company_id, bank_id, name, iban, account_no, currency,
        opening_balance, cashflow_cat_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, currency, opening_balance::float AS "openingBalance"`,
      [cid, data.bankId, data.name, data.iban, data.accountNo,
       data.currency, data.openingBalance, data.cashflowCatId, c.get("auth").userId]
    );
    await logAudit(c, "bank_account_create", { name: data.name }, cid);
    return c.json(result, 201);
  }
);

banks.patch("/:cid/bank-accounts/:id", requireCompanyAccess("cfo"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const map: Record<string, string> = {
    name: "name", iban: "iban", accountNo: "account_no",
    cashflowCatId: "cashflow_cat_id",
  };
  const fields: string[] = [], params: any[] = [];
  let pi = 1;
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && map[k]) { fields.push(`${map[k]} = $${pi++}`); params.push(v); }
  }
  if (fields.length === 0) throw new HTTPException(400, { message: "Güncellenecek alan yok" });
  params.push(id, cid);
  await execute(
    `UPDATE bank_accounts SET ${fields.join(", ")} WHERE id = $${pi++} AND company_id = $${pi++}`,
    params
  );
  await logAudit(c, "bank_account_update", { id, changes: body }, cid);
  return new Response(null, { status: 204 });
});

banks.delete("/:cid/bank-accounts/:id", requireCompanyAccess("cfo"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const id = Number(c.req.param("id"));
  await execute(
    `UPDATE bank_accounts SET active = FALSE WHERE id = $1 AND company_id = $2`,
    [id, cid]
  );
  await logAudit(c, "bank_account_delete", { id }, cid);
  return new Response(null, { status: 204 });
});

// ================================================================
// KASA
// ================================================================
export const kasa = new Hono();
kasa.use("*", authMiddleware);

kasa.get("/:cid/kasa-accounts", requireCompanyAccess("viewer"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const rows = await queryMany(
    `SELECT ka.id, ka.company_id AS "companyId", ka.name, ka.currency,
            ka.opening_balance::float AS "openingBalance",
            v.balance::float AS balance
     FROM kasa_accounts ka
     LEFT JOIN v_kasa_balances v ON v.id = ka.id
     WHERE ka.company_id = $1 AND ka.active = TRUE ORDER BY ka.id`, [cid]
  );
  return c.json(rows);
});

kasa.post(
  "/:cid/kasa-accounts",
  requireCompanyAccess("cfo"),
  zValidator("json", z.object({
    name: z.string().min(1),
    currency: z.enum(["TRY", "USD", "EUR"]),
    openingBalance: z.number().default(0),
  })),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const data = c.req.valid("json");
    const result = await queryOne(
      `INSERT INTO kasa_accounts (company_id, name, currency, opening_balance, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, currency, opening_balance::float AS "openingBalance"`,
      [cid, data.name, data.currency, data.openingBalance, c.get("auth").userId]
    );
    await logAudit(c, "kasa_account_create", { name: data.name }, cid);
    return c.json(result, 201);
  }
);

kasa.get("/:cid/kasa-entries", requireCompanyAccess("viewer"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const rows = await queryMany(
    `SELECT ke.id, ke.kasa_account_id AS "kasaAccountId",
            ke.date::text AS date, ke.type, ke.amount::float AS amount,
            ke.description, ke.category, ke.cashflow_cat_id AS "cashflowCatId",
            ke.committed_to_cells AS "committedToCells",
            ke.created_at AS "createdAt", ke.created_by AS "createdBy"
     FROM kasa_entries ke
     JOIN kasa_accounts ka ON ka.id = ke.kasa_account_id
     WHERE ka.company_id = $1 ORDER BY ke.date DESC, ke.id DESC`,
    [cid]
  );
  return c.json(rows);
});

kasa.post(
  "/:cid/kasa-entries",
  requireCompanyAccess("editor"),
  zValidator("json", z.object({
    kasaAccountId: z.number().int(),
    date: z.string(),
    type: z.enum(["in", "out"]),
    amount: z.number().positive(),
    description: z.string().optional(),
    category: z.string().optional(),
    cashflowCatId: z.number().int().nullable().optional(),
  })),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const data = c.req.valid("json");
    const result = await queryOne(
      `INSERT INTO kasa_entries (kasa_account_id, date, type, amount, description, category,
        cashflow_cat_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, kasa_account_id AS "kasaAccountId", date::text AS date, type,
                 amount::float AS amount, description, category,
                 cashflow_cat_id AS "cashflowCatId"`,
      [data.kasaAccountId, data.date, data.type, data.amount, data.description,
       data.category, data.cashflowCatId, c.get("auth").userId]
    );
    await logAudit(c, "kasa_entry_create", { amount: data.amount, type: data.type }, cid);
    return c.json(result, 201);
  }
);

kasa.delete("/:cid/kasa-entries/:id", requireCompanyAccess("editor"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const id = Number(c.req.param("id"));
  const result = await pool.query(
    `DELETE FROM kasa_entries ke
     USING kasa_accounts ka
     WHERE ke.kasa_account_id = ka.id AND ke.id = $1 AND ka.company_id = $2`,
    [id, cid]
  );
  if (result.rowCount === 0) throw new HTTPException(404, { message: "Kayıt bulunamadı" });
  await logAudit(c, "kasa_entry_delete", { id }, cid);
  return new Response(null, { status: 204 });
});

// ================================================================
// TRANSFERS
// ================================================================
export const transfers = new Hono();
transfers.use("*", authMiddleware);

transfers.get("/:cid/transfers", requireCompanyAccess("viewer"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const rows = await queryMany(
    `SELECT id, date::text AS date, from_type AS "fromType", from_id AS "fromId",
            to_type AS "toType", to_id AS "toId",
            from_amount::float AS "fromAmount", to_amount::float AS "toAmount",
            from_currency AS "fromCurrency", to_currency AS "toCurrency",
            description, cashflow_cat_id AS "cashflowCatId",
            committed_to_cells AS "committedToCells",
            created_at AS "createdAt", created_by AS "createdBy"
     FROM transfers WHERE company_id = $1 ORDER BY date DESC, id DESC`,
    [cid]
  );
  return c.json(rows);
});

transfers.post(
  "/:cid/transfers",
  requireCompanyAccess("editor"),
  zValidator("json", z.object({
    date: z.string(),
    fromType: z.enum(["bank", "kasa"]),
    fromId: z.number().int(),
    toType: z.enum(["bank", "kasa"]),
    toId: z.number().int(),
    fromAmount: z.number().positive(),
    toAmount: z.number().positive(),
    fromCurrency: z.enum(["TRY", "USD", "EUR"]),
    toCurrency: z.enum(["TRY", "USD", "EUR"]),
    description: z.string().optional(),
    cashflowCatId: z.number().int().nullable().optional(),
  })),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const d = c.req.valid("json");
    const result = await queryOne(
      `INSERT INTO transfers (company_id, date, from_type, from_id, to_type, to_id,
        from_amount, to_amount, from_currency, to_currency, description, cashflow_cat_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [cid, d.date, d.fromType, d.fromId, d.toType, d.toId, d.fromAmount, d.toAmount,
       d.fromCurrency, d.toCurrency, d.description, d.cashflowCatId, c.get("auth").userId]
    );
    await logAudit(c, "transfer_create", { amount: d.fromAmount, from: `${d.fromType}#${d.fromId}`, to: `${d.toType}#${d.toId}` }, cid);
    return c.json(result, 201);
  }
);

transfers.delete("/:cid/transfers/:id", requireCompanyAccess("editor"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const id = Number(c.req.param("id"));
  const result = await pool.query(
    `DELETE FROM transfers WHERE id = $1 AND company_id = $2`, [id, cid]
  );
  if (result.rowCount === 0) throw new HTTPException(404, { message: "Transfer bulunamadı" });
  await logAudit(c, "transfer_delete", { id }, cid);
  return new Response(null, { status: 204 });
});

// ================================================================
// FX (Exchange Rates + Revaluations)
// ================================================================
export const fx = new Hono();
fx.use("*", authMiddleware);

fx.get("/exchange-rates", async (c) => {
  const rates = await getCurrentRates();
  return c.json({ ...rates, fetchedAt: new Date().toISOString() });
});

fx.post("/exchange-rates/fetch-tcmb", requireRole("editor"), async (c) => {
  try {
    const result = await fetchAndStoreTodaysRates();
    await logAudit(c, "tcmb_fetch", result);
    return c.json(result);
  } catch (err: any) {
    throw new HTTPException(503, { message: `TCMB API hatası: ${err.message}` });
  }
});

fx.get("/exchange-rates/history", async (c) => {
  const currency = c.req.query("currency");
  const from = c.req.query("from");
  const to = c.req.query("to");

  let sql = `SELECT date::text AS date, currency, rate::float AS rate
             FROM exchange_rate_history WHERE 1=1`;
  const params: any[] = [];
  let pi = 1;
  if (currency) { sql += ` AND currency = $${pi++}`; params.push(currency); }
  if (from) { sql += ` AND date >= $${pi++}`; params.push(from); }
  if (to) { sql += ` AND date <= $${pi++}`; params.push(to); }
  sql += ` ORDER BY date DESC LIMIT 365`;
  return c.json(await queryMany(sql, params));
});

fx.get("/:cid/revaluations", requireCompanyAccess("viewer"), async (c) => {
  const cid = Number(c.req.param("cid"));
  return c.json(await queryMany(
    `SELECT id, reference_date::text AS "referenceDate",
            valuation_date::text AS "valuationDate",
            usd_rate_1::float AS "usdRate1", usd_rate_2::float AS "usdRate2",
            eur_rate_1::float AS "eurRate1", eur_rate_2::float AS "eurRate2",
            gain_total::float AS "gainTotal", loss_total::float AS "lossTotal",
            net::float AS net, details, posted,
            posted_at AS "postedAt", created_at AS "createdAt"
     FROM revaluations WHERE company_id = $1 ORDER BY valuation_date DESC`, [cid]
  ));
});

fx.post(
  "/:cid/revaluations",
  requireCompanyAccess("cfo"),
  zValidator("json", z.object({
    referenceDate: z.string(),
    valuationDate: z.string(),
    usdRate1: z.number().optional(),
    usdRate2: z.number().optional(),
    eurRate1: z.number().optional(),
    eurRate2: z.number().optional(),
    gainTotal: z.number().default(0),
    lossTotal: z.number().default(0),
    details: z.array(z.any()).default([]),
  })),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const d = c.req.valid("json");
    const net = d.gainTotal - d.lossTotal;
    const result = await queryOne(
      `INSERT INTO revaluations (company_id, reference_date, valuation_date,
        usd_rate_1, usd_rate_2, eur_rate_1, eur_rate_2,
        gain_total, loss_total, net, details, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [cid, d.referenceDate, d.valuationDate,
       d.usdRate1, d.usdRate2, d.eurRate1, d.eurRate2,
       d.gainTotal, d.lossTotal, net, JSON.stringify(d.details), c.get("auth").userId]
    );
    await logAudit(c, "revaluation_create", { net, valuationDate: d.valuationDate }, cid);
    return c.json(result, 201);
  }
);

// ================================================================
// ARCHIVES
// ================================================================
export const archives = new Hono();
archives.use("*", authMiddleware);

archives.get("/:cid/archives", requireCompanyAccess("viewer"), async (c) => {
  const cid = Number(c.req.param("cid"));
  return c.json(await queryMany(
    `SELECT id, fiscal_year AS "fiscalYear", fiscal_start_month AS "fiscalStartMonth",
            opening_cash::float AS "openingCash",
            closing_cash::float AS "closingCash",
            total_inflow::float AS "totalInflow",
            total_outflow::float AS "totalOutflow",
            archived_at AS "archivedAt", archived_by AS "archivedBy"
     FROM year_archives WHERE company_id = $1 ORDER BY fiscal_year DESC`, [cid]
  ));
});

archives.get("/:cid/archives/:year", requireCompanyAccess("viewer"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const year = Number(c.req.param("year"));
  const result = await queryOne(
    `SELECT id, fiscal_year AS "fiscalYear", fiscal_start_month AS "fiscalStartMonth",
            opening_cash::float AS "openingCash",
            closing_cash::float AS "closingCash",
            total_inflow::float AS "totalInflow",
            total_outflow::float AS "totalOutflow",
            snapshot,
            archived_at AS "archivedAt", archived_by AS "archivedBy"
     FROM year_archives WHERE company_id = $1 AND fiscal_year = $2`, [cid, year]
  );
  if (!result) throw new HTTPException(404, { message: "Arşiv bulunamadı" });
  return c.json(result);
});

archives.post(
  "/:cid/archives/close-year",
  requireCompanyAccess("cfo"),
  zValidator("json", z.object({
    newFiscalYear: z.number().int(),
    newFiscalStartMonth: z.number().int().min(0).max(11),
    newOpeningCash: z.number(),
    carryCategories: z.boolean().default(true),
    clearCells: z.boolean().default(true),
  })),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const d = c.req.valid("json");

    const result = await transaction(async (client) => {
      // Mevcut yıl bilgisini al
      const comp = await client.query<any>(
        `SELECT fiscal_year, fiscal_start_month, opening_cash FROM companies WHERE id = $1`,
        [cid]
      );
      if (comp.rowCount === 0) throw new Error("Şirket bulunamadı");
      const currentFy = comp.rows[0].fiscal_year;
      if (d.newFiscalYear <= currentFy) {
        throw new Error("Yeni mali yıl mevcut yıldan büyük olmalı");
      }

      // Kategori snapshot
      const cats = await client.query<any>(
        `SELECT id, section, name, sort_order FROM categories WHERE company_id = $1`, [cid]
      );

      // Hücre snapshot
      const cells = await client.query<any>(
        `SELECT category_id, month_idx, value::float AS value FROM cells
         WHERE company_id = $1 AND fiscal_year = $2`, [cid, currentFy]
      );
      const cellsMap: Record<string, number> = {};
      let totalInflow = 0, totalOutflow = 0;
      for (const row of cells.rows) {
        cellsMap[`${row.category_id}:${row.month_idx}`] = row.value;
      }

      const inflows = cats.rows.filter(c => c.section === "inflows");
      const outflows = cats.rows.filter(c => c.section === "outflows");
      const nonPnlOutflows = cats.rows.filter(c => c.section === "nonPnlOutflows");

      for (const cat of inflows) {
        for (let i = 0; i < 12; i++) {
          totalInflow += cellsMap[`${cat.id}:${i}`] ?? 0;
        }
      }
      for (const cat of outflows) {
        for (let i = 0; i < 12; i++) {
          totalOutflow += cellsMap[`${cat.id}:${i}`] ?? 0;
        }
      }
      let totalNonPnl = 0;
      for (const cat of nonPnlOutflows) {
        for (let i = 0; i < 12; i++) {
          totalNonPnl += cellsMap[`${cat.id}:${i}`] ?? 0;
        }
      }
      const closingCash = parseFloat(comp.rows[0].opening_cash) + totalInflow - totalOutflow - totalNonPnl;

      // Arşiv kaydı
      await client.query(
        `INSERT INTO year_archives (company_id, fiscal_year, fiscal_start_month,
          opening_cash, closing_cash, total_inflow, total_outflow, snapshot, archived_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [cid, currentFy, comp.rows[0].fiscal_start_month,
         comp.rows[0].opening_cash, closingCash, totalInflow, totalOutflow,
         JSON.stringify({ inflows, outflows, nonPnlOutflows, cells: cellsMap }),
         c.get("auth").userId]
      );

      // Yeni yıla geç
      await client.query(
        `UPDATE companies SET fiscal_year = $1, fiscal_start_month = $2, opening_cash = $3 WHERE id = $4`,
        [d.newFiscalYear, d.newFiscalStartMonth, d.newOpeningCash, cid]
      );

      // Hücreleri temizle (yeni yıl boş başlasın)
      if (d.clearCells) {
        await client.query(
          `DELETE FROM cells WHERE company_id = $1 AND fiscal_year = $2`,
          [cid, currentFy]
        );
      }

      // Kategorileri taşıma → aynı kategoriler kalır (categories tablosu year-agnostic)

      return { archivedYear: currentFy, closingCash, newFiscalYear: d.newFiscalYear };
    });

    await logAudit(c, "year_archive", result, cid);
    return c.json(result);
  }
);

archives.delete("/:cid/archives/:year", requireCompanyAccess("cfo"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const year = Number(c.req.param("year"));
  const result = await pool.query(
    `DELETE FROM year_archives WHERE company_id = $1 AND fiscal_year = $2`,
    [cid, year]
  );
  if (result.rowCount === 0) throw new HTTPException(404, { message: "Arşiv bulunamadı" });
  await logAudit(c, "year_archive_delete", { fiscalYear: year }, cid);
  return new Response(null, { status: 204 });
});

// ================================================================
// AUDIT LOGS
// ================================================================
export const audit = new Hono();
audit.use("*", authMiddleware);

audit.get("/", requireRole("cfo"), async (c) => {
  const companyId = c.req.query("companyId");
  const userId = c.req.query("userId");
  const action = c.req.query("action");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 1000);
  const offset = Number(c.req.query("offset") ?? 0);

  let sql = `SELECT id, user_id AS "userId", username, company_id AS "companyId",
             action, details, ip_address::text AS "ipAddress",
             user_agent AS "userAgent", timestamp
             FROM audit_logs WHERE 1=1`;
  const params: any[] = [];
  let pi = 1;
  if (companyId) { sql += ` AND company_id = $${pi++}`; params.push(Number(companyId)); }
  if (userId) { sql += ` AND user_id = $${pi++}`; params.push(Number(userId)); }
  if (action) { sql += ` AND action = $${pi++}`; params.push(action); }
  if (from) { sql += ` AND timestamp >= $${pi++}`; params.push(from); }
  if (to) { sql += ` AND timestamp <= $${pi++}`; params.push(to); }

  const countSql = sql.replace(/SELECT[\s\S]*?FROM/, "SELECT COUNT(*)::int AS total FROM");
  const [items, totalRow] = await Promise.all([
    queryMany(sql + ` ORDER BY timestamp DESC LIMIT $${pi++} OFFSET $${pi++}`,
              [...params, limit, offset]),
    queryOne<{ total: number }>(countSql, params),
  ]);
  return c.json({ total: totalRow?.total ?? 0, items });
});

// ================================================================
// NOTIFICATIONS
// ================================================================
export const notifications = new Hono();
notifications.use("*", authMiddleware);

notifications.get("/:cid/notification-settings", requireCompanyAccess("viewer"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const result = await queryOne(
    `SELECT enabled, recipients, alert_threshold_days AS "alertThresholdDays",
            include_overdue AS "includeOverdue",
            include_due_soon AS "includeDueSoon",
            include_upcoming_30 AS "includeUpcoming30",
            include_cash_position AS "includeCashPosition",
            include_fx_positions AS "includeFxPositions",
            last_generated_at AS "lastGeneratedAt",
            last_sent_at AS "lastSentAt",
            cron_schedule AS "cronSchedule"
     FROM notification_settings WHERE company_id = $1`, [cid]
  );
  return c.json(result);
});

notifications.patch(
  "/:cid/notification-settings",
  requireCompanyAccess("cfo"),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const body = await c.req.json();
    const map: Record<string, string> = {
      enabled: "enabled", recipients: "recipients",
      alertThresholdDays: "alert_threshold_days",
      includeOverdue: "include_overdue",
      includeDueSoon: "include_due_soon",
      includeUpcoming30: "include_upcoming_30",
      includeCashPosition: "include_cash_position",
      includeFxPositions: "include_fx_positions",
      cronSchedule: "cron_schedule",
    };
    const fields: string[] = [], params: any[] = [];
    let pi = 1;
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && map[k]) { fields.push(`${map[k]} = $${pi++}`); params.push(v); }
    }
    if (fields.length === 0) throw new HTTPException(400, { message: "Güncellenecek alan yok" });
    params.push(cid);
    await execute(
      `UPDATE notification_settings SET ${fields.join(", ")} WHERE company_id = $${pi}`, params
    );
    await logAudit(c, "notification_settings", { changes: body }, cid);
    return new Response(null, { status: 204 });
  }
);

notifications.post(
  "/:cid/notifications/generate",
  requireCompanyAccess("cfo"),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const result = await generateDailyReport(cid);
    await pool.query(
      `UPDATE notification_settings SET last_generated_at = NOW() WHERE company_id = $1`, [cid]
    );
    await logAudit(c, "notification_generate", { summary: result.summary }, cid);
    return c.json({ ...result, sentAt: new Date().toISOString() });
  }
);

notifications.post(
  "/:cid/notifications/send",
  requireCompanyAccess("cfo"),
  async (c) => {
    const cid = Number(c.req.param("cid"));
    const result = await sendDailyReport(cid);
    await logAudit(c, "notification_send", { recipients: result.sentTo }, cid);
    return c.json(result);
  }
);

// ================================================================
// AI PREDICTIONS
// ================================================================
export const ai = new Hono();
ai.use("*", authMiddleware);

ai.get("/:cid/ai/predictions", requireCompanyAccess("viewer"), async (c) => {
  const cid = Number(c.req.param("cid"));
  const horizon = Math.min(Number(c.req.query("horizon") ?? 3), 12);
  const useArchives = c.req.query("useArchives") !== "false";
  const result = await predictForCompany(cid, horizon, useArchives);
  return c.json(result);
});
