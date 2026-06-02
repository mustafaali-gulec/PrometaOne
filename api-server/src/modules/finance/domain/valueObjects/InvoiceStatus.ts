/**
 * InvoiceStatus — fatura ödeme durumu (005_invoices.sql v_invoice_status).
 *
 * open     — hiç ödeme yok, vadesi gelmemiş
 * partial  — kısmi ödeme yapılmış
 * paid     — tamamen ödenmiş
 * overdue  — hiç/kısmi ödeme + vade geçmiş
 */
export type InvoiceStatus = 'open' | 'partial' | 'paid' | 'overdue';

export const ALL_INVOICE_STATUSES: ReadonlyArray<InvoiceStatus> = [
  'open',
  'partial',
  'paid',
  'overdue',
];
