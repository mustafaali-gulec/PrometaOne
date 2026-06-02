/**
 * PgFinanceUnitOfWork — FinanceUnitOfWork PG implementasyonu (ADR-0006).
 *
 * Tek bir PoolClient üzerinde BEGIN/COMMIT/ROLLBACK. `fn` içindeki tüm repo
 * çağrıları aynı transaction'da; `fn` throw ederse ROLLBACK. Commit-to-cells
 * (cell upsert + kaynak committed flag) bu sayede atomiktir.
 */
import type { Pool } from 'pg';

import type {
  FinanceTransactionalRepositories,
  FinanceUnitOfWork,
} from '../../application/ports/FinanceUnitOfWork.js';
import { PgCategoryRepository } from '../persistence/PgCategoryRepository.js';
import { PgCellRepository } from '../persistence/PgCellRepository.js';
import { PgInvoicePaymentRepository } from '../persistence/PgInvoicePaymentRepository.js';
import { PgInvoiceRepository } from '../persistence/PgInvoiceRepository.js';
import { PgKasaEntryRepository } from '../persistence/PgKasaEntryRepository.js';
import { PgTransferRepository } from '../persistence/PgTransferRepository.js';

export class PgFinanceUnitOfWork implements FinanceUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async withTransaction<T>(
    fn: (repos: FinanceTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const repos: FinanceTransactionalRepositories = {
        categories: new PgCategoryRepository(client),
        cells: new PgCellRepository(client),
        kasaEntries: new PgKasaEntryRepository(client),
        transfers: new PgTransferRepository(client),
        invoices: new PgInvoiceRepository(client),
        invoicePayments: new PgInvoicePaymentRepository(client),
      };
      const result = await fn(repos);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK hatası orijinal hatayı gölgelememeli
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
