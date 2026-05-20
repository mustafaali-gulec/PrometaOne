/**
 * PgPasswordResetTokenStore — password_resets tablosu (migration 010).
 */
import type { Pool } from 'pg';

import type {
  PasswordResetTokenRecord,
  PasswordResetTokenStore,
} from '../../application/ports/PasswordResetTokenStore.js';

interface PasswordResetRow {
  user_id: number;
  token: string;
  expires_at: Date;
  used_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
}

export class PgPasswordResetTokenStore implements PasswordResetTokenStore {
  constructor(private readonly pool: Pool) {}

  async create(input: {
    userId: number;
    token: string;
    expiresAt: Date;
    ip?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at, ip_address, user_agent, email_sent)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [
        input.userId,
        input.token,
        input.expiresAt,
        input.ip ?? null,
        input.userAgent ?? null,
      ],
    );
  }

  async findActive(token: string): Promise<PasswordResetTokenRecord | null> {
    const r = await this.pool.query<PasswordResetRow>(
      `SELECT user_id, token, expires_at, used_at, ip_address, user_agent
       FROM password_resets
       WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [token],
    );
    return rowToRecord(r.rows[0]);
  }

  async findByToken(token: string): Promise<PasswordResetTokenRecord | null> {
    const r = await this.pool.query<PasswordResetRow>(
      `SELECT user_id, token, expires_at, used_at, ip_address, user_agent
       FROM password_resets
       WHERE token = $1
       LIMIT 1`,
      [token],
    );
    return rowToRecord(r.rows[0]);
  }

  async markUsed(token: string): Promise<void> {
    await this.pool.query(
      `UPDATE password_resets SET used_at = NOW() WHERE token = $1 AND used_at IS NULL`,
      [token],
    );
  }

  async revokeUnusedForUser(userId: number): Promise<void> {
    await this.pool.query(
      `UPDATE password_resets SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
  }

  async markEmailSent(token: string): Promise<void> {
    await this.pool.query(
      `UPDATE password_resets SET email_sent = true WHERE token = $1`,
      [token],
    );
  }
}

function rowToRecord(row: PasswordResetRow | undefined): PasswordResetTokenRecord | null {
  if (!row) return null;
  return {
    userId: row.user_id,
    token: row.token,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    ip: row.ip_address,
    userAgent: row.user_agent,
  };
}
