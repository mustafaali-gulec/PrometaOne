/**
 * EInvoiceType — e-fatura tipi (UBL ProfileID / InvoiceTypeCode).
 *   SATIS        — normal satış
 *   IADE         — iade faturası
 *   TEVKIFAT     — KDV tevkifatlı
 *   ISTISNA      — KDV istisnalı
 *   OZELMATRAH   — özel matrah
 *   IHRACKAYITLI — ihraç kayıtlı
 */
import { InvalidEInvoiceTypeError } from '../errors/EInvoiceErrors.js';

export type EInvoiceType =
  | 'SATIS'
  | 'IADE'
  | 'TEVKIFAT'
  | 'ISTISNA'
  | 'OZELMATRAH'
  | 'IHRACKAYITLI';

export const ALL_EINVOICE_TYPES: ReadonlyArray<EInvoiceType> = [
  'SATIS',
  'IADE',
  'TEVKIFAT',
  'ISTISNA',
  'OZELMATRAH',
  'IHRACKAYITLI',
];

export function isEInvoiceType(value: unknown): value is EInvoiceType {
  return typeof value === 'string' && (ALL_EINVOICE_TYPES as ReadonlyArray<string>).includes(value);
}

export function toEInvoiceType(value: unknown): EInvoiceType {
  if (!isEInvoiceType(value)) {
    throw new InvalidEInvoiceTypeError(value);
  }
  return value;
}
