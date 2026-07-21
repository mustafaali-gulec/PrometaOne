import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Clock } from '../../application/ports/Clock.js';
import type {
  EmailLogEntry,
  EmailLogFilter,
  EmailLogListResult,
  EmailLogRepository,
} from '../../application/ports/EmailLogRepository.js';
import type { EmailRecipientDirectory } from '../../application/ports/EmailRecipientDirectory.js';
import type {
  EmailService,
  SendEmailRequest,
  SendEmailResult,
} from '../../application/ports/EmailService.js';
import type { IdGenerator } from '../../application/ports/IdGenerator.js';
import { SendNotificationEmailUseCase } from '../../application/useCases/SendNotificationEmail.js';

class FakeEmailService implements EmailService {
  sent: SendEmailRequest[] = [];
  failWith: Error | null = null;

  async send(req: SendEmailRequest): Promise<SendEmailResult> {
    if (this.failWith) throw this.failWith;
    this.sent.push(req);
    return { messageId: 'smtp-msg-1' };
  }
}

class InMemoryEmailLog implements EmailLogRepository {
  entries: EmailLogEntry[] = [];
  failWith: Error | null = null;

  async insert(log: EmailLogEntry): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.entries.push(log);
  }

  async list(_filter: EmailLogFilter): Promise<EmailLogListResult> {
    return { items: this.entries, total: this.entries.length };
  }
}

class FakeDirectory implements EmailRecipientDirectory {
  constructor(
    private readonly userEmails: Record<string, string>,
    private readonly employeeEmails: string[],
  ) {}

  async findUserEmailByUsername(username: string): Promise<string | null> {
    return this.userEmails[username] ?? null;
  }

  async isKnownEmployeeEmail(email: string): Promise<boolean> {
    return this.employeeEmails.includes(email);
  }
}

class SequentialIds implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `em-${this.n}`;
  }
}

const clock: Clock = { now: () => new Date('2026-07-20T10:00:00Z') };
const SENDER = { userId: 5, username: 'mustafa' };

function makeUseCase(opts?: {
  email?: FakeEmailService;
  log?: InMemoryEmailLog;
  directory?: FakeDirectory;
  configured?: boolean;
}) {
  const email = opts?.email ?? new FakeEmailService();
  const log = opts?.log ?? new InMemoryEmailLog();
  const directory =
    opts?.directory ?? new FakeDirectory({ mustafa: 'mustafa@firma.com' }, ['calisan@firma.com']);
  const uc = new SendNotificationEmailUseCase(email, log, directory, new SequentialIds(), clock, {
    emailConfigured: opts?.configured ?? true,
    providerName: 'smtp',
  });
  return { uc, email, log, directory };
}

