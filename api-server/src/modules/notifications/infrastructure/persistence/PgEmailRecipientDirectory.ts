/**
 * PgEmailRecipientDirectory — EmailRecipientDirectory port'unun PostgreSQL
 * implementasyonu.
 *
 * users.email: CITEXT (case-insensitive). hrEmployees e-postaları app-state
 * aynasından (app_state_entities, migration 044) doğrulanır.
 */
import type { Pool } from 'pg';

import type { EmailRecipientDirectory } from '../../application/ports/EmailRecipientDirectory.js';

export class PgEmailRecipientDirectory implements EmailRecipientDirectory {
  constructor(private readonly pool: Pool) {}

  async findUserEmailByUsername(username: string): Promise<string | null> {
    const res = await this.pool.query<{ email: string | null }>(
      `SELECT email FROM users WHERE username = $1 LIMIT 1`,
      [username],
    );
    return res.rows[0]?.email ?? null;
  }

  async isKnownEmployeeEmail(email: string): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM app_state_entities
        WHERE domain = 'hrEmployees' AND data->>'email' = $1
        LIMIT 1`,
      [email],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
