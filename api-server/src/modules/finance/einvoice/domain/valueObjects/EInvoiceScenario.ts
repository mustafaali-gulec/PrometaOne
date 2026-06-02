/**
 * EInvoiceScenario — GİB e-fatura senaryosu.
 *   TEMELFATURA  — temel fatura (itiraz GİB dışı)
 *   TICARIFATURA — ticari fatura (kabul/red GİB üzerinden)
 *   EARSIVFATURA — e-Arşiv fatura (mükellef olmayan alıcı)
 *   IHRACAT      — ihracat faturası
 */
import { InvalidEInvoiceScenarioError } from '../errors/EInvoiceErrors.js';

export type EInvoiceScenario = 'TEMELFATURA' | 'TICARIFATURA' | 'EARSIVFATURA' | 'IHRACAT';

export const ALL_EINVOICE_SCENARIOS: ReadonlyArray<EInvoiceScenario> = [
  'TEMELFATURA',
  'TICARIFATURA',
  'EARSIVFATURA',
  'IHRACAT',
];

export function isEInvoiceScenario(value: unknown): value is EInvoiceScenario {
  return (
    typeof value === 'string' && (ALL_EINVOICE_SCENARIOS as ReadonlyArray<string>).includes(value)
  );
}

export function toEInvoiceScenario(value: unknown): EInvoiceScenario {
  if (!isEInvoiceScenario(value)) {
    throw new InvalidEInvoiceScenarioError(value);
  }
  return value;
}
