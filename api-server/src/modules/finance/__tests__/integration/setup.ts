/**
 * setup.ts — testcontainers + PG migration runner for Finance integration tests.
 *
 * Faz 5 / PR 6c: 8 Pg* repository + PgFinanceUnitOfWork'i gerçek PostgreSQL
 * üzerinde doğrular. Özellikle SQL'e özgü davranışlar:
 *   - cells UPSERT (ON CONFLICT) — domain'de görünmeyen DB davranışı
 *   - invoice_payments trigger → invoices.paid_amount otomatik güncelleme
 *   - v_invoice_status view (open/partial/paid/overdue)
 *   - commit-to-cells UoW atomik rollback (BEGIN/ROLLBACK)
 *
 * Kullanım (her test dosyasının başında):
 * ```ts
 * import { before, after, beforeEach } from 'node:test';
 * import { startFinancePgContainer, truncateAllFinanceTables, seedCompany } from './setup.js';
 *
 * let ctx: Awaited<ReturnType<typeof startFinancePgContainer>>;
 * before(async () => { ctx = await startFinancePgContainer(); }, { timeout: 180_000 });
 * after(async () => { await ctx.cleanup(); });
 * beforeEach(async () => { await truncateAllFinanceTables(ctx.pool); });
 * ```
 *
 * NOT:
 *   - Container start süresi ~10-30 saniye. before() timeout en az 60_000 ms olmalı.
 *   - Docker daemon erişilebilir olmalı.
 *   - Bir test suite başına BİR container (performans).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Migration dizininin mutlak yolu.
 * `src/modules/finance/__tests__/integration/setup.ts` → ../../../../../migrations
 */
const MIGRATIONS_DIR = resolve(__dirname, '..', '..', '..', '..', '..', 'migrations');

/**
 * Finance integration testleri için gereken migration'lar (sırayla):
 *   001 — users + sessions + trg_updated_at() fonksiyonu + extension'lar
 *   002 — companies
 *   003 — categories + cells
 *   004 — banks + bank_accounts + kasa_accounts + kasa_entries + transfers
 *   005 — invoices + invoice_payments (+ paid_amount trigger + v_invoice_status)
 *   015 — categories.active kolonu (Faz 5 PR 6c)
 *
 * einvoice (009), exchange rates (006), archives (007), views (008) gibi legacy
 * fiscal modülleri finance Clean Architecture davranışıyla alakasız — yüklenmiyor.
 */
const FINANCE_REQUIRED_MIGRATIONS = [
  '001_initial_users_and_sessions.sql',
  '002_companies.sql',
  '003_categories_and_cells.sql',
  '004_banks_kasa_transfers.sql',
  '005_invoices.sql',
  '015_finance_category_active.sql',
];

export interface FinancePgContext {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  cleanup: () => Promise<void>;
}

export async function startFinancePgContainer(): Promise<FinancePgContext> {
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

  await runFinanceMigrations(pool);

  return {
    container,
    pool,
    cleanup: async () => {
      await pool.end();
      await container.stop();
    },
  };
}

async function runFinanceMigrations(pool: Pool): Promise<void> {
  for (const file of FINANCE_REQUIRED_MIGRATIONS) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    try {
      await pool.query(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Migration ${file} başarısız: ${msg}`);
    }
  }
}

/**
 * Tüm finance tablolarını + auth (companies/users) temizler.
 * RESTART IDENTITY: SERIAL/BIGSERIAL sayaçlarını 1'e döndürür.
 * CASCADE: FK bağımlılıklarını da temizler.
 */
export async function truncateAllFinanceTables(pool: Pool): Promise<void> {
  await pool.query(`
    TRUNCATE
      invoice_payments,
      invoices,
      transfers,
      kasa_entries,
      kasa_accounts,
      bank_accounts,
      banks,
      cells,
      categories,
      user_company_access,
      sessions,
      users,
      companies
    RESTART IDENTITY CASCADE
  `);
}

export interface SeedCompanyInput {
  id?: number;
  name: string;
}

export async function seedCompany(
  pool: Pool,
  input: SeedCompanyInput,
): Promise<{ id: number; name: string }> {
  if (input.id !== undefined) {
    const r = await pool.query<{ id: number; name: string }>(
      `INSERT INTO companies (id, name) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [input.id, input.name],
    );
    await pool.query(
      `SELECT setval(pg_get_serial_sequence('companies', 'id'), GREATEST($1, (SELECT MAX(id) FROM companies)))`,
      [input.id],
    );
    return r.rows[0]!;
  }
  const r = await pool.query<{ id: number; name: string }>(
    `INSERT INTO companies (name) VALUES ($1) RETURNING id, name`,
    [input.name],
  );
  return r.rows[0]!;
}

/**
 * Sistem geneli bir banka oluşturur (bank_accounts FK için gerekli).
 */
export async function seedBank(
  pool: Pool,
  input: { name?: string; code?: string } = {},
): Promise<{ id: number }> {
  const name = input.name ?? 'Test Bankası';
  const code = input.code ?? 'TST';
  const r = await pool.query<{ id: number }>(
    `INSERT INTO banks (name, code) VALUES ($1, $2) RETURNING id`,
    [name, code],
  );
  return r.rows[0]!;
}

export interface SeedUserInput {
  id?: number;
  companyId: number;
  username: string;
  role?: 'viewer' | 'editor' | 'cfo' | 'admin';
}

/**
 * Test kullanıcısı + şirket erişimi. cells.updated_by / created_by FK'leri için.
 */
export async function seedUser(
  pool: Pool,
  input: SeedUserInput,
): Promise<{ id: number; username: string; role: string }> {
  const role = input.role ?? 'admin';
  let userRow: { id: number; username: string; role: string };

  if (input.id !== undefined) {
    const r = await pool.query<{ id: number; username: string; role: string }>(
      `INSERT INTO users (id, username, password_hash, role)
       VALUES ($1, $2, 'x', $3)
       ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, role = EXCLUDED.role
       RETURNING id, username, role`,
      [input.id, input.username, role],
    );
    await pool.query(
      `SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST($1, (SELECT MAX(id) FROM users)))`,
      [input.id],
    );
    userRow = r.rows[0]!;
  } else {
    const r = await pool.query<{ id: number; username: string; role: string }>(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, 'x', $2)
       RETURNING id, username, role`,
      [input.username, role],
    );
    userRow = r.rows[0]!;
  }

  await pool.query(
    `INSERT INTO user_company_access (user_id, company_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, company_id) DO NOTHING`,
    [userRow.id, input.companyId, role],
  );

  return userRow;
}