describe('SendNotificationEmailUseCase', () => {
  it("meta.kind='test': kendi adresine gönderim başarılı + log 'sent'", async () => {
    const { uc, email, log } = makeUseCase();

    const result = await uc.execute({
      to: 'mustafa@firma.com',
      subject: 'Test',
      text: 'deneme',
      meta: { kind: 'test' },
      sender: SENDER,
    });

    assert.equal(result.success, true);
    assert.equal(result.messageId, 'smtp-msg-1');
    assert.equal(email.sent.length, 1);
    assert.equal(log.entries.length, 1);
    assert.equal(log.entries[0]?.status, 'sent');
    assert.equal(log.entries[0]?.kind, 'test');
    assert.equal(log.entries[0]?.messageId, 'smtp-msg-1');
    assert.equal(log.entries[0]?.senderUserId, '5');
  });

  it("meta.kind='test': BAŞKASININ adresine gönderim reddedilir + log 'failed'", async () => {
    const { uc, email, log } = makeUseCase();

    const result = await uc.execute({
      to: 'baskasi@firma.com',
      subject: 'Test',
      meta: { kind: 'test' },
      sender: SENDER,
    });

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /kendi adresinize/);
    assert.equal(email.sent.length, 0);
    assert.equal(log.entries[0]?.status, 'failed');
  });

  it("meta.kind='test': büyük/küçük harf farkı kabul edilir (CITEXT)", async () => {
    const { uc } = makeUseCase();

    const result = await uc.execute({
      to: 'MUSTAFA@FIRMA.COM',
      subject: 'Test',
      meta: { kind: 'test' },
      sender: SENDER,
    });

    assert.equal(result.success, true);
  });

  it("açık-relay engeli: hrEmployees'te olmayan adres reddedilir + log 'failed'", async () => {
    const { uc, email, log } = makeUseCase();

    const result = await uc.execute({
      to: 'disaridaki@baska-sirket.com',
      subject: 'Bildirim',
      html: '<p>merhaba</p>',
      sender: SENDER,
    });

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /kayıtlı bir çalışan/);
    assert.equal(email.sent.length, 0);
    assert.equal(log.entries[0]?.status, 'failed');
  });

  it("hrEmployees'teki adrese gönderim başarılı; meta alanları log'a yazılır", async () => {
    const { uc, log } = makeUseCase();

    const result = await uc.execute({
      to: 'calisan@firma.com',
      subject: 'İzin Onayı',
      html: '<p>onaylandı</p>',
      fromName: 'İK',
      replyTo: 'ik@firma.com',
      meta: { kind: 'request_approved', recipientUserId: 'u-9', notificationId: 'n-3' },
      sender: SENDER,
    });

    assert.equal(result.success, true);
    assert.equal(log.entries[0]?.status, 'sent');
    assert.equal(log.entries[0]?.kind, 'request_approved');
    assert.equal(log.entries[0]?.recipientUserId, 'u-9');
    assert.equal(log.entries[0]?.notificationId, 'n-3');
    assert.equal(log.entries[0]?.provider, 'smtp');
  });

  it("SMTP hatasında throw ETMEZ: {success:false, error} + log 'failed'", async () => {
    const email = new FakeEmailService();
    email.failWith = new Error('SMTP baglantisi koptu');
    const { uc, log } = makeUseCase({ email });

    const result = await uc.execute({
      to: 'calisan@firma.com',
      subject: 'Bildirim',
      text: 'merhaba',
      sender: SENDER,
    });

    assert.equal(result.success, false);
    assert.equal(result.error, 'SMTP baglantisi koptu');
    assert.equal(log.entries[0]?.status, 'failed');
    assert.equal(log.entries[0]?.error, 'SMTP baglantisi koptu');
  });

  it('SMTP yapılandırılmamışsa dürüstçe success:false (yalancı başarı yok)', async () => {
    const { uc, email, log } = makeUseCase({ configured: false });

    const result = await uc.execute({
      to: 'calisan@firma.com',
      subject: 'Bildirim',
      text: 'merhaba',
      sender: SENDER,
    });

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /SMTP yapılandırılmamış/);
    assert.equal(email.sent.length, 0);
    assert.equal(log.entries[0]?.status, 'failed');
    assert.equal(log.entries[0]?.provider, null);
  });

  it('log yazımı patlasa bile sonuç döner (asla throw yok)', async () => {
    const log = new InMemoryEmailLog();
    log.failWith = new Error('db koptu');
    const { uc } = makeUseCase({ log });

    const result = await uc.execute({
      to: 'calisan@firma.com',
      subject: 'Bildirim',
      text: 'merhaba',
      sender: SENDER,
    });

    assert.equal(result.success, true);
  });

  it('html verilmemişse text kaçışlanarak HTML gövdeye çevrilir', async () => {
    const { uc, email } = makeUseCase();

    await uc.execute({
      to: 'calisan@firma.com',
      subject: 'Bildirim',
      text: 'a < b & c',
      sender: SENDER,
    });

    assert.match(email.sent[0]?.html ?? '', /a &lt; b &amp; c/);
  });
});
