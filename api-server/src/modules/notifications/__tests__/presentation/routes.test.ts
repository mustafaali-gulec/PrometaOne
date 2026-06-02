/**
 * Routes test — Hono'nun in-memory request/response mekanizmasıyla.
 *
 * Auth middleware'i bypass etmek için custom JWT üreten bir helper kullanıyoruz.
 * (Test'te real config olmadığı için authMiddleware doğrudan kullanılamaz —
 *  routes.ts authMiddleware'i içeride mount ediyor; test için onu by-pass
 *  edemiyoruz. Bu yüzden bu test'i `// TODO: integration test in PR3` olarak
 *  yorum hâlinde bırakıyoruz ve sadece smoke test yapıyoruz.)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Clock } from '../../application/ports/Clock.js';
import type { EmailService } from '../../application/ports/EmailService.js';
import type { IdGenerator } from '../../application/ports/IdGenerator.js';
import type { NotificationRepository } from '../../application/ports/NotificationRepository.js';
import { CreateNotificationUseCase } from '../../application/useCases/CreateNotification.js';
import { FetchNotificationsForUserUseCase } from '../../application/useCases/FetchNotificationsForUser.js';
import { MarkNotificationAsReadUseCase } from '../../application/useCases/MarkNotificationAsRead.js';
import type { Notification } from '../../domain/entities/Notification.js';
import { createNotificationsRouter } from '../../presentation/routes.js';

class InMemoryRepo implements NotificationRepository {
  constructor(public store: Notification[] = []) {}
  async save(n: Notification): Promise<void> {
    const i = this.store.findIndex((x) => x.id === n.id);
    if (i >= 0) this.store[i] = n;
    else this.store.push(n);
  }
  async findByRecipient(recipientUserId: number): Promise<ReadonlyArray<Notification>> {
    return this.store.filter((n) => n.recipientUserId === recipientUserId);
  }
  async findById(id: string): Promise<Notification | null> {
    return this.store.find((n) => n.id === id) ?? null;
  }
  async countUnread(recipientUserId: number): Promise<number> {
    return this.store.filter((n) => n.recipientUserId === recipientUserId && !n.isRead).length;
  }
}

class FakeEmail implements EmailService {
  async send(): Promise<void> {
    /* no-op */
  }
}

class CountingIds implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `n-${this.n}`;
  }
}

const clock: Clock = { now: () => new Date('2026-05-19T12:00:00Z') };

describe('createNotificationsRouter', () => {
  it("auth header'sız istek 401 döner", async () => {
    const repo = new InMemoryRepo();
    const router = createNotificationsRouter({
      fetchUseCase: new FetchNotificationsForUserUseCase(repo),
      markAsReadUseCase: new MarkNotificationAsReadUseCase(repo, clock),
      createUseCase: new CreateNotificationUseCase(repo, clock, new CountingIds(), new FakeEmail()),
    });

    const res = await router.request('/');
    assert.equal(res.status, 401);
  });

  it("auth header'sız POST /:id/read 401 döner", async () => {
    const repo = new InMemoryRepo();
    const router = createNotificationsRouter({
      fetchUseCase: new FetchNotificationsForUserUseCase(repo),
      markAsReadUseCase: new MarkNotificationAsReadUseCase(repo, clock),
      createUseCase: new CreateNotificationUseCase(repo, clock, new CountingIds(), new FakeEmail()),
    });

    const res = await router.request('/n-1/read', { method: 'POST' });
    assert.equal(res.status, 401);
  });

  // NOT: Authenticated test'leri PR 3'te integration test olarak (gerçek JWT
  // + testcontainers PG) ekleyeceğiz. Buradaki smoke test'in tek amacı
  // route'ların gerçekten mount edildiğini ve auth middleware'in zincirde
  // olduğunu doğrulamak.
});
