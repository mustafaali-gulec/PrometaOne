/**
 * PgAuditLogger — AuditLogger PG implementasyonu (access modülü).
 *
 * HR modülündeki ile AYNI: paylaşılan audit_logs tablosuna yazar.
 * Aksiyon kodları 'access.role.created', 'access.grant.created' gibi.
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
