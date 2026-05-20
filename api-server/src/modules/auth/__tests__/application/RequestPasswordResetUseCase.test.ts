import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RequestPasswordResetUseCase } from '../../application/useCases/RequestPasswordResetUseCase.js';

import {
  fakeClock,
  FakeEmailSender,
  InMemoryPasswordResetTokenStore,
  InMemoryUserRepo,
} from './fakes.js';

function build(opts: { hasUser?: boolean; active?: boolean; resetUrl?: string } = {}) {
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
  return { useCase: new RequestPasswordResetUseCase(cfg), tokens, email };
}

describe('RequestPasswordResetUseCase', () => {
  it('happy path: token oluşturulur, email atılır', async () => {
    const { useCase, tokens, email } = build({
      resetUrl: 'https://app.example.com/reset?t={token}',
    });
    await useCase.execute({ email: 'admin@example.com', lang: 'tr' });

    assert.equal(tokens.records.length, 1);
    assert.equal(tokens.records[0]!.userId, 1);
    assert.match(tokens.records[0]!.token, /^[0-9a-f]{64}$/);
    assert.equal(email.sent.length, 1);
    assert.equal(email.sent[0]!.to, 'admin@example.com');
    assert.equal(email.sent[0]!.lang, 'tr');
    assert.match(email.sent[0]!.resetUrl ?? '', /^https:\/\/app/);
  });

  it('user yoksa sessizce başarılı (enumeration koruması)', async () => {
    const { useCase, tokens, email } = build({ hasUser: false });
    await useCase.execute({ email: 'yok@example.com' });
    assert.equal(tokens.records.length, 0);
    assert.equal(email.sent.length, 0);
  });

  it('pasif user için de sessizce başarılı', async () => {
    const { useCase, tokens, email } = build({ active: false });
    await useCase.execute({ email: 'admin@example.com' });
    assert.equal(tokens.records.length, 0);
    assert.equal(email.sent.length, 0);
  });
});
