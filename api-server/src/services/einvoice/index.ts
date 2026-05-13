/**
 * E-Fatura Ana Servisi
 * --------------------
 * Provider seçimi, credentials yönetimi, sync orchestration ve DB cache.
 *
 * Akış:
 *   1. Provider seç (config.provider'a göre)
 *   2. Credentials'ı decrypt et
 *   3. Provider'dan faturaları çek
 *   4. einvoice_invoices tablosuna upsert
 *   5. einvoice_sync_log'a kaydet
 */

import { sql } from "../../db";
import { encryptConfig, decryptConfig } from "./crypto";
import { ELogoProvider } from "./elogo";
import type {
  IEInvoiceProvider, EInvoiceProviderConfig, EInvoiceSummary,
  FetchInvoicesParams,
} from "./types";

// ─── Provider Registry ─────────────────────────────────────────────────

const PROVIDERS: Record<string, IEInvoiceProvider> = {
  elogo: new ELogoProvider(),
  // qnb_efinans: new QNBEFinansProvider(),  // gelecekte
  // logo_db: new LogoDBProvider(),          // gelecekte
};

function getProvider(name: string): IEInvoiceProvider {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Bilinmeyen e-fatura provider: ${name}`);
  return p;
}

// ─── Credentials Yönetimi ──────────────────────────────────────────────

export interface SaveCredentialsInput {
  companyId: string;
  provider: string;
  config: EInvoiceProviderConfig;
  autoSyncEnabled?: boolean;
  autoSyncCron?: string;
  createdBy: string;
}

export async function saveCredentials(input: SaveCredentialsInput) {
  const { ciphertext, iv, tag } = encryptConfig(input.config);

  // Önce mevcut credential'ı kontrol et — varsa update
  const existing = await sql/*sql*/`
    SELECT id FROM einvoice_credentials
    WHERE company_id = ${input.companyId} AND provider = ${input.provider}
    LIMIT 1
  `;

  if (existing.length > 0) {
    await sql/*sql*/`
      UPDATE einvoice_credentials SET
        config_encrypted = ${ciphertext},
        config_iv = ${iv},
        config_tag = ${tag},
        auto_sync_enabled = ${input.autoSyncEnabled ?? false},
        auto_sync_cron = ${input.autoSyncCron ?? "0 6 * * *"},
        updated_at = NOW()
      WHERE id = ${existing[0].id}
    `;
    return { id: existing[0].id, updated: true };
  }

  const [row] = await sql/*sql*/`
    INSERT INTO einvoice_credentials
      (company_id, provider, config_encrypted, config_iv, config_tag,
       auto_sync_enabled, auto_sync_cron, created_by)
    VALUES (${input.companyId}, ${input.provider}, ${ciphertext}, ${iv}, ${tag},
            ${input.autoSyncEnabled ?? false}, ${input.autoSyncCron ?? "0 6 * * *"},
            ${input.createdBy})
    RETURNING id
  `;
  return { id: row.id, updated: false };
}

export async function getCredentials(companyId: string, provider: string): Promise<EInvoiceProviderConfig | null> {
  const rows = await sql/*sql*/`
    SELECT config_encrypted, config_iv, config_tag
    FROM einvoice_credentials
    WHERE company_id = ${companyId} AND provider = ${provider} AND is_active = true
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return decryptConfig<EInvoiceProviderConfig>(r.config_encrypted, r.config_iv, r.config_tag);
}

export async function deleteCredentials(companyId: string, provider: string) {
  await sql/*sql*/`
    DELETE FROM einvoice_credentials
    WHERE company_id = ${companyId} AND provider = ${provider}
  `;
}

// ─── Test Connection ───────────────────────────────────────────────────

export async function testConnection(companyId: string, provider: string) {
  const config = await getCredentials(companyId, provider);
  if (!config) throw new Error("Credentials kayıtlı değil");
  const p = getProvider(provider);
  return p.testConnection(config);
}

// ─── Sync Orchestration ────────────────────────────────────────────────

export interface SyncOptions {
  companyId: string;
  provider: string;
  dateFrom: string;
  dateTo: string;
  direction: "incoming" | "outgoing" | "both";
  triggeredBy: string;
  trigger: "manual" | "cron" | "api";
}

export interface SyncResult {
  status: "success" | "partial" | "error";
  incomingFetched: number;
  incomingNew: number;
  outgoingFetched: number;
  outgoingNew: number;
  errorMessage?: string;
  durationMs: number;
}

