import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Clock } from '../../application/ports/Clock.js';
import type { NotificationRepository } from '../../application/ports/NotificationRepository.js';
import {
  MarkNotificationAsReadUseCase,
  NotificationForbiddenError,
  NotificationNotFoundError,
} from '../../application/useCases/MarkNotificationAsRead.js';
import { Notification } from '../../domain/entities/Notification.js';

class InMemoryRepo implements NotificationRepository {
  constructor(public store: Notification[] = []) {}
  async save(n: Notification): Promise<void> {
    const i = this.store.findIndex((x) => x.id === n.id);
    if (i >= 0) this.store[i] = n;
    else this.store.push(n);
  }
  async findByRecipient(): Promise<ReadonlyArray<Notification>> {
    return this.store;
  }
  async findById(id: string): Promise<Notification | null> {
    return this.store.find((x) => x.id === id) ?? null;
  }
  async countUnread(): Promise<number> {
    return this.store.filter((n) => !n.isRead).length;
  }
}

const clock: Clock = { now: () => new Date('2026-05-19T13:00:00Z') };

function buildNotif(props: Partial<{ id: string; recipientUserId: number }> = {}): Notification {
  return Notification.create({
    id: props.id ?? 'n-1',
    recipientUserId: props.recipientUserId ?? 42,
    kind: { kind: 'generic' },
    title: 'Test',
    body: 'Body',
    link: null,
    createdBy: 'system',
    createdAt: new Date('2026-05-19T09:00:00Z'),
    readAt: null,
  });
}

describe('MarkNotificationAsReadUseCase', () => {
  it('okunmamış bildirimi okundu işaretler', async () => {
    const n = buildNotif();
    const repo = new InMemoryRepo([n]);
    const uc = new MarkNotificationAsReadUseCase(repo, clock);

    await uc.execute({ notificationId: 'n-1', actorUserId: 42 });

    const after = await repo.findById('n-1');
    assert.equal(after!.isRead, true);
    assert.deepEqual(after!.readAt, new Date('2026-05-19T13:00:00Z'));
  });

  it('bulunamayan id için NotificationNotFoundError fırlatır', async () => {
    const repo = new InMemoryRepo([]);
    const uc = new MarkNotificationAsReadUseCase(repo, clock);

    await assert.rejects(
      uc.execute({ notificationId: 'yok', actorUserId: 42 }),
      NotificationNotFoundError,
    );
  });

  it('başkasının bildirimini işaretleyemez (Forbidden)', async () => {
    const n = buildNotif({ recipientUserId: 99 });
    const repo = new InMemoryRepo([n]);
    const uc = new MarkNotificationAsReadUseCase(repo, clock);

    await assert.rejects(
      uc.execute({ notificationId: 'n-1', actorUserId: 42 }),
      NotificationForbiddenError,
    );
  });
});
