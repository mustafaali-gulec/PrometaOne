/**
 * MarkNotificationAsRead — bildirimi okundu işaretler.
 *
 * Yetki kontrolü: bildirim yalnızca sahibi tarafından okundu işaretlenebilir.
 */
import type { Clock } from '../ports/Clock.js';
import type { NotificationRepository } from '../ports/NotificationRepository.js';

export interface MarkNotificationAsReadInput {
  notificationId: string;
  actorUserId: number;
}

export class MarkNotificationAsReadUseCase {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: MarkNotificationAsReadInput): Promise<void> {
    const notif = await this.repo.findById(input.notificationId);
    if (!notif) {
      throw new NotificationNotFoundError(input.notificationId);
    }
    if (notif.recipientUserId !== input.actorUserId) {
      throw new NotificationForbiddenError();
    }

    const updated = notif.markAsRead(this.clock.now());
    await this.repo.save(updated);
  }
}

export class NotificationNotFoundError extends Error {
  constructor(id: string) {
    super(`Notification bulunamadı: ${id}`);
    this.name = 'NotificationNotFoundError';
  }
}

export class NotificationForbiddenError extends Error {
  constructor() {
    super('Bu bildirimi başkası adına işaretleyemezsiniz');
    this.name = 'NotificationForbiddenError';
  }
}
