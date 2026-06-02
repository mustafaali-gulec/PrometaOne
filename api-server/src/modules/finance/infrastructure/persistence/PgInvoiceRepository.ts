/**
 * PgInvoiceRepository — InvoiceRepository PG implementasyonu.
 * Tablo: invoices (005). paid_amount trigger (invoice_payments) ile de
 * güncellenir; domain update'i ile uyum için update aynı değeri yazar.
 */
import type { InvoiceRepository } from '../../application/ports/InvoiceRepositories.js';
import { Invoice } from '../../domain/entities/Invoice.js';
import { toCurrency, type Currency } from '../../domain/valueObjects/Currency.js';
import type { FlowDirection } from '../../domain/valueObjects/FlowDirection.js';
import { KdvRate } from '../../domain/valueObjects/KdvRate.js';
import { Money } from '../../domain/valueObjects/Money.js';

import type { Queryable } from './Queryable.js';

interface InvoiceRow {
  id: number;
  company_id: number;
  type: FlowDirection;
  invoice_no: string | null;
  counterparty: string;
  issue_date: string | null;
  due_date: string;
  currency: Currency;
  subtotal: string;
  kdv_rate: string;
  kdv: string;
  total: string;
  paid_amount: string;
  cashflow_cat_id: number | null;
  committed_to_cells: boolean;
  committed_at: Date | null;
  note: string | null;
  created_by: number | null;
}

const SELECT = `SELECT id, company_id, type, invoice_no, counterparty,
          to_char(issue_date, 'YYYY-MM-DD') AS issue_date,
          to_char(due_date, 'YYYY-MM-DD') AS due_date,
          currency, subtotal, kdv_rate, kdv, total, paid_amount,
          cashflow_cat_id, committed_to_cells, committed_at, note, created_by
     FROM invoices`;

export class PgInvoiceRepository implements InvoiceRepository {
  constructor(private readonly db: Queryable) {}

  async insert(invoice: Invoice): Promise<Invoice> {
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO invoices
         (company_id, type, invoice_no, counterparty, issue_date, due_date, currency,
          subtotal, kdv_rate, kdv, total, paid_amount, cashflow_cat_id,
          committed_to_cells, committed_at, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        invoice.companyId,
        invoice.type,
        invoice.invoiceNo,
        invoice.counterparty,
        invoice.issueDate,
        invoice.dueDate,
        invoice.currency,
        invoice.subtotal.toDecimalString(),
        invoice.kdvRate.value,
        invoice.kdv.toDecimalString(),
        invoice.total.toDecimalString(),
        invoice.paidAmount.toDecimalString(),
        invoice.cashflowCatId,
        invoice.committedToCells,
        invoice.committedAt,
        invoice.note,
        invoice.createdBy,
      ],
    );
    return invoice.withId(r.rows[0]!.id);
  }

  async update(invoice: Invoice): Promise<void> {
    await this.db.query(
      `UPDATE invoices
         SET counterparty = $1, invoice_no = $2, issue_date = $3, due_date = $4,
             paid_amount = $5, cashflow_cat_id = $6, committed_to_cells = $7,
             committed_at = $8, note = $9, updated_at = NOW()
       WHERE id = $10 AND company_id = $11`,
      [
        invoice.counterparty,
        invoice.invoiceNo,
        invoice.issueDate,
        invoice.dueDate,
        invoice.paidAmount.toDecimalString(),
        invoice.cashflowCatId,
        invoice.committedToCells,
        invoice.committedAt,
        invoice.note,
        invoice.id,
        invoice.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Invoice | null> {
    const r = await this.db.query<InvoiceRow>(
      `${SELECT} WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToInvoice(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { type?: FlowDirection; openOnly?: boolean },
  ): Promise<ReadonlyArray<Invoice>> {
    const conditions = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.type !== undefined) {
      params.push(options.type);
      conditions.push(`type = $${params.length}`);
    }
    if (options?.openOnly === true) {
      conditions.push('paid_amount < total');
    }
    const r = await this.db.query<InvoiceRow>(
      `${SELECT} WHERE ${conditions.join(' AND ')} ORDER BY due_date ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToInvoice);
  }
}

function rowToInvoice(row: InvoiceRow): Invoice {
  const currency = toCurrency(row.currency);
  return Invoice.create({
    id: row.id,
    companyId: row.company_id,
    type: row.type,
    invoiceNo: row.invoice_no,
    counterparty: row.counterparty,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency,
    subtotal: Money.fromDecimalString(row.subtotal, currency),
    kdvRate: KdvRate.create(Number(row.kdv_rate)),
    kdv: Money.fromDecimalString(row.kdv, currency),
    total: Money.fromDecimalString(row.total, currency),
    paidAmount: Money.fromDecimalString(row.paid_amount, currency),
    cashflowCatId: row.cashflow_cat_id,
    committedToCells: row.committed_to_cells,
    committedAt: row.committed_at,
    note: row.note,
    createdBy: row.created_by,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
