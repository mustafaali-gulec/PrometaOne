/**
 * FetchNotificationsForUser — bir kullanıcının bildirimlerini listeler.
 */
import type { NotificationDto } from '../dto/NotificationDto.js';
import { toNotificationDto } from '../dto/NotificationDto.js';
import type { NotificationRepository } from '../ports/NotificationRepository.js';

export interface FetchNotificationsForUserInput {
  recipientUserId: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface FetchNotificationsForUserResult {
  notifications: ReadonlyArray<NotificationDto>;
  unreadCount: number;
}

export class FetchNotificationsForUserUseCase {
  constructor(private readonly repo: NotificationRepository) {}

  async execute(input: FetchNotificationsForUserInput): Promise<FetchNotificationsForUserResult> {
    if (input.recipientUserId <= 0) {
      throw new Error('recipientUserId pozitif olmalı');
    }

    const [list, unreadCount] = await Promise.all([
      this.repo.findByRecipient(input.recipientUserId, {
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.unreadOnly !== undefined ? { unreadOnly: input.unreadOnly } : {}),
      }),
      this.repo.countUnread(input.recipientUserId),
    ]);

    return {
      notifications: list.map(toNotificationDto),
      unreadCount,
    };
  }
}
