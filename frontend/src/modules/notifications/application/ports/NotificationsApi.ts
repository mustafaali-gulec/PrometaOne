/**
 * NotificationsApi — backend ile konuşan port.
 *
 * Concrete impl: infrastructure/api/NotificationsApiClient.ts (fetch wrapper).
 * Test'te mock'lanabilir.
 */
import type { FetchNotificationsResult } from '../dto/NotificationDto';

export interface NotificationsApi {
  fetchForCurrentUser(options?: { limit?: number; unreadOnly?: boolean }): Promise<FetchNotificationsResult>;
  markAsRead(notificationId: string): Promise<void>;
  fetchUnreadCount(): Promise<number>;
}
