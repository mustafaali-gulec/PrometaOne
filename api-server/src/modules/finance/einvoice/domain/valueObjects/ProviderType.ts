/**
 * ProviderType — e-fatura entegratörü.
 *
 * DB CHECK `provider IN (...)` (016) ile birebir.
 *   elogo       — Logo eLogo (SOAP)
 *   qnb_efinans — QNB eFinans
 *   logo_db     — Logo DB direkt erişim
 *   mock        — test/demo provider (gerçek ağ yok)
 *   manual      — elle yüklenen dosya (GİB HTML / UBL XML); entegratör yok
 */
import { InvalidProviderTypeError } from '../errors/EInvoiceErrors.js';

export type ProviderType = 'elogo' | 'qnb_efinans' | 'logo_db' | 'mock' | 'manual';

export const ALL_PROVIDER_TYPES: ReadonlyArray<ProviderType> = [
  'elogo',
  'qnb_efinans',
  'logo_db',
  'mock',
  'manual',
];

export function isProviderType(value: unknown): value is ProviderType {
  return typeof value === 'string' && (ALL_PROVIDER_TYPES as ReadonlyArray<string>).includes(value);
}

export function toProviderType(value: unknown): ProviderType {
  if (!isProviderType(value)) {
    throw new InvalidProviderTypeError(value);
  }
  return value;
}
