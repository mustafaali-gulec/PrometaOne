/**
 * PostgreSQL bağlantı havuzu.
 * Tipli query helper'ları içerir.
 */
import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: config.DB_POOL_IDLE_TIMEOUT,
  // Türkiye timezone
  options: "-c timezone=Europe/Istanbul",
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err);
});

/** Tipli query - tek satır veya null döner */
export async function queryOne<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const result = await pool.query(sql, params);
  return (result.rows[0] as T) ?? null;
}

/** Tipli query - tüm satırları döner */
export async function queryMany<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

/** UPDATE/DELETE için - etkilenen satır sayısını döner */
export async function execute(sql: string, params: any[] = []): Promise<number> {
  const result = await pool.query(sql, params);
  return result.rowCount ?? 0;
}

/** Transaction içinde çalıştır */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Server kapanırken pool'u temiz kapat */
export async function closePool(): Promise<void> {
  await pool.end();
}

/** Sağlık kontrolü */
export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
