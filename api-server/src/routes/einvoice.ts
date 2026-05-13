/**
 * E-Fatura HTTP Routes
 * --------------------
 * /einvoice/* altında tüm endpoint'ler.
 * Tüm route'lar JWT + role kontrolü gerektirir (admin/cfo).
 */

import { Hono } from "hono";
import { requireAuth, requireRole, requireCompanyAccess } from "../middleware/auth";
import * as einvoiceService from "../services/einvoice";
import { ELogoProvider } from "../services/einvoice/elogo";
import { sql } from "../db";

export const einvoiceRoutes = new Hono();

einvoiceRoutes.use("*", requireAuth);

// ─── Status / Bağlantı Durumu ─────────────────────────────────────────
einvoiceRoutes.get("/status", requireCompanyAccess, async (c) => {
  const companyId = c.req.query("companyId")!;
  const rows = await sql/*sql*/`
    SELECT
      provider, is_active, auto_sync_enabled, auto_sync_cron,
      last_sync_at, last_sync_status, last_sync_incoming, last_sync_outgoing,
      created_at, updated_at
    FROM einvoice_credentials
    WHERE company_id = ${companyId}
    ORDER BY provider
  `;
  return c.json({ providers: rows });
});

// ─── Credentials Kaydet ───────────────────────────────────────────────
einvoiceRoutes.post("/connect", requireRole(["admin", "cfo"]), requireCompanyAccess, async (c) => {
  const user = c.get("user") as any;
  const body = await c.req.json();
  const { companyId, provider, config, autoSyncEnabled, autoSyncCron } = body;

  if (!companyId || !provider || !config) {
    return c.json({ error: "companyId, provider, config zorunlu" }, 400);
  }
  if (!config.username || !config.password || !config.vergiNo) {
    return c.json({ error: "config.username, password, vergiNo zorunlu" }, 400);
  }

  // Önce credentials'ı kaydet, sonra test et (kaydedip test ile UI bilgi versin)
  const saved = await einvoiceService.saveCredentials({
    companyId, provider, config, autoSyncEnabled, autoSyncCron,
    createdBy: user.id,
  });

  // Bağlantı testini paralel yap
  let testResult;
  try {
    testResult = await einvoiceService.testConnection(companyId, provider);
  } catch (err: any) {
    testResult = { ok: false, message: err.message };
  }

  return c.json({ saved, test: testResult });
});

// ─── Bağlantı Test ────────────────────────────────────────────────────
einvoiceRoutes.post("/test/:provider", requireCompanyAccess, async (c) => {
  const companyId = c.req.query("companyId")!;
  const provider = c.req.param("provider");
  try {
    const result = await einvoiceService.testConnection(companyId, provider);
    return c.json(result);
  } catch (err: any) {
    return c.json({ ok: false, message: err.message }, 400);
  }
});

// ─── Credentials Sil ──────────────────────────────────────────────────
einvoiceRoutes.delete("/connect/:provider", requireRole(["admin"]), requireCompanyAccess, async (c) => {
  const companyId = c.req.query("companyId")!;
  const provider = c.req.param("provider");
  await einvoiceService.deleteCredentials(companyId, provider);
  return c.json({ ok: true });
});

// ─── Senkron Tetikle ──────────────────────────────────────────────────
einvoiceRoutes.post("/sync", requireRole(["admin", "cfo"]), requireCompanyAccess, async (c) => {
  const user = c.get("user") as any;
  const body = await c.req.json();
  const { companyId, provider, dateFrom, dateTo, direction = "both" } = body;

  if (!companyId || !provider || !dateFrom || !dateTo) {
    return c.json({ error: "companyId, provider, dateFrom, dateTo zorunlu" }, 400);
  }

  const result = await einvoiceService.sync({
    companyId, provider, dateFrom, dateTo, direction,
    triggeredBy: user.id, trigger: "manual",
  });
  return c.json(result);
});

// ─── Cache'deki Fatura Listesi ────────────────────────────────────────
einvoiceRoutes.get("/invoices", requireCompanyAccess, async (c) => {
  const companyId = c.req.query("companyId")!;
  const direction = c.req.query("direction") as "incoming" | "outgoing" | undefined;
  const pending = c.req.query("pending") === "true";
  const dateFrom = c.req.query("dateFrom");
  const dateTo = c.req.query("dateTo");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 100;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : 0;

  const rows = await einvoiceService.listInvoices(companyId, {
    direction, pending, dateFrom, dateTo, limit, offset,
  });
  return c.json({ invoices: rows });
});

// ─── Tek Fatura — Detay + XML (lazy fetch) ────────────────────────────
einvoiceRoutes.get("/invoices/:id", requireCompanyAccess, async (c) => {
  const companyId = c.req.query("companyId")!;
  const id = c.req.param("id");
  const rows = await sql/*sql*/`
    SELECT * FROM einvoice_invoices
    WHERE id = ${id} AND company_id = ${companyId}
    LIMIT 1
  `;
  if (rows.length === 0) return c.json({ error: "Fatura bulunamadı" }, 404);
  return c.json(rows[0]);
});

