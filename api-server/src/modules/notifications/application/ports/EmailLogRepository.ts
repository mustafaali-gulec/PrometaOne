/**
 * EmailLogRepository — port (interface).
 *
 * /v1/email/send üzerinden yapılan HER gönderim denemesinin (sent/failed)
 * denetim kaydı. Concrete implementation:
 * infrastructure/persistence/PgEmailLogRepository.ts (tablo: email_log,
 * migration 045).
 */

export type EmailLogStatus = 'sent' | 'failed';

export interface EmailLogEntry {
  id: string;
  toAddress: string;
  subject: string | null;
  status: EmailLogStatus;
  provider: string | null;
  messageId: string | null;
  error: string | null;
  kind: string | null;
  recipientUserId: string | null;
  notificationId: string | null;
  senderUserId: string | null;
  meta: Record<string, unknown> | null;
  /** Listelemede DB'den gelir; insert'te DB default (now()). */
  createdAt?: Date;
}

export interface EmailLogFilter {
  limit?: number;
  offset?: number;
}

export interface EmailLogListResult {
  items: EmailLogEntry[];
  total: number;
}

export interface EmailLogRepository {
  insert(log: EmailLogEntry): Promise<void>;
  list(filter: EmailLogFilter): Promise<EmailLogListResult>;
}
