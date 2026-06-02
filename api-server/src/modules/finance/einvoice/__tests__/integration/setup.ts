/**
 * setup.ts — testcontainers + PG migration runner for e-Fatura + FX integration.
 *
 * Faz 6 / PR 6: Pg* repo'ları + PgEInvoiceUnitOfWork gerçek PostgreSQL üzerinde
 * doğrular: credential AES blob round-trip (BYTEA), einvoice UNIQUE(company,uuid)
 * UPSERT, import atomikliği (invoices + einvoice tek transaction), exchange rate.
 *
 * Gerekli migration'lar: 001,002,003,004,005,006,015,016.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
// einvoice/__tests__/integration/setup.ts → ../../../../../../migrations
const MIGRATIONS_DIR = resolve(__dirname, '..', '..', '..', '..', '..', '..', 'migrations');

const REQUIRED_MIGRATIONS = [
  '001_initial_users_and_sessions.sql',
  '002_companies.sql',
  '003_categories_and_cells.sql',
  '004_banks_kasa_transfers.sql',
  '005_invoices.sql',
  '006_exchange_rates_revaluations.sql',
  '015_finance_category_active.sql',
  '016_einvoice.sql',
];

export interface EInvoicePgContext {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  cleanup: () => Promise<void>;
}

export async function startEInvoicePgContainer(): Promise<EInvoicePgContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('prometa_test')
    .withUsername('prometa_test')
    .withPassword('prometa_test')
    .start();

  const pool = new Pool({
    host: container.getHost(),
    port: container.getMappedPort(5432),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getPassword(),
    max: 10,
  });

  for (const file of REQUIRED_MIGRATIONS) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    try {
      await pool.query(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Migration ${file} başarısız: ${msg}`);
    }
  }

  return {
    container,
    pool,
    cleanup: async () => {
      await pool.end();
      await container.stop();
    },
  };
}

export async function truncateAll(pool: Pool): Promise<void> {
  await pool.query(`
    TRUNCATE
      einvoice_party_mapping,
      einvoice_sync_log,
      einvoice_invoices,
      einvoice_credentials,
      revaluations,
      exchange_rate_history,
      invoice_payments,
      invoices,
      cells,
      categories,
      user_company_access,
      sessions,
      users,
      companies
    RESTART IDENTITY CASCADE
  `);
}

export async function seedCompany(pool: Pool, id: number, name = 'Test A.Ş.'): Promise<void> {
  await pool.query(
    `INSERT INTO companies (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [id, name],
  );
  await pool.query(
    `SELECT setval(pg_get_serial_sequence('companies','id'), GREATEST($1,(SELECT MAX(id) FROM companies)))`,
    [id],
  );
}
