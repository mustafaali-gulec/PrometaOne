/**
 * FinanceUnitOfWork — finance modülünde cross-aggregate atomik yazımlar
 * (ADR-0006, HR'daki UnitOfWork ile aynı desen).
 *
 * Commit-to-cells (PR 5) bunu kullanır: bir kasa entry / transfer / invoice'ı
 * "committed" işaretlerken AYNI transaction'da ilgili bütçe hücresini (Cell)
 * günceller. İki tablo (cells + kaynak tablonun committed flag'i) atomik.
 */
import type { KasaEntryRepository, TransferRepository } from './CashRepositories.js';
import type { CategoryRepository } from './CategoryRepository.js';
import type { CellRepository } from './CellRepository.js';
import type { InvoicePaymentRepository, InvoiceRepository } from './InvoiceRepositories.js';

export interface FinanceTransactionalRepositories {
  readonly categories: CategoryRepository;
  readonly cells: CellRepository;
  readonly kasaEntries: KasaEntryRepository;
  readonly transfers: TransferRepository;
  readonly invoices: InvoiceRepository;
  readonly invoicePayments: InvoicePaymentRepository;
}

export interface FinanceUnitOfWork {
  /**
   * `fn` içindeki tüm repo çağrıları aynı DB transaction'ında yürütülür.
   * `fn` throw ederse ROLLBACK, normal dönerse COMMIT.
   */
  withTransaction<T>(fn: (repos: FinanceTransactionalRepositories) => Promise<T>): Promise<T>;
}
