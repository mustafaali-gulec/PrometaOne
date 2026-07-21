import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Clock } from '../../application/ports/Clock.js';
import type { EmailService, SendEmailRequest } from '../../application/ports/EmailService.js';
import type { IdGenerator } from '../../application/ports/IdGenerator.js';
import type { NotificationRepository } from '../../application/ports/NotificationRepository.js';
import { CreateNotificationUseCase } from '../../application/useCases/CreateNotification.js';
import type { Notification } from '../../domain/entities/Notification.js';

class InMemoryNotificationRepo implements NotificationRepository {
  public saved: Notification[] = [];
  async save(n: Notification): Promise<void> {
    const idx = this.saved.findIndex((x) => x.id === n.id);
    if (idx >= 0) this.saved[idx] = n;
    else this.saved.push(n);
  }
  async findByRecipient(): Promise<ReadonlyArray<Notification>> {
    return this.saved;
  }
  async findById(id: string): Promise<Notification | null> {
    return this.saved.find((n) => n.id === id) ?? null;
  }
  async countUnread(): Promise<number> {
    return this.saved.filter((n) => !n.isRead).length;
  }
}

const fixedClock: Clock = {
  now: () => new Date('2026-05-19T12:00:00Z'),
};

class SequentialIds implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `n-${this.n}`;
  }
}

class FakeEmailService implements EmailService {
  public sent: SendEmailRequest[] = [];
  async send(req: SendEmailRequest): Promise<{ messageId?: string }> {
    this.sent.push(req);
    return {};
  }
}

describe('CreateNotificationUseCase', () => {
  it('repo.save çağrılır, doğru id ve içerik ile', async () => {
    const repo = new InMemoryNotificationRepo();
    const email = new FakeEmailService();
    const uc = new CreateNotificationUseCase(repo, fixedClock, new SequentialIds(), email);

    const id = await uc.execute({
      recipientUserId: 42,
      kind: {
        kind: 'invoice_overdue',
        invoiceCount: 3,
        totalAmount: 5000,
        currency: 'TRY',
      },
    });

    assert.equal(id, 'n-1');
    assert.equal(repo.saved.length, 1);
    assert.equal(repo.saved[0]!.recipientUserId, 42);
    assert.match(repo.saved[0]!.title, /3 fatura/);
    assert.match(repo.saved[0]!.body, /5\.000,00 ₺/);
  });

  it('emailRecipient yoksa email atılmaz', async () => {
    const repo = new InMemoryNotificationRepo();
    const email = new FakeEmailService();
    const uc = new CreateNotificationUseCase(repo, fixedClock, new SequentialIds(), email);

    await uc.execute({
      recipientUserId: 42,
      kind: { kind: 'generic' },
    });

    assert.equal(email.sent.length, 0);
  });

  it('emailRecipient varsa email atılır', async () => {
    const repo = new InMemoryNotificationRepo();
    const email = new FakeEmailService();
    const uc = new CreateNotificationUseCase(repo, fixedClock, new SequentialIds(), email);

    await uc.execute({
      recipientUserId: 42,
      kind: { kind: 'generic' },
      title: 'Özel başlık',
      body: 'Özel içerik',
      emailRecipient: { address: 'a@b.com', htmlBody: '<p>hi</p>' },
    });

    assert.equal(email.sent.length, 1);
    assert.equal(email.sent[0]!.to, 'a@b.com');
    assert.equal(email.sent[0]!.subject, 'Özel başlık');
    assert.equal(email.sent[0]!.html, '<p>hi</p>');
  });

  it("title/body override factory'i geçer", async () => {
    const repo = new InMemoryNotificationRepo();
    const email = new FakeEmailService();
    const uc = new CreateNotificationUseCase(repo, fixedClock, new SequentialIds(), email);

    await uc.execute({
      recipientUserId: 42,
      kind: { kind: 'generic' },
      title: 'CUSTOM',
      body: 'CUSTOM_BODY',
    });

    assert.equal(repo.saved[0]!.title, 'CUSTOM');
    assert.equal(repo.saved[0]!.body, 'CUSTOM_BODY');
  });

  it('createdAt clock.now() ile set edilir', async () => {
    const repo = new InMemoryNotificationRepo();
    const email = new FakeEmailService();
    const uc = new CreateNotificationUseCase(repo, fixedClock, new SequentialIds(), email);

    await uc.execute({
      recipientUserId: 42,
      kind: { kind: 'generic' },
    });

    assert.deepEqual(repo.saved[0]!.createdAt, new Date('2026-05-19T12:00:00Z'));
  });
});
