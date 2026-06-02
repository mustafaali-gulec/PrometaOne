/**
 * PgInvoicePaymentRepository — InvoicePaymentRepository PG implementasyonu.
 * Tablo: invoice_payments (005). INSERT/DELETE trigger'ı invoices.paid_amount'u
 * otomatik günceller.
 */
import type { InvoicePaymentRepository } from '../../application/ports/InvoiceRepositories.js';
import { InvoicePayment } from '../../domain/entities/InvoicePayment.js';
import { toCurrency, type Currency } from '../../domain/valueObjects/Currency.js';
import { Money } from '../../domain/valueObjects/Money.js';

import type { Queryable } from './Queryable.js';

interface InvoicePaymentRow {
  id: number;
  invoice_id: number;
  amount: string;
  date: string;
  currency: Currency;
  bank_account_id: number | null;
  kasa_account_id: number | null;
  note: string | null;
  created_by: number | null;
}

const SELECT = `SELECT id, invoice_id, amount, to_char(date, 'YYYY-MM-DD') AS date, currency,
          bank_account_id, kasa_account_id, note, created_by
     FROM invoice_payments`;

export class PgInvoicePaymentRepository implements InvoicePaymentRepository {
  constructor(private readonly db: Queryable) {}

  async insert(payment: InvoicePayment): Promise<InvoicePayment> {
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO invoice_payments
         (invoice_id, amount, date, currency, bank_account_id, kasa_account_id, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        payment.invoiceId,
        payment.amount.toDecimalString(),
        payment.date,
        payment.currency,
        payment.bankAccountId,
        payment.kasaAccountId,
        payment.note,
        payment.createdBy,
      ],
    );
    return payment.withId(r.rows[0]!.id);
  }

  async findById(id: number): Promise<InvoicePayment | null> {
    const r = await this.db.query<InvoicePaymentRow>(`${SELECT} WHERE id = $1 LIMIT 1`, [id]);
    const row = r.rows[0];
    return row ? rowToPayment(row) : null;
  }

  async listByInvoice(invoiceId: number): Promise<ReadonlyArray<InvoicePayment>> {
    const r = await this.db.query<InvoicePaymentRow>(
      `${SELECT} WHERE invoice_id = $1 ORDER BY date DESC, id DESC`,
      [invoiceId],
    );
    return r.rows.map(rowToPayment);
  }

  async remove(id: number): Promise<void> {
    await this.db.query(`DELETE FROM invoice_payments WHERE id = $1`, [id]);
  }
}

function rowToPayment(row: InvoicePaymentRow): InvoicePayment {
  const currency = toCurrency(row.currency);
  return InvoicePayment.create({
    id: row.id,
    invoiceId: row.invoice_id,
    amount: Money.fromDecimalString(row.amount, currency),
    date: row.date,
    currency,
    bankAccountId: row.bank_account_id,
    kasaAccountId: row.kasa_account_id,
    note: row.note,
    createdBy: row.created_by,
    createdAt: new Date(),
  });
}
