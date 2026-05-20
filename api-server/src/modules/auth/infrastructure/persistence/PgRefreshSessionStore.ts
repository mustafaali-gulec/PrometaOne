/**
 * PgRefreshSessionStore — RefreshSessionStore port'unun PostgreSQL impl.
 *
 * 'sessions' tablosunu kullanır (migration 001).
 * Token KENDISI degil SHA-256 hash'i DB'de tutulur.
 */
import type { Pool } from 'pg';

import type {
  CreateRefreshSessionInput,
  RefreshSession,
  RefreshSessionStore,
} from '../../application/ports/RefreshSessionStore.js';

interface SessionRow {
  id: string;
  user_id: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export class PgRefreshSessionStore implements RefreshSessionStore {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateRefreshSessionInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.jti,
        input.userId,
        input.refreshTokenHash,
        input.ip ?? null,
        input.userAgent ?? null,
        input.expiresAt,
      ],
    );
  }

  async findActiveWithHash(
    jti: string,
    refreshTokenHash: string,
  ): Promise<RefreshSession | null> {
    const r = await this.pool.query<SessionRow>(
      `SELECT id, user_id, ip_address, user_agent, created_at, expires_at, revoked_at
       FROM sessions
       WHERE id = $1
         AND refresh_token_hash = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [jti, refreshTokenHash],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      jti: row.id,
      userId: row.user_id,
      ip: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    };
  }

  async revoke(jti: string): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
      [jti],
    );
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }
}