export async function sync(opts: SyncOptions): Promise<SyncResult> {
  const startedAt = new Date();
  const config = await getCredentials(opts.companyId, opts.provider);
  if (!config) throw new Error(`${opts.provider} credentials kayıtlı değil`);

  const [logRow] = await sql/*sql*/`
    INSERT INTO einvoice_sync_log
      (company_id, provider, trigger, triggered_by, date_from, date_to)
    VALUES (${opts.companyId}, ${opts.provider}, ${opts.trigger}, ${opts.triggeredBy},
            ${opts.dateFrom}, ${opts.dateTo})
    RETURNING id
  `;
  const logId = logRow.id;

  const result: SyncResult = {
    status: "success",
    incomingFetched: 0, incomingNew: 0,
    outgoingFetched: 0, outgoingNew: 0,
    durationMs: 0,
  };

  try {
    const provider = getProvider(opts.provider);
    const params: FetchInvoicesParams = {
      dateFrom: opts.dateFrom,
      dateTo: opts.dateTo,
      direction: opts.direction,
      summaryOnly: true,
    };
    const summaries = await provider.fetchInvoices(config, params);

    for (const s of summaries) {
      if (s.direction === "incoming") result.incomingFetched++;
      else result.outgoingFetched++;

      // Upsert — aynı UUID'de varsa güncelle
      const existing = await sql/*sql*/`
        SELECT id FROM einvoice_invoices
        WHERE company_id = ${opts.companyId} AND uuid = ${s.uuid}
        LIMIT 1
      `;

      if (existing.length === 0) {
        await sql/*sql*/`
          INSERT INTO einvoice_invoices
            (company_id, provider, uuid, invoice_no, direction, invoice_type, scenario,
             party_vkn_tckn, party_name, party_alias,
             issue_date, due_date, currency, exchange_rate,
             subtotal, kdv_total, tevkifat_total, payable_amount,
             gib_status, response_code)
          VALUES
            (${opts.companyId}, ${opts.provider}, ${s.uuid}, ${s.invoiceNo}, ${s.direction},
             ${s.invoiceType || null}, ${s.scenario || null},
             ${s.partyVknTckn}, ${s.partyName}, ${s.partyAlias || null},
             ${s.issueDate}, ${s.dueDate || null}, ${s.currency}, ${s.exchangeRate || null},
             ${s.subtotal || null}, ${s.kdvTotal || null}, ${s.tevkifatTotal || null},
             ${s.payableAmount},
             ${s.gibStatus || null}, ${s.responseCode || null})
        `;
        if (s.direction === "incoming") result.incomingNew++;
        else result.outgoingNew++;
      } else {
        // Sadece durum bilgilerini güncelle (XML zaten varsa korunur)
        await sql/*sql*/`
          UPDATE einvoice_invoices SET
            gib_status = ${s.gibStatus || null},
            response_code = ${s.responseCode || null},
            updated_at = NOW()
          WHERE id = ${existing[0].id}
        `;
      }
    }

    result.durationMs = Date.now() - startedAt.getTime();

    await sql/*sql*/`
      UPDATE einvoice_sync_log SET
        finished_at = NOW(),
        status = ${result.status},
        incoming_fetched = ${result.incomingFetched},
        incoming_new = ${result.incomingNew},
        outgoing_fetched = ${result.outgoingFetched},
        outgoing_new = ${result.outgoingNew}
      WHERE id = ${logId}
    `;
    await sql/*sql*/`
      UPDATE einvoice_credentials SET
        last_sync_at = NOW(),
        last_sync_status = ${result.status},
        last_sync_incoming = ${result.incomingNew},
        last_sync_outgoing = ${result.outgoingNew}
      WHERE company_id = ${opts.companyId} AND provider = ${opts.provider}
    `;

    return result;
  } catch (err: any) {
    result.status = "error";
    result.errorMessage = err.message;
    result.durationMs = Date.now() - startedAt.getTime();
    await sql/*sql*/`
      UPDATE einvoice_sync_log SET
        finished_at = NOW(),
        status = 'error',
        errors_count = 1,
        error_message = ${err.message},
        error_stack = ${err.stack || null}
      WHERE id = ${logId}
    `;
    return result;
  }
}

// ─── XML Lazy Fetch ────────────────────────────────────────────────────

