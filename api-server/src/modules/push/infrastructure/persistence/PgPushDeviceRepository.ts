/**
 * PgPushDeviceRepository — PushDeviceRepository port'unun PostgreSQL
 * implementasyonu (tablo: push_devices, migration 045).
 */
import type { Pool } from 'pg';

import type {
  PushDeviceRepository,
  UpsertDeviceInput,
} from '../../application/ports/PushDeviceRepository.js';
import type {
  PushDevice,
  PushKeys,
  PushPlatform,
  PushProvider,
} from '../../domain/entities/PushDevice.js';

interface PushDeviceRow {
  id: string;
  user_id: string | null;
  username: string;
  platform: PushPlatform;
  provider: PushProvider;
  endpoint: string;
  keys: PushKeys | null;
  user_agent: string | null;
  bundle_id: string | null;
  registered_at: Date;
  last_used_at: Date;
  active: boolean;
}

function toDevice(row: PushDeviceRow): PushDevice {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    platform: row.platform,
    provider: row.provider,
    endpoint: row.endpoint,
    keys: row.keys,
    userAgent: row.user_agent,
    bundleId: row.bundle_id,
    registeredAt: row.registered_at,
    lastUsedAt: row.last_used_at,
    active: row.active,
  };
}

export class PgPushDeviceRepository implements PushDeviceRepository {
  constructor(private readonly pool: Pool) {}

  async upsertByEndpoint(input: UpsertDeviceInput): Promise<PushDevice> {
    const res = await this.pool.query<PushDeviceRow>(
      `INSERT INTO push_devices
         (id, user_id, username, platform, provider, endpoint, keys, user_agent, bundle_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (endpoint) DO UPDATE SET
         active       = TRUE,
         last_used_at = now(),
         keys         = EXCLUDED.keys,
         user_agent   = EXCLUDED.user_agent,
         username     = EXCLUDED.username,
         user_id      = EXCLUDED.user_id
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.username,
        input.platform,
        input.provider,
        input.endpoint,
        input.keys === null ? null : JSON.stringify(input.keys),
        input.userAgent,
        input.bundleId,
      ],
    );
    const row = res.rows[0];
    if (!row) throw new Error('push_devices upsert satır döndürmedi');
    return toDevice(row);
  }

  async deactivateByUsernameProvider(username: string, provider?: PushProvider): Promise<number> {
    const res = await this.pool.query(
      `UPDATE push_devices
          SET active = FALSE
        WHERE username = $1
          AND ($2::text IS NULL OR provider = $2)
          AND active`,
      [username, provider ?? null],
    );
    return res.rowCount ?? 0;
  }

  async deactivateByEndpoint(endpoint: string): Promise<number> {
    const res = await this.pool.query(
      `UPDATE push_devices SET active = FALSE WHERE endpoint = $1 AND active`,
      [endpoint],
    );
    return res.rowCount ?? 0;
  }

  async findActiveByUsername(username: string): Promise<PushDevice[]> {
    const res = await this.pool.query<PushDeviceRow>(
      `SELECT * FROM push_devices
        WHERE username = $1 AND active
        ORDER BY registered_at DESC`,
      [username],
    );
    return res.rows.map(toDevice);
  }

  async findByEndpoints(endpoints: string[]): Promise<PushDevice[]> {
    if (endpoints.length === 0) return [];
    const res = await this.pool.query<PushDeviceRow>(
      `SELECT * FROM push_devices WHERE endpoint = ANY($1::text[])`,
      [endpoints],
    );
    return res.rows.map(toDevice);
  }

  async touchLastUsed(endpoints: string[]): Promise<void> {
    if (endpoints.length === 0) return;
    await this.pool.query(
      `UPDATE push_devices SET last_used_at = now() WHERE endpoint = ANY($1::text[])`,
      [endpoints],
    );
  }
}
