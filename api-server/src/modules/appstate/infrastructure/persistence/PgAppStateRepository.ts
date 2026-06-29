/**
 * PgAppStateRepository — AppStateRepository PG implementasyonu.
 * Tablo: app_state (031_app_state.sql).
 *
 * value JSONB olarak saklanır. ÖNEMLİ: pg rastgele JS nesnelerini otomatik
 * jsonb'ye çevirmez; insert sırasında JSON.stringify(value) verilir ve SQL'de
 * $N::jsonb cast'i yapılır. Okurken pg JSONB'yi zaten ayrıştırılmış JS nesnesi
 * olarak döner, doğrudan value olarak geri verilir.
 */
import type {
  AppStateRepository,
  UpsertAppStateInput,
} from '../../application/ports/AppStateRepository.js';

import type { Queryable } from './Queryable.js';

interface AppStateRow {
  value: unknown;
  updated_at: Date;
}

export class PgAppStateRepository implements AppStateRepository {
  constructor(private readonly db: Queryable) {}

  async get(scope: string, key: string): Promise<{ value: unknown; updatedAt: string } | null> {
    const r = await this.db.query<AppStateRow>(
      `SELECT value, updated_at FROM app_state WHERE scope = $1 AND key = $2 LIMIT 1`,
      [scope, key],
    );
    const row = r.rows[0];
    if (!row) return null;
    return { value: row.value, updatedAt: row.updated_at.toISOString() };
  }

  async upsert(input: UpsertAppStateInput): Promise<{ updatedAt: string }> {
    const r = await this.db.query<{ updated_at: Date }>(
      `INSERT INTO app_state (scope, key, value, updated_by, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (scope, key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_by = EXCLUDED.updated_by,
             updated_at = EXCLUDED.updated_at
       RETURNING updated_at`,
      [input.scope, input.key, JSON.stringify(input.value), input.actorUserId, input.now],
    );
    return { updatedAt: r.rows[0]!.updated_at.toISOString() };
  }
}