export async function fetchXmlOnDemand(companyId: string, invoiceId: string): Promise<string> {
  const rows = await sql/*sql*/`
    SELECT id, uuid, direction, provider, xml_raw
    FROM einvoice_invoices
    WHERE company_id = ${companyId} AND id = ${invoiceId}
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error("Fatura bulunamadı");
  const r = rows[0];
  if (r.xml_raw) return r.xml_raw;

  const config = await getCredentials(companyId, r.provider);
  if (!config) throw new Error("Credentials kayıtlı değil");
  const provider = getProvider(r.provider);
  const xml = await provider.fetchInvoiceXml(config, r.uuid, r.direction);

  await sql/*sql*/`
    UPDATE einvoice_invoices SET xml_raw = ${xml}, updated_at = NOW()
    WHERE id = ${invoiceId}
  `;
  return xml;
}

// ─── Listeleme ─────────────────────────────────────────────────────────

export async function listInvoices(companyId: string, opts: {
  direction?: "incoming" | "outgoing";
  pending?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const conds: any[] = [sql/*sql*/`company_id = ${companyId}`];
  if (opts.direction) conds.push(sql/*sql*/`direction = ${opts.direction}`);
  if (opts.pending) conds.push(sql/*sql*/`imported_invoice_id IS NULL AND ignored = false`);
  if (opts.dateFrom) conds.push(sql/*sql*/`issue_date >= ${opts.dateFrom}`);
  if (opts.dateTo) conds.push(sql/*sql*/`issue_date <= ${opts.dateTo}`);

  // NOTE: bu sözdizimi gerçek SQL helper'ınıza göre değiştirilebilir
  // postgres-js veya pg kullanılıyorsa array conditions birleştirilir
  return sql/*sql*/`
    SELECT * FROM einvoice_invoices
    WHERE company_id = ${companyId}
      ${opts.direction ? sql/*sql*/`AND direction = ${opts.direction}` : sql/*sql*/``}
      ${opts.pending ? sql/*sql*/`AND imported_invoice_id IS NULL AND ignored = false` : sql/*sql*/``}
      ${opts.dateFrom ? sql/*sql*/`AND issue_date >= ${opts.dateFrom}` : sql/*sql*/``}
      ${opts.dateTo ? sql/*sql*/`AND issue_date <= ${opts.dateTo}` : sql/*sql*/``}
    ORDER BY issue_date DESC, invoice_no DESC
    LIMIT ${opts.limit || 100}
    OFFSET ${opts.offset || 0}
  `;
}

// ─── Bizim Invoices Tablosuna Import ───────────────────────────────────

export interface ImportToCashflowInput {
  companyId: string;
  einvoiceId: string;
  cashflowCatId: string;
  importedBy: string;
}

/**
 * Cache'deki einvoice_invoices kaydını bizim invoices tablosuna kopyalar.
 * Promet CF'nin mevcut invoice yapısına uygun şekilde alanları doldurur.
 */
export async function importToCashflow(input: ImportToCashflowInput) {
  const [einv] = await sql/*sql*/`
    SELECT * FROM einvoice_invoices
    WHERE id = ${input.einvoiceId} AND company_id = ${input.companyId}
    LIMIT 1
  `;
  if (!einv) throw new Error("E-fatura bulunamadı");
  if (einv.imported_invoice_id) throw new Error("Bu fatura zaten aktarılmış");

  // Promet CF invoice modeli — invoices tablosu
  const [newInv] = await sql/*sql*/`
    INSERT INTO invoices
      (company_id, invoice_no, type, party_name, party_vkn,
       issue_date, due_date, currency, total, paid_amount, cashflow_cat_id,
       source, source_uuid, created_by)
    VALUES
      (${input.companyId}, ${einv.invoice_no},
       ${einv.direction === "incoming" ? "AP" : "AR"},
       ${einv.party_name}, ${einv.party_vkn_tckn},
       ${einv.issue_date}, ${einv.due_date}, ${einv.currency},
       ${einv.payable_amount}, 0, ${input.cashflowCatId},
       'einvoice', ${einv.uuid}, ${input.importedBy})
    RETURNING id
  `;

  await sql/*sql*/`
    UPDATE einvoice_invoices SET
      imported_invoice_id = ${newInv.id},
      imported_at = NOW(),
      imported_by = ${input.importedBy}
    WHERE id = ${input.einvoiceId}
  `;

  return { invoiceId: newInv.id };
}
