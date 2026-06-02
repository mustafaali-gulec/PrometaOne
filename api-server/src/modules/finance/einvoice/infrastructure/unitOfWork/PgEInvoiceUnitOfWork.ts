/**
 * PgEInvoiceUnitOfWork — EInvoiceUnitOfWork PG implementasyonu (ADR-0006).
 *
 * Import atomikliği: tek PoolClient'ta BEGIN/COMMIT/ROLLBACK. einvoices +
 * invoices (Faz 5) aynı transaction'da; invoice insert + einvoice markImported
 * birlikte commit/rollback.
 */
import type { Pool } from 'pg';

import { PgInvoiceRepository } from '../../../infrastructure/persistence/PgInvoiceRepository.js';
import type {
  EInvoiceTransactionalRepositories,
  EInvoiceUnitOfWork,
} from '../../application/ports/EInvoiceUnitOfWork.js';
import { PgEInvoiceRepository } from '../persistence/PgEInvoiceRepository.js';

export class PgEInvoiceUnitOfWork implements EInvoiceUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async withTransaction<T>(
    fn: (repos: EInvoiceTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const repos: EInvoiceTransactionalRepositories = {
        einvoices: new PgEInvoiceRepository(client),
        invoices: new PgInvoiceRepository(client),
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
