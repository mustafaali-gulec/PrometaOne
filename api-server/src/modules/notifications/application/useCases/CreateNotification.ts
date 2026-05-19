/**
 * CreateNotification — yeni bildirim oluşturur, opsiyonel e-posta atar.
 *
 * Cron job'lar bu use-case'i çağırır.
 */
import { Notification } from '../../domain/entities/Notification.js';
import { buildNotificationContent } from '../../domain/services/NotificationFactory.js';
import type { NotificationKind } from '../../domain/valueObjects/NotificationKind.js';
import type { Clock } from '../ports/Clock.js';
import type { EmailService } from '../ports/EmailService.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { NotificationRepository } from '../ports/NotificationRepository.js';

export interface CreateNotificationInput {
  recipientUserId: number;
  kind: NotificationKind;
  /** İsteğe bağlı override; verilmezse NotificationFactory üretir. */
  title?: string;
  body?: string;
  link?: string | null;
  createdBy?: string;
  /** Eğer e-posta gönderilecekse alıcı adresi. */
  emailRecipient?: { address: string; htmlBody: string };
}

export class CreateNotificationUseCase {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly email: EmailService,
  ) {}

  async execute(input: CreateNotificationInput): Promise<string> {
    const content = buildNotificationContent(input.kind);

    const notif = Notification.create({
      id: this.ids.next(),
      recipientUserId: input.recipientUserId,
      kind: input.kind,
      title: input.title ?? content.title,
      body: input.body ?? content.body,
      link: input.link ?? null,
      createdBy: input.createdBy ?? 'system',
      createdAt: this.clock.now(),
      readAt: null,
    });

    await this.repo.save(notif);

    if (input.emailRecipient) {
      await this.email.send({
        to: input.emailRecipient.address,
        subject: notif.title,
        text: notif.body,
        html: input.emailRecipient.htmlBody,
      });
    }

    return notif.id;
  }
}
