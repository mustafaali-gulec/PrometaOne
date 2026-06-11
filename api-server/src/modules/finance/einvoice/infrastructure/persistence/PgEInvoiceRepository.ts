/**
 * PgEInvoiceRepository — einvoice_invoices (016). UNIQUE(company_id, uuid) ile
 * idempotent upsert. lines DB'de tutulmaz (transient); okurken boş döner.
 */
import { toCurrency, type Currency } from '../../../domain/valueObjects/Currency.js';
import { Money } from '../../../domain/valueObjects/Money.js';
import type { Queryable } from '../../../infrastructure/persistence/Queryable.js';
import type { EInvoiceRepository } from '../../application/ports/EInvoiceRepositories.js';
import { EInvoice } from '../../domain/entities/EInvoice.js';
import { toInvoiceDirection } from '../../domain/valueObjects/InvoiceDirection.js';
import type { InvoiceDirection } from '../../domain/valueObjects/InvoiceDirection.js';
import { toProviderType } from '../../domain/valueObjects/ProviderType.js';

interface EInvoiceRow {
  id: number;
  company_id: number;
  provider: string;
  uuid: string;
  invoice_no: string;
  direction: string;
  invoice_type: string | null;
  scenario: string | null;
  party_vkn_tckn: string | null;
  party_name: string | null;
  party_alias: string | null;
  issue_date: string;
  due_date: string | null;
  currency: string;
  exchange_rate: string | null;
  subtotal: string | null;
  kdv_total: string | null;
  tevkifat_total: string | null;
  konaklama_vergisi: string | null;
  ozel_tuketim_vergisi: string | null;
  payable_amount: string;
  gib_status: string | null;
  imported_invoice_id: number | null;
  ignored: boolean;
  ignored_reason: string | null;
  notes: string | null;
  xml_raw: string | null;
}

const SELECT = `
  SELECT id, company_id, provider, uuid, invoice_no, direction, invoice_type, scenario,
         party_vkn_tckn, party_name, party_alias,
         to_char(issue_date, 'YYYY-MM-DD') AS issue_date,
         to_char(due_date, 'YYYY-MM-DD') AS due_date,
         currency, exchange_rate, subtotal, kdv_total, tevkifat_total,
         konaklama_vergisi, ozel_tuketim_vergisi, payable_amount, gib_status,
         imported_invoice_id, ignored, ignored_reason, notes, xml_raw
    FROM einvoice_invoices`;

export class PgEInvoiceRepository implements EInvoiceRepository {
  constructor(private readonly db: Queryable) {}

