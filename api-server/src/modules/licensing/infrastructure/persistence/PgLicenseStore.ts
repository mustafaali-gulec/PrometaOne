/**
 * PgLicenseStore — lisans deposu + terminal (koltuk) kayıtları.
 * Tablolar: license_store (tek satır, id=1) ve license_terminals
 * (041_licensing.sql).
 *
 * Lisans okuma 60 sn'lik in-memory cache üzerinden yapılır (guard her istekte
 * çağırır — DB'ye her istekte gitmesin). activate/save cache'i tazeler. DB
 * hatasında: cache'te (bayat da olsa) değer varsa o döner; yoksa hata fırlar
 * ve guard fail-open karar verir.
 */
import type { Queryable } from './Queryable.js';

export interface StoredLicense {
  licenseJson: unknown;
  activatedAt: Date;
  activatedBy: string | null;
}

export interface LicenseTerminal {
  terminalId: string;
  name: string | null;
  username: string | null;
  firstSeen: Date;
  lastSeen: Date;
}

const CACHE_TTL_MS = 60_000;

interface LicenseRow {
  license_json: unknown;
  activated_at: Date;
  activated_by: string | null;
}

interface TerminalRow {
  terminal_id: string;
  name: string | null;
  username: string | null;
  first_seen: Date;
  last_seen: Date;
}

export class PgLicenseStore {
  private cache: { fetchedAt: number; row: StoredLicense | null } | null = null;

  constructor(private readonly db: Queryable) {}

  /** Aktif lisansı (60 sn cache'li) döner; hiç aktive edilmemişse null. */
  async getStored(): Promise<StoredLicense | null> {
    const nowMs = Date.now();
    if (this.cache && nowMs - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.row;
    }
    try {
      const r = await this.db.query<LicenseRow>(
        `SELECT license_json, activated_at, activated_by FROM license_store WHERE id = 1`,
      );
      const row = r.rows[0];
      const stored: StoredLicense | null = row
        ? {
            licenseJson: row.license_json,
            activatedAt: row.activated_at,
            activatedBy: row.activated_by,
          }
        : null;
      this.cache = { fetchedAt: nowMs, row: stored };
      return stored;
    } catch (err) {
      // DB hatası: bayat cache varsa onu kullan (kesinti lisanslı müşteriyi
      // kilitlemesin); hiç yoksa hatayı yukarı taşı (guard fail-open yapar).
      if (this.cache) return this.cache.row;
      throw err;
    }
  }

  /** Lisansı upsert eder (id=1) ve cache'i tazeler. */
  async save(licenseJson: unknown, activatedBy: string | null): Promise<StoredLicense> {
    const r = await this.db.query<LicenseRow>(
      `INSERT INTO license_store (id, license_json, activated_at, activated_by)
         VALUES (1, $1::jsonb, NOW(), $2)
       ON CONFLICT (id) DO UPDATE
         SET license_json = EXCLUDED.license_json,
             activated_at = EXCLUDED.activated_at,
             activated_by = EXCLUDED.activated_by
       RETURNING license_json, activated_at, activated_by`,
      [JSON.stringify(licenseJson), activatedBy],
    );
    const row = r.rows[0]!;
    const stored: StoredLicense = {
      licenseJson: row.license_json,
      activatedAt: row.activated_at,
      activatedBy: row.activated_by,
    };
    this.cache = { fetchedAt: Date.now(), row: stored };
    return stored;
  }

  /** Cache'i düşürür (test/aktivasyon sonrası zorunlu tazeleme için). */
  invalidateCache(): void {
    this.cache = null;
  }

  // ===== Terminal (koltuk) kayıtları =======================================

  async terminalExists(terminalId: string): Promise<boolean> {
    const r = await this.db.query(
      `SELECT 1 FROM license_terminals WHERE terminal_id = $1 LIMIT 1`,
      [terminalId],
    );
    return r.rows.length > 0;
  }

  async countTerminals(): Promise<number> {
    const r = await this.db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM license_terminals`,
    );
    return r.rows[0]?.n ?? 0;
  }

  /** Terminali kaydeder/görülme zamanını günceller (name yalnız doluysa ezer). */
  async upsertTerminal(
    terminalId: string,
    name: string | null,
    username: string | null,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO license_terminals (terminal_id, name, username)
         VALUES ($1, $2, $3)
       ON CONFLICT (terminal_id) DO UPDATE
         SET last_seen = NOW(),
             name = COALESCE(EXCLUDED.name, license_terminals.name),
             username = COALESCE(EXCLUDED.username, license_terminals.username)`,
      [terminalId, name, username],
    );
  }

  async listTerminals(): Promise<LicenseTerminal[]> {
    const r = await this.db.query<TerminalRow>(
      `SELECT terminal_id, name, username, first_seen, last_seen
         FROM license_terminals
        ORDER BY first_seen ASC`,
    );
    return r.rows.map((row) => ({
      terminalId: row.terminal_id,
      name: row.name,
      username: row.username,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    }));
  }

  /** Terminal kaydını siler (koltuk boşaltma). Silindi mi bilgisini döner. */
  async deleteTerminal(terminalId: string): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM license_terminals WHERE terminal_id = $1`, [
      terminalId,
    ]);
    return (r.rowCount ?? 0) > 0;
  }
}
