/**
 * Invoice DTO'ları — status hesaplanmış alan olarak eklenir (today gerekli).
 */
import type { Invoice } from '../../domain/entities/Invoice.js';
import type { InvoicePayment } from '../../domain/entities/InvoicePayment.js';
import { InvoiceStatusPolicy } from '../../domain/services/InvoiceStatusPolicy.js';
import type { Currency } from '../../domain/valueObjects/Currency.js';
import type { FlowDirection } from '../../domain/valueObjects/FlowDirection.js';
import type { InvoiceStatus } from '../../domain/valueObjects/InvoiceStatus.js';

export interface InvoiceDto {
  id: number | null;
  companyId: number;
  type: FlowDirection;
  invoiceNo: string | null;
  counterparty: string;
  issueDate: string | null;
  dueDate: string;
  currency: Currency;
  subtotal: string;
  kdvRate: number;
  kdv: string;
  total: string;
  paidAmount: string;
  remaining: string;
  status: InvoiceStatus;
  cashflowCatId: number | null;
  committedToCells: boolean;
  note: string | null;
}

/** @param today YYYY-MM-DD — status (overdue) hesabı için. */
export function toInvoiceDto(invoice: Invoice, today: string): InvoiceDto {
  return {
    ...invoice.toJSON(),
    status: InvoiceStatusPolicy.status(invoice, today),
  };
}

export interface InvoicesResponse {
  invoices: InvoiceDto[];
}

export interface InvoicePaymentDto {
  id: number | null;
  invoiceId: number;
  amount: string;
  date: string;
  currency: Currency;
  bankAccountId: number | null;
  kasaAccountId: number | null;
  note: string | null;
}

export function toInvoicePaymentDto(p: InvoicePayment): InvoicePaymentDto {
  return p.toJSON();
}