einvoiceRoutes.get("/invoices/:id/xml", requireCompanyAccess, async (c) => {
  const companyId = c.req.query("companyId")!;
  const id = c.req.param("id");
  try {
    const xml = await einvoiceService.fetchXmlOnDemand(companyId, id);
    return new Response(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Faturayı Nakit Akış Tablosuna Aktar ──────────────────────────────
einvoiceRoutes.post("/invoices/:id/import", requireRole(["admin", "cfo"]), requireCompanyAccess, async (c) => {
  const user = c.get("user") as any;
  const companyId = c.req.query("companyId")!;
  const id = c.req.param("id");
  const body = await c.req.json();

  if (!body.cashflowCatId) {
    return c.json({ error: "cashflowCatId zorunlu" }, 400);
  }

  try {
    const result = await einvoiceService.importToCashflow({
      companyId,
      einvoiceId: id,
      cashflowCatId: body.cashflowCatId,
      importedBy: user.id,
    });
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// ─── Faturayı Yok Say ─────────────────────────────────────────────────
einvoiceRoutes.post("/invoices/:id/ignore", requireRole(["admin", "cfo"]), requireCompanyAccess, async (c) => {
  const companyId = c.req.query("companyId")!;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  await sql/*sql*/`
    UPDATE einvoice_invoices
    SET ignored = true, ignored_reason = ${body.reason || null}, updated_at = NOW()
    WHERE id = ${id} AND company_id = ${companyId}
  `;
  return c.json({ ok: true });
});

// ─── Bulk Import (Banka Excel gibi toplu) ─────────────────────────────
einvoiceRoutes.post("/invoices/bulk-import", requireRole(["admin", "cfo"]), requireCompanyAccess, async (c) => {
  const user = c.get("user") as any;
  const body = await c.req.json();
  const { companyId, items } = body as {
    companyId: string;
    items: Array<{ einvoiceId: string; cashflowCatId: string }>;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return c.json({ error: "items dizisi boş" }, 400);
  }

  const results = [];
  for (const it of items) {
    try {
      const r = await einvoiceService.importToCashflow({
        companyId, einvoiceId: it.einvoiceId,
        cashflowCatId: it.cashflowCatId, importedBy: user.id,
      });
      results.push({ einvoiceId: it.einvoiceId, ok: true, invoiceId: r.invoiceId });
    } catch (err: any) {
      results.push({ einvoiceId: it.einvoiceId, ok: false, error: err.message });
    }
  }

  return c.json({
    results,
    successCount: results.filter(r => r.ok).length,
    errorCount: results.filter(r => !r.ok).length,
  });
});

// ─── Karşı Taraf Eşleme (VKN → cari) ──────────────────────────────────
einvoiceRoutes.get("/parties", requireCompanyAccess, async (c) => {
  const companyId = c.req.query("companyId")!;
  const rows = await sql/*sql*/`
    SELECT * FROM einvoice_party_mapping
    WHERE company_id = ${companyId}
    ORDER BY display_name
  `;
  return c.json({ parties: rows });
});

einvoiceRoutes.post("/parties", requireRole(["admin", "cfo"]), requireCompanyAccess, async (c) => {
  const body = await c.req.json();
  const { companyId, vknTckn, displayName, cashflowCatId, autoImport, notes } = body;
  if (!vknTckn) return c.json({ error: "vknTckn zorunlu" }, 400);
  await sql/*sql*/`
    INSERT INTO einvoice_party_mapping
      (company_id, vkn_tckn, display_name, cashflow_cat_id, auto_import, notes)
    VALUES (${companyId}, ${vknTckn}, ${displayName || null}, ${cashflowCatId || null},
            ${autoImport || false}, ${notes || null})
    ON CONFLICT (company_id, vkn_tckn) DO UPDATE SET
      display_name = ${displayName || null},
      cashflow_cat_id = ${cashflowCatId || null},
      auto_import = ${autoImport || false},
      notes = ${notes || null},
      updated_at = NOW()
  `;
  return c.json({ ok: true });
});

// ─── Sync Log ─────────────────────────────────────────────────────────
einvoiceRoutes.get("/sync-log", requireCompanyAccess, async (c) => {
  const companyId = c.req.query("companyId")!;
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 50;
  const rows = await sql/*sql*/`
    SELECT id, provider, trigger, started_at, finished_at, status,
           incoming_fetched, incoming_new, outgoing_fetched, outgoing_new,
           errors_count, error_message, date_from, date_to
    FROM einvoice_sync_log
    WHERE company_id = ${companyId}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  return c.json({ logs: rows });
});

// ─── Demo / Mock Veri (geliştirme) ────────────────────────────────────
einvoiceRoutes.post("/mock/seed", requireRole(["admin"]), requireCompanyAccess, async (c) => {
  const companyId = c.req.query("companyId")!;
  const summaries = ELogoProvider.mockSummaries(30);
  let inserted = 0;
  for (const s of summaries) {
    try {
      await sql/*sql*/`
        INSERT INTO einvoice_invoices
          (company_id, provider, uuid, invoice_no, direction, invoice_type, scenario,
           party_vkn_tckn, party_name, issue_date, currency,
           subtotal, kdv_total, payable_amount, gib_status)
        VALUES (${companyId}, 'mock', ${s.uuid}, ${s.invoiceNo}, ${s.direction},
                ${s.invoiceType}, ${s.scenario}, ${s.partyVknTckn}, ${s.partyName},
                ${s.issueDate}, ${s.currency},
                ${s.subtotal}, ${s.kdvTotal}, ${s.payableAmount}, ${s.gibStatus})
        ON CONFLICT (company_id, uuid) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      // ignore duplicates
    }
  }
  return c.json({ ok: true, inserted });
});
