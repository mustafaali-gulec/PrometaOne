/**
 * NotificationRepository — port (interface).
 *
 * Concrete implementation infrastructure/persistence/ altında olacak
 * (PgNotificationRepository, gerçek PostgreSQL).
 */
import type { Notification } from '../../domain/entities/Notification.js';

export interface NotificationRepository {
  save(notification: Notification): Promise<void>;

  /** Bir kullanıcının bildirimlerini en yeniden eskiye sıralı döner. */
  findByRecipient(
    recipientUserId: number,
    options?: { limit?: number; unreadOnly?: boolean },
  ): Promise<ReadonlyArray<Notification>>;

  /** Tek bir bildirim, yoksa null. */
  findById(id: string): Promise<Notification | null>;

  /** Bir kullanıcının okunmamış bildirim sayısı. */
  countUnread(recipientUserId: number): Promise<number>;
}
