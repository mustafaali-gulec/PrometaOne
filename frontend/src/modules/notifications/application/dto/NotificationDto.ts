import type { NotificationKind } from '../../domain/valueObjects/NotificationKind';

export interface NotificationDto {
  id: string;
  recipientUserId: number;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  createdBy: string;
  createdAt: string;
  readAt: string | null;
  isRead: boolean;
}

export interface FetchNotificationsResult {
  notifications: ReadonlyArray<NotificationDto>;
  unreadCount: number;
}
