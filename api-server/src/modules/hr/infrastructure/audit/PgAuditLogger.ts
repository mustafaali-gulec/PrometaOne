/**
 * PgAuditLogger — AuditLogger PG implementasyonu.
 *
 * audit_logs tablosuna (001_initial_users_and_sessions.sql) yazar.
 * details JSONB; at varsa timestamp kolonunda kullanılır, yoksa NOW().
 *
 * İleri fazlarda paylaşılabilir hâle gelirse `shared/audit/`'a taşınabilir.
 */
import type { Pool } from 'pg';

import type { AuditEntry, AuditLogger } from '../../application/ports/AuditLogger.js';

export class PgAuditLogger implements AuditLogger {
  constructor(private readonly pool: Pool) {}

  async log(entry: AuditEntry): Promise<void> {
    const timestamp = entry.at ?? new Date();
    await this.pool.query(
      `INSERT INTO audit_logs
         (user_id, username, company_id, action, details, ip_address, user_agent, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.actorUserId,
        entry.actorUsername,
        entry.companyId,
        entry.action,
        JSON.stringify(entry.details),
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        timestamp,
      ],
    );
  }
}
