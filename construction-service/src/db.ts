/**
 * PostgreSQL bağlantı havuzu — servisin KENDİ veritabanı (DB-per-service).
 * Bu DB'de yalnızca cs_* tablolar bulunur; companies/users/vendors gibi dış
 * varlıklar 'soft reference' (FK'siz id) olarak tutulur.
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

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
