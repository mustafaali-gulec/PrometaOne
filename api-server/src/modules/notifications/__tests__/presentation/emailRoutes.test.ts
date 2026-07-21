/**
 * Email routes test — Hono in-memory request/response + gerçek JWT
 * (config.JWT_SECRET .env'den gelir; authMiddleware zincirde).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import jwt from 'jsonwebtoken';

import { config } from '../../../../config.js';
import type { UserRole } from '../../../../types.js';
import type { Clock } from '../../application/ports/Clock.js';
import type {
  EmailLogEntry,
  EmailLogFilter,
  EmailLogListResult,
  EmailLogRepository,
} from '../../application/ports/EmailLogRepository.js';
import type { EmailRecipientDirectory } from '../../application/ports/EmailRecipientDirectory.js';
import type { EmailService, SendEmailResult } from '../../application/ports/EmailService.js';
import type { IdGenerator } from '../../application/ports/IdGenerator.js';
import { SendNotificationEmailUseCase } from '../../application/useCases/SendNotificationEmail.js';
import { createEmailRouter } from '../../presentation/emailRoutes.js';

class StubLog implements EmailLogRepository {
  entries: EmailLogEntry[] = [];
  async insert(log: EmailLogEntry): Promise<void> {
    this.entries.push(log);
  }
  async list(_filter: EmailLogFilter): Promise<EmailLogListResult> {
    return { items: this.entries, total: this.entries.length };
  }
}

const stubEmail: EmailService = {
  async send(): Promise<SendEmailResult> {
    return { messageId: 'm-1' };
  },
};

const stubDirectory: EmailRecipientDirectory = {
  async findUserEmailByUsername(): Promise<string | null> {
    return 'mustafa@firma.com';
  },
  async isKnownEmployeeEmail(email: string): Promise<boolean> {
    return email === 'calisan@firma.com';
  },
};

const ids: IdGenerator = { next: () => 'em-1' };
const clock: Clock = { now: () => new Date('2026-07-20T10:00:00Z') };

function makeRouter(log = new StubLog()) {
  const useCase = new SendNotificationEmailUseCase(stubEmail, log, stubDirectory, ids, clock, {
    emailConfigured: true,
    providerName: 'smtp',
  });
  return createEmailRouter({ sendEmailUseCase: useCase, emailLogRepo: log });
}

function bearer(username: string, role: UserRole = 'editor'): string {
  return `Bearer ${jwt.sign({ sub: 1, username, role }, config.JWT_SECRET)}`;
}

describe('createEmailRouter', () => {
  it("POST /send auth'suz → 401", async () => {
    const router = makeRouter();
    const res = await router.request('/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'calisan@firma.com', subject: 'Merhaba' }),
    });
    assert.equal(res.status, 401);
  });

  it('POST /send geçersiz gövde (to e-posta değil) → 400', async () => {
    const router = makeRouter();
    const res = await router.request('/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: bearer('mustafa') },
      body: JSON.stringify({ to: 'e-posta-degil', subject: 'Merhaba' }),
    });
    assert.equal(res.status, 400);
  });

  it('POST /send FE sözleşmesi: use-case sonucu aynen döner', async () => {
    const router = makeRouter();
    const res = await router.request('/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: bearer('mustafa') },
      body: JSON.stringify({
        to: 'calisan@firma.com',
        subject: 'İzin Onayı',
        html: '<p>onaylandı</p>',
        meta: { kind: 'request_approved' },
      }),
    });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { success: true, messageId: 'm-1' });
  });

  it('GET /log admin olmayan → 403; admin → {items, total}', async () => {
    const log = new StubLog();
    const router = makeRouter(log);

    const forbidden = await router.request('/log', {
      headers: { Authorization: bearer('editor.kisi', 'editor') },
    });
    assert.equal(forbidden.status, 403);

    const allowed = await router.request('/log?limit=10&offset=0', {
      headers: { Authorization: bearer('yonetici', 'admin') },
    });
    assert.equal(allowed.status, 200);
    const body = (await allowed.json()) as { items: unknown[]; total: number };
    assert.deepEqual(body, { items: [], total: 0 });
  });
});
