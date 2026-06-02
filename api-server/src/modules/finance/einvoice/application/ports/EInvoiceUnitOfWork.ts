/**
 * EInvoiceUnitOfWork — e-fatura import'unun atomik bölgesi (ADR-0006 deseni).
 *
 * Import: Faz 5 `invoices` tablosuna yeni fatura + einvoice cache kaydının
 * "imported" işaretlenmesi tek transaction'da. Concrete: PR 6 Pg impl.
 */
import type { InvoiceRepository } from '../../../application/ports/InvoiceRepositories.js';

import type { EInvoiceRepository } from './EInvoiceRepositories.js';

export interface EInvoiceTransactionalRepositories {
  einvoices: EInvoiceRepository;
  invoices: InvoiceRepository;
}

export interface EInvoiceUnitOfWork {
  withTransaction<T>(fn: (repos: EInvoiceTransactionalRepositories) => Promise<T>): Promise<T>;
}
