import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NotificationRepository } from '../../application/ports/NotificationRepository.js';
import { FetchNotificationsForUserUseCase } from '../../application/useCases/FetchNotificationsForUser.js';
import { Notification } from '../../domain/entities/Notification.js';

class InMemoryRepo implements NotificationRepository {
  constructor(public store: Notification[] = []) {}
  async save(): Promise<void> {
    /* not used */
  }
  async findByRecipient(
    recipientUserId: number,
    options?: { limit?: number; unreadOnly?: boolean },
  ): Promise<ReadonlyArray<Notification>> {
    let filtered = this.store.filter((n) => n.recipientUserId === recipientUserId);
    if (options?.unreadOnly) filtered = filtered.filter((n) => !n.isRead);
    if (options?.limit !== undefined) filtered = filtered.slice(0, options.limit);
    return filtered;
  }
  async findById(): Promise<Notification | null> {
    return null;
  }
  async countUnread(recipientUserId: number): Promise<number> {
    return this.store.filter((n) => n.recipientUserId === recipientUserId && !n.isRead).length;
  }
}

function makeNotif(id: string, userId: number, read: boolean): Notification {
  return Notification.create({
    id,
    recipientUserId: userId,
    kind: { kind: 'generic' },
    title: 't',
    body: 'b',
    link: null,
    createdBy: 'system',
    createdAt: new Date(),
    readAt: read ? new Date() : null,
  });
}

describe('FetchNotificationsForUserUseCase', () => {
  it('kullanıcının bildirimlerini DTO olarak döner', async () => {
    const repo = new InMemoryRepo([
      makeNotif('n-1', 42, false),
      makeNotif('n-2', 42, true),
      makeNotif('n-3', 99, false), // başka kullanıcı
    ]);
    const uc = new FetchNotificationsForUserUseCase(repo);

    const result = await uc.execute({ recipientUserId: 42 });

    assert.equal(result.notifications.length, 2);
    assert.equal(result.unreadCount, 1);
    assert.equal(result.notifications[0]!.id, 'n-1');
    assert.equal(typeof result.notifications[0]!.createdAt, 'string');
  });

  it('unreadOnly: true ile sadece okunmamışlar gelir', async () => {
    const repo = new InMemoryRepo([makeNotif('n-1', 42, false), makeNotif('n-2', 42, true)]);
    const uc = new FetchNotificationsForUserUseCase(repo);

    const result = await uc.execute({ recipientUserId: 42, unreadOnly: true });
    assert.equal(result.notifications.length, 1);
    assert.equal(result.notifications[0]!.id, 'n-1');
  });

  it('limit uygulanır', async () => {
    const repo = new InMemoryRepo([
      makeNotif('n-1', 42, false),
      makeNotif('n-2', 42, false),
      makeNotif('n-3', 42, false),
    ]);
    const uc = new FetchNotificationsForUserUseCase(repo);

    const result = await uc.execute({ recipientUserId: 42, limit: 2 });
    assert.equal(result.notifications.length, 2);
  });

  it('recipientUserId <= 0 ise fırlatır', async () => {
    const uc = new FetchNotificationsForUserUseCase(new InMemoryRepo());
    await assert.rejects(uc.execute({ recipientUserId: 0 }), /pozitif olmalı/);
  });
});
