/**
 * Invoice modülü kalıcılık portları (Faz 5 / PR 4).
 */
import type { Invoice } from '../../domain/entities/Invoice.js';
import type { InvoicePayment } from '../../domain/entities/InvoicePayment.js';
import type { FlowDirection } from '../../domain/valueObjects/FlowDirection.js';

export interface InvoiceRepository {
  insert(invoice: Invoice): Promise<Invoice>;
  update(invoice: Invoice): Promise<void>;
  findById(id: number, companyId: number): Promise<Invoice | null>;
  listByCompany(
    companyId: number,
    options?: { type?: FlowDirection; openOnly?: boolean },
  ): Promise<ReadonlyArray<Invoice>>;
}

export interface InvoicePaymentRepository {
  insert(payment: InvoicePayment): Promise<InvoicePayment>;
  findById(id: number): Promise<InvoicePayment | null>;
  listByInvoice(invoiceId: number): Promise<ReadonlyArray<InvoicePayment>>;
  remove(id: number): Promise<void>;
}
