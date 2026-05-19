/**
 * NotificationDto — REST response için DTO.
 * Entity'den DTO'ya mapping NotificationDtoMapper'da.
 */
import type { Notification } from '../../domain/entities/Notification.js';
import type { NotificationKind } from '../../domain/valueObjects/NotificationKind.js';

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

export function toNotificationDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    recipientUserId: n.recipientUserId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    createdBy: n.createdBy,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() ?? null,
    isRead: n.isRead,
  };
}
