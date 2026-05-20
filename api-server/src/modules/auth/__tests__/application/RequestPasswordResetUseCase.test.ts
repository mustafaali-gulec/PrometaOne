import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RequestPasswordResetUseCase } from '../../application/useCases/RequestPasswordResetUseCase.js';

import {
  fakeClock,
  FakeEmailSender,
  InMemoryPasswordResetTokenStore,
  InMemoryUserRepo,
} from './fakes.js';

function build(opts: {
  hasUser?: boolean;
  active?: boolean;
  resetUrl?: string;
  generateToken?: () => string;
} = {}) {
  const users = opts.hasUser === false
    ? new InMemoryUserRepo()
    : InMemoryUserRepo.withSeed({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        active: opts.active ?? true,
      });
  const tokens = new InMemoryPasswordResetTokenStore();
  const email = new FakeEmailSender();
  const cfg: ConstructorParameters<typeof RequestPasswordResetUseCase>[0] = {
    users,
    tokens,
    email,
    clock: fakeClock(),
    ttlMinutes: 15,
  };
  if (opts.resetUrl !== undefined) {
    (cfg as { resetUrlTemplate?: string }).resetUrlTemplate = opts.resetUrl;
  }
  if (opts.generateToken !== undefined) {
    (cfg as { generateToken?: () => string }).generateToken = opts.generateToken;
  }
  return { useCase: new RequestPasswordResetUseCase(cfg), tokens, email };
}

describe('RequestPasswordResetUseCase', () => {
  it('happy path: token olusturulur, email atilir', async () => {
    const { useCase, tokens, email } = build({
      resetUrl: 'https://app.example.com/reset?t={token}',
    });
    const result = await useCase.execute({
      emailOrUsername: 'admin@example.com',
      lang: 'tr',
    });

    assert.notEqual(result, null);
    assert.equal(result!.emailSent, true);
    assert.equal(tokens.records.length, 1);
    assert.equal(tokens.records[0]!.userId, 1);
    assert.match(tokens.records[0]!.token, /^[0-9a-f]{64}$/);
    assert.equal(tokens.records[0]!.emailSent, true);
    assert.equal(email.sent.length, 1);
    assert.equal(email.sent[0]!.to, 'admin@example.com');
    assert.equal(email.sent[0]!.lang, 'tr');
    assert.match(email.sent[0]!.resetUrl ?? '', /^https:\/\/app/);
  });

  it('username ile de bulur (emailOrUsername)', async () => {
    const { useCase, tokens } = build({});
    const result = await useCase.execute({ emailOrUsername: 'admin' });
    assert.notEqual(result, null);
    assert.equal(tokens.records.length, 1);
    assert.equal(tokens.records[0]!.userId, 1);
  });

  it('user yoksa null doner ve hicbir kayit olusmaz', async () => {
    const { useCase, tokens, email } = build({ hasUser: false });
    const result = await useCase.execute({ emailOrUsername: 'yok@example.com' });
    assert.equal(result, null);
    assert.equal(tokens.records.length, 0);
    assert.equal(email.sent.length, 0);
  });

  it('pasif user icin null doner', async () => {
    const { useCase, tokens, email } = build({ active: false });
    const result = await useCase.execute({ emailOrUsername: 'admin@example.com' });
    assert.equal(result, null);
    assert.equal(tokens.records.length, 0);
    assert.equal(email.sent.length, 0);
  });

  it('generateToken override edilebilir (6-haneli sayisal kod)', async () => {
    const { useCase, tokens } = build({ generateToken: () => '123456' });
    const result = await useCase.execute({ emailOrUsername: 'admin' });
    assert.equal(result!.token, '123456');
    assert.equal(tokens.records[0]!.token, '123456');
  });

  it('eski kullanilmamis token revoke edilir', async () => {
    const { useCase, tokens } = build({});
    await useCase.execute({ emailOrUsername: 'admin' });
    await useCase.execute({ emailOrUsername: 'admin' });
    assert.equal(tokens.records.length, 2);
    assert.notEqual(tokens.records[0]!.usedAt, null, 'eski token revoke');
    assert.equal(tokens.records[1]!.usedAt, null, 'yeni token aktif');
  });

  it('email gonderilemezse emailSent: false doner', async () => {
    const { useCase, tokens, email } = build({});
    email.deliverResult = { sent: false, error: 'SMTP_FAIL' };
    const result = await useCase.execute({ emailOrUsername: 'admin' });
    assert.equal(result!.emailSent, false);
    assert.equal(tokens.records[0]!.emailSent, false, 'markEmailSent cagrilmadi');
  });
});
