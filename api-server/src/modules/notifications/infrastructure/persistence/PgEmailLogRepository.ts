/**
 * PgEmailLogRepository — EmailLogRepository port'unun PostgreSQL
 * implementasyonu (tablo: email_log, migration 045).
 */
import type { Pool } from 'pg';

import type {
  EmailLogEntry,
  EmailLogFilter,
  EmailLogListResult,
  EmailLogRepository,
  EmailLogStatus,
} from '../../application/ports/EmailLogRepository.js';

interface EmailLogRow {
  id: string;
  to_address: string;
  subject: string | null;
  status: EmailLogStatus;
  provider: string | null;
  message_id: string | null;
  error: string | null;
  kind: string | null;
  recipient_user_id: string | null;
  notification_id: string | null;
  sender_user_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: Date;
  total: string;
}

export class PgEmailLogRepository implements EmailLogRepository {
  constructor(private readonly pool: Pool) {}

  async insert(log: EmailLogEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO email_log
         (id, to_address, subject, status, provider, message_id, error, kind,
          recipient_user_id, notification_id, sender_user_id, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        log.id,
        log.toAddress,
        log.subject,
        log.status,
        log.provider,
        log.messageId,
        log.error,
        log.kind,
        log.recipientUserId,
        log.notificationId,
        log.senderUserId,
        log.meta === null ? null : JSON.stringify(log.meta),
      ],
    );
  }

  async list(filter: EmailLogFilter): Promise<EmailLogListResult> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    const res = await this.pool.query<EmailLogRow>(
      `SELECT *, count(*) OVER() AS total
         FROM email_log
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const total = res.rows.length > 0 ? Number(res.rows[0]?.total ?? 0) : await this.countAll();

    return {
      items: res.rows.map((row) => ({
        id: row.id,
        toAddress: row.to_address,
        subject: row.subject,
        status: row.status,
        provider: row.provider,
        messageId: row.message_id,
        error: row.error,
        kind: row.kind,
        recipientUserId: row.recipient_user_id,
        notificationId: row.notification_id,
        senderUserId: row.sender_user_id,
        meta: row.meta,
        createdAt: row.created_at,
      })),
      total,
    };
  }

  /** OFFSET sayfa dışına taşınca window count boş döner — toplamı ayrıca say. */
  private async countAll(): Promise<number> {
    const res = await this.pool.query<{ total: string }>(`SELECT count(*) AS total FROM email_log`);
    return Number(res.rows[0]?.total ?? 0);
  }
}
