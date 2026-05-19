/**
 * PgNotificationRepository — NotificationRepository port'unun PostgreSQL
 * implementasyonu.
 *
 * pg.Pool dışarıdan inject edilir (DI). Bu sayede testte mock pool
 * kullanılabilir.
 */
import type { Pool } from 'pg';

import { Notification } from '../../domain/entities/Notification.js';
import type { NotificationProps } from '../../domain/entities/Notification.js';
import type { NotificationKind } from '../../domain/valueObjects/NotificationKind.js';
import type { NotificationRepository } from '../../application/ports/NotificationRepository.js';

interface NotificationRow {
  id: string;
  recipient_user_id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  created_by: string;
  created_at: Date;
  read_at: Date | null;
}

export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: Pool) {}

  async save(notification: Notification): Promise<void> {
    const props = notification.toJSON();
    await this.pool.query(
      `INSERT INTO notifications
         (id, recipient_user_id, kind, title, body, link, created_by, created_at, read_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         kind       = EXCLUDED.kind,
         title      = EXCLUDED.title,
         body       = EXCLUDED.body,
         link       = EXCLUDED.link,
         read_at    = EXCLUDED.read_at`,
      [
        props.id,
        props.recipientUserId,
        JSON.stringify(props.kind),
        props.title,
        props.body,
        props.link,
        props.createdBy,
        props.createdAt,
        props.readAt,
      ],
    );
  }

  async findByRecipient(
    recipientUserId: number,
    options: { limit?: number; unreadOnly?: boolean } = {},
  ): Promise<ReadonlyArray<Notification>> {
    const conditions: string[] = ['recipient_user_id = $1'];
    const params: unknown[] = [recipientUserId];
    if (options.unreadOnly === true) {
      conditions.push('read_at IS NULL');
    }
    let sql = `SELECT * FROM notifications WHERE ${conditions.join(' AND ')}
               ORDER BY created_at DESC`;
    if (options.limit !== undefined && options.limit > 0) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
    }
    const result = await this.pool.query<NotificationRow>(sql, params);
    return result.rows.map((row) => rowToNotification(row));
  }

  async findById(id: string): Promise<Notification | null> {
    const result = await this.pool.query<NotificationRow>(
      `SELECT * FROM notifications WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return rowToNotification(row);
  }

  async countUnread(recipientUserId: number): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications
       WHERE recipient_user_id = $1 AND read_at IS NULL`,
      [recipientUserId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}

function rowToNotification(row: NotificationRow): Notification {
  // PostgreSQL JSONB tipini Node tarafında string olarak gelirse parse et,
  // zaten object ise olduğu gibi al.
  const kind: NotificationKind =
    typeof row.kind === 'string' ? (JSON.parse(row.kind) as NotificationKind) : row.kind;
  const props: NotificationProps = {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    kind,
    title: row.title,
    body: row.body,
    link: row.link,
    createdBy: row.created_by,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
  return Notification.create(props);
}
