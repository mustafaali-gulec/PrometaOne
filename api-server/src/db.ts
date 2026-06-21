/**
 * PostgreSQL bağlantı havuzu.
 * Tipli query helper'ları içerir.
 *
 * Not: `any` dönüşler eski kod (Faz 0 öncesi) ile geriye uyumlu olmak
 * içindir. Yeni modüller (Faz 1+) Repository pattern + concrete tip
 * kullanmalıdır.
 */
import pg from 'pg';

import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: config.DB_POOL_IDLE_TIMEOUT,
  options: '-c timezone=Europe/Istanbul',
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

/**
 * Report Studio (rapor üreteci) — ad-hoc/kayıtlı SQL yürütme havuzu.
 *
 * REPORTING_DATABASE_URL tanımlıysa AYRI (tercihen salt-okunur ROL) bağlantı
 * kullanılır; tanımsızsa ana `pool` ile aynı connection string'e düşer. Her
 * iki durumda da SafeSqlExecutor sorguyu READ ONLY transaction + SET LOCAL
 * statement_timeout içinde çalıştırıp DAİMA ROLLBACK eder — yazma yapılamaz.
 * Küçük `max` ile ağır raporlar ana RW havuzunu aç bırakmaz.
 */
export const reportingPool = new pg.Pool({
  connectionString: config.REPORTING_DATABASE_URL ?? config.DATABASE_URL,
  max: config.REPORTING_POOL_MAX,
  idleTimeoutMillis: config.DB_POOL_IDLE_TIMEOUT,
  options: '-c timezone=Europe/Istanbul',
});

reportingPool.on('error', (err) => {
  console.error('PostgreSQL reporting pool error:', err);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryOne<T = any>(sqlText: string, params: any[] = []): Promise<T | null> {
  const result = await pool.query(sqlText, params);
  return (result.rows[0] as T) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryMany<T = any>(sqlText: string, params: any[] = []): Promise<T[]> {
  const result = await pool.query(sqlText, params);
  return result.rows as T[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function execute(sqlText: string, params: any[] = []): Promise<number> {
  const result = await pool.query(sqlText, params);
  return result.rowCount ?? 0;
}

/**
 * Tagged template literal SQL helper.
 *
 * @example
 *   const rows = await sql<User>`SELECT * FROM users WHERE id = ${userId}`;
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sql<T = any>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  let text = '';
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      text += `$${i + 1}`;
    }
  }
  const result = await pool.query(text, values);
  return result.rows as T[];
}

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await Promise.all([pool.end(), reportingPool.end()]);
}

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