  async upsert(einvoice: EInvoice): Promise<EInvoice> {
    const p = einvoice.toPersistence();
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO einvoice_invoices
         (company_id, provider, uuid, invoice_no, direction, invoice_type, scenario,
          party_vkn_tckn, party_name, party_alias, issue_date, due_date, currency,
          exchange_rate, subtotal, kdv_total, tevkifat_total, konaklama_vergisi,
          ozel_tuketim_vergisi, payable_amount, gib_status, imported_invoice_id,
          ignored, ignored_reason, notes, xml_raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       ON CONFLICT (company_id, uuid) DO UPDATE SET
         invoice_no = EXCLUDED.invoice_no, direction = EXCLUDED.direction,
         invoice_type = EXCLUDED.invoice_type, scenario = EXCLUDED.scenario,
         party_vkn_tckn = EXCLUDED.party_vkn_tckn, party_name = EXCLUDED.party_name,
         party_alias = EXCLUDED.party_alias, issue_date = EXCLUDED.issue_date,
         due_date = EXCLUDED.due_date, currency = EXCLUDED.currency,
         exchange_rate = EXCLUDED.exchange_rate, subtotal = EXCLUDED.subtotal,
         kdv_total = EXCLUDED.kdv_total, tevkifat_total = EXCLUDED.tevkifat_total,
         konaklama_vergisi = EXCLUDED.konaklama_vergisi,
         ozel_tuketim_vergisi = EXCLUDED.ozel_tuketim_vergisi,
         payable_amount = EXCLUDED.payable_amount, gib_status = EXCLUDED.gib_status,
         notes = EXCLUDED.notes, xml_raw = EXCLUDED.xml_raw, updated_at = NOW()
       RETURNING id`,
      [
        p.companyId,
        p.provider,
        p.uuid,
        p.invoiceNo,
        p.direction,
        p.invoiceType,
        p.scenario,
        p.partyVknTckn,
        p.partyName,
        p.partyAlias,
        p.issueDate,
        p.dueDate,
        p.currency,
        p.exchangeRate,
        p.subtotal,
        p.kdvTotal,
        p.tevkifatTotal,
        p.konaklamaVergisi,
        p.ozelTuketimVergisi,
        p.payableAmount,
        p.gibStatus,
        p.importedInvoiceId,
        p.ignored,
        p.ignoredReason,
        p.notes,
        p.xmlRaw,
      ],
    );
    return einvoice.withId(r.rows[0]!.id);
  }

  async update(einvoice: EInvoice): Promise<void> {
    const p = einvoice.toPersistence();
    await this.db.query(
      `UPDATE einvoice_invoices SET
         imported_invoice_id = $1, ignored = $2, ignored_reason = $3,
         gib_status = $4, updated_at = NOW()
       WHERE id = $5 AND company_id = $6`,
      [
        p.importedInvoiceId,
        p.ignored,
        p.ignoredReason,
        p.gibStatus,
        einvoice.id,
        einvoice.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<EInvoice | null> {
    const r = await this.db.query<EInvoiceRow>(
      `${SELECT} WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToEInvoice(row) : null;
  }

  async findByUuid(companyId: number, uuid: string): Promise<EInvoice | null> {
    const r = await this.db.query<EInvoiceRow>(
      `${SELECT} WHERE company_id = $1 AND uuid = $2 LIMIT 1`,
      [companyId, uuid],
    );
    const row = r.rows[0];
    return row ? rowToEInvoice(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { direction?: InvoiceDirection; pendingOnly?: boolean },
  ): Promise<ReadonlyArray<EInvoice>> {
    const conditions = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.direction !== undefined) {
      params.push(options.direction);
      conditions.push(`direction = $${params.length}`);
    }
    if (options?.pendingOnly === true) {
      conditions.push('imported_invoice_id IS NULL AND ignored = FALSE');
    }
    const r = await this.db.query<EInvoiceRow>(
      `${SELECT} WHERE ${conditions.join(' AND ')} ORDER BY issue_date DESC, id DESC`,
      params,
    );
    return r.rows.map(rowToEInvoice);
  }
}

function money(value: string | null, currency: Currency): Money {
  return value === null ? Money.zero(currency) : Money.fromDecimalString(value, currency);
}

function rowToEInvoice(row: EInvoiceRow): EInvoice {
  const currency = toCurrency(row.currency);
  return EInvoice.create({
    id: row.id,
    companyId: row.company_id,
    provider: toProviderType(row.provider),
    uuid: row.uuid,
    invoiceNo: row.invoice_no,
    direction: toInvoiceDirection(row.direction),
    invoiceType: row.invoice_type,
    scenario: row.scenario,
    partyVknTckn: row.party_vkn_tckn,
    partyName: row.party_name,
    partyAlias: row.party_alias,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency,
    exchangeRate: row.exchange_rate === null ? null : Number(row.exchange_rate),
    subtotal: money(row.subtotal, currency),
    kdvTotal: money(row.kdv_total, currency),
    tevkifatTotal: money(row.tevkifat_total, currency),
    konaklamaVergisi: money(row.konaklama_vergisi, currency),
    ozelTuketimVergisi: money(row.ozel_tuketim_vergisi, currency),
    payableAmount: money(row.payable_amount, currency),
    gibStatus: row.gib_status,
    importedInvoiceId: row.imported_invoice_id,
    ignored: row.ignored,
    ignoredReason: row.ignored_reason,
    notes: row.notes,
    lines: [],
    xmlRaw: row.xml_raw,
  });
}
