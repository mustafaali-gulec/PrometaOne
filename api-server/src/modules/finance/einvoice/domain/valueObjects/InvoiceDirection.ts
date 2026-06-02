/**
 * InvoiceDirection — e-fatura yönü (GİB perspektifinden).
 *   incoming — gelen fatura (bizim için borç/AP adayı)
 *   outgoing — giden fatura (bizim için alacak/AR)
 *
 * Faz 5 `FlowDirection` (in/out) ile eşleme: incoming → out (ödeme), outgoing → in (tahsilat).
 */
import { InvalidInvoiceDirectionError } from '../errors/EInvoiceErrors.js';

export type InvoiceDirection = 'incoming' | 'outgoing';

export const ALL_INVOICE_DIRECTIONS: ReadonlyArray<InvoiceDirection> = ['incoming', 'outgoing'];

export function isInvoiceDirection(value: unknown): value is InvoiceDirection {
  return (
    typeof value === 'string' && (ALL_INVOICE_DIRECTIONS as ReadonlyArray<string>).includes(value)
  );
}

export function toInvoiceDirection(value: unknown): InvoiceDirection {
  if (!isInvoiceDirection(value)) {
    throw new InvalidInvoiceDirectionError(value);
  }
  return value;
}
