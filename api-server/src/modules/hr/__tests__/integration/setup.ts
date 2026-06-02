/**
 * setup.ts — testcontainers + PG migration runner for HR integration tests.
 *
 * Faz 4-bis: 7 Pg* repository ile gerçek PostgreSQL üzerinde davranış doğrulama.
 *
 * Kullanım (her test dosyasının başında):
 * ```ts
 * import { before, after, beforeEach } from 'node:test';
 * import { startHrPgContainer, truncateAllHrTables, seedCompany } from './setup.js';
 *
 * let ctx: Awaited<ReturnType<typeof startHrPgContainer>>;
 * before(async () => { ctx = await startHrPgContainer(); }, { timeout: 120_000 });
 * after(async () => { await ctx.cleanup(); });
 * beforeEach(async () => { await truncateAllHrTables(ctx.pool); });
 * ```
 *
 * NOT:
 *   - Container start süresi ~10-30 saniye. before() hook'unun timeout'u
 *     en az 60 saniye olmalı (önerilen: 120_000 ms).
 *   - Docker daemon erişilebilir olmalı. Yoksa testler `skip()` ile atlanır
 *     (DOCKER_AVAILABLE env var ile zorlanabilir).
 *   - Bir test suite başına BİR container — performans için.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Migration dizininin mutlak yolu.
 * `src/modules/hr/__tests__/integration/setup.ts` → ../../../../../migrations
 */
const MIGRATIONS_DIR = resolve(__dirname, '..', '..', '..', '..', '..', 'migrations');

export interface HrPgContext {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  cleanup: () => Promise<void>;
}

/**
 * PostgreSQL container'ı başlat, tüm migration'ları sırayla uygula,
 * `pg.Pool` döndür.
 *
 * Container, tek bir suite içinde paylaşılır. Test'ler arası izolasyon için
 * `truncateAllHrTables(pool)` kullan.
 */
export async function startHrPgContainer(): Promise<HrPgContext> {
  // Postgres 16 ile uyumlu — `citext`, `pgcrypto` extension'ları 001'de aktive
  // edilir; ENUM ALTER VALUE (013) PG 12+ destekler.
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

  await runAllMigrations(pool);

  return {
    container,
    pool,
    cleanup: async () => {
      await pool.end();
      await container.stop();
    },
  };
}

/**
 * Migration dosyalarını alfabetik sıra ile çalıştır.
 * `scripts/migrate.js`'ye benzer mantık, ama testcontainers için optimize.
 *
 * Her dosya KENDİ session'ında çalışır — `ALTER TYPE ADD VALUE` (013) PG 12+
 * transaction içinde çalışsa da, ileri uyumluluk için BEGIN/COMMIT yok.
 */
async function runAllMigrations(pool: Pool): Promise<void> {
  // HR integration testleri için sadece HR ile ilgili migration'lar
  // ve onların bağımlılıkları çalıştırılır. einvoice (009), exchange rates (006),
  // archives (007), views (008), invoices (005) gibi legacy fiscal modülleri
  // HR ile alakasız ve bazıları PG 16'da FK / view bağımlılığı problemi yaşıyor.
  // Bu testler sadece HR davranışını doğruluyor; gereksiz şemayı yüklemiyoruz.
  const HR_REQUIRED_MIGRATIONS = new Set([
    '001_initial_users_and_sessions.sql',
    '002_companies.sql',
    '010_password_resets.sql',
    '011_notifications.sql',
    '012_hr.sql',
    '013_user_role_hr_manager.sql',
    '014_hr_employee_no_sequence.sql',
  ]);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => HR_REQUIRED_MIGRATIONS.has(f))
    .sort();

  for (const file of files) {
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
 * HR şemasındaki tüm tabloları temizler. Test'ler arası izolasyon için
 * her `beforeEach` içinde çağrılır.
 *
 * RESTART IDENTITY: SERIAL/BIGSERIAL sayaçlarını 1'e döndürür.
 * CASCADE: FK bağımlılıklarını da temizler (örn. employees → applications).
 *
 * `hr_employee_no_counters` da temizlenir — generator'ın 1'den başlaması için.
 */
export async function truncateAllHrTables(pool: Pool): Promise<void> {
  await pool.query(`
    TRUNCATE
      application_stage_history,
      applications,
      candidates,
      employees,
      positions,
      departments,
      org_units,
      hr_employee_no_counters
    RESTART IDENTITY CASCADE
  `);
}

/**
 * `users` ve `companies` ve diğer auth tabloları da dahil her şeyi temizle.
 * Bazı testler farklı companyId'ler oluşturuyorsa daha katı temizlik gerekir.
 */
export async function truncateAuthAndHrTables(pool: Pool): Promise<void> {
  await pool.query(`
    TRUNCATE
      application_stage_history,
      applications,
      candidates,
      employees,
      positions,
      departments,
      org_units,
      hr_employee_no_counters,
      user_company_access,
      user_preferences,
      sessions,
      audit_logs,
      users,
      companies
    RESTART IDENTITY CASCADE
  `);
}

export interface SeedCompanyInput {
  id?: number;
  name: string;
}

/**
 * Bir test şirketi oluşturur. id verilirse o id'yi zorlar (test izolasyonu
 * için sabit FK referansları gerektiğinde).
 */
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
    // SERIAL sayacını da ilerlet ki sonraki INSERT (id verilmemiş)
    // çakışmasın.
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

export interface SeedUserInput {
  id?: number;
  companyId: number;
  username: string;
  /** Default 'admin' — HR write erişimi için yeterli. */
  role?: 'viewer' | 'editor' | 'hr_manager' | 'cfo' | 'admin';
}

/**
 * Bir test kullanıcısı oluşturur ve verilen şirkete erişim hakkı verir.
 * password_hash placeholder olarak 'x' kullanılır — testler login akışını
 * test etmiyor.
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

  // Şirket erişimi
  await pool.query(
    `INSERT INTO user_company_access (user_id, company_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, company_id) DO NOTHING`,
    [userRow.id, input.companyId, role],
  );

  return userRow;
}

/**
 * Docker daemon erişilebilir mi? Yoksa testleri atlamak için.
 * Hızlı bir TCP probe — testcontainers'ın `start()` çağrısı uzun sürdüğü için
 * önce ucuz kontrol yapılır.
 *
 * NOT: testcontainers kendi içinde de detect ediyor ama hata mesajı daha
 * net olsun diye.
 */
export function isDockerLikelyAvailable(): boolean {
  // Env var override — CI'de zorla açık/kapalı yapmak için
  if (process.env.SKIP_DOCKER_TESTS === '1' || process.env.SKIP_DOCKER_TESTS === 'true') {
    return false;
  }
  if (process.env.FORCE_DOCKER_TESTS === '1' || process.env.FORCE_DOCKER_TESTS === 'true') {
    return true;
  }
  // Default: dene — testcontainers içeride yine ConnectionRefused fırlatırsa
  // test suite hata verir. before() hook'unda hatayı yakala ve `skip` çağır.
  return true;
}
