/**
 * Notification — bildirim entity.
 *
 * Immutable. `markAsRead()` yeni bir Notification döner.
 */
import type { NotificationKind } from '../valueObjects/NotificationKind.js';

export interface NotificationProps {
  id: string;
  recipientUserId: number;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  createdBy: string;
  createdAt: Date;
  readAt: Date | null;
}

export class Notification {
  private constructor(private readonly props: Readonly<NotificationProps>) {}

  static create(props: NotificationProps): Notification {
    if (!props.id) throw new Error('Notification.id boş olamaz');
    if (!props.title.trim()) throw new Error('Notification.title boş olamaz');
    if (props.recipientUserId <= 0) throw new Error('Notification.recipientUserId pozitif olmalı');
    return new Notification(props);
  }

  get id(): string {
    return this.props.id;
  }
  get recipientUserId(): number {
    return this.props.recipientUserId;
  }
  get kind(): NotificationKind {
    return this.props.kind;
  }
  get title(): string {
    return this.props.title;
  }
  get body(): string {
    return this.props.body;
  }
  get link(): string | null {
    return this.props.link;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get readAt(): Date | null {
    return this.props.readAt;
  }
  get isRead(): boolean {
    return this.props.readAt !== null;
  }

  /** Yeni bir Notification döner — okundu işaretlenmiş. Orijinal değişmez. */
  markAsRead(now: Date = new Date()): Notification {
    if (this.isRead) return this;
    return new Notification({ ...this.props, readAt: now });
  }

  /** Plain object'e çevirir (DTO/persistence için). */
  toJSON(): Readonly<NotificationProps> {
    return { ...this.props };
  }
}
