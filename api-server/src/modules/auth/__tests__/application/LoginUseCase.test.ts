import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AccountInactiveError,
  InvalidCredentialsError,
} from '../../application/errors/AuthErrors.js';
import { LoginUseCase } from '../../application/useCases/LoginUseCase.js';

import {
  fakeClock,
  fakeSha256,
  FakePasswordHasher,
  FakeTokenIssuer,
  InMemoryRefreshSessionStore,
  InMemoryUserRepo,
} from './fakes.js';

const ONE_WEEK_SEC = 7 * 24 * 3600;

function build(opts: { passwordHash?: string; active?: boolean } = {}) {
  const users = InMemoryUserRepo.withSeed({
    id: 1,
    username: 'admin',
    passwordHash: opts.passwordHash ?? 'hash-of(admin123)',
    active: opts.active ?? true,
  });
  const sessions = new InMemoryRefreshSessionStore();
  const useCase = new LoginUseCase({
    users,
    hasher: new FakePasswordHasher(),
    tokens: new FakeTokenIssuer(),
    sessions,
    clock: fakeClock(),
    sha256: fakeSha256,
    refreshTokenTtlSeconds: ONE_WEEK_SEC,
  });
  return { useCase, users, sessions };
}

describe('LoginUseCase', () => {
  it('happy path: token + user DTO döner, session kaydedilir, lastLoginAt set edilir', async () => {
    const { useCase, users, sessions } = build();
    const r = await useCase.execute({
      username: 'admin',
      password: 'admin123',
      ip: '127.0.0.1',
      userAgent: 'curl/8',
    });

    assert.equal(r.accessToken, 'access:1:admin');
    assert.match(r.refreshToken, /^refresh:1:jti-1$/);
    assert.equal(r.expiresIn, 900);
    assert.equal(r.user.username, 'admin');
    assert.notEqual(r.user.lastLoginAt, null, 'lastLoginAt güncellendi');

    assert.equal(sessions.sessions.length, 1);
    assert.equal(sessions.sessions[0]!.jti, 'jti-1');
    assert.equal(sessions.sessions[0]!.userId, 1);
    assert.equal(sessions.sessions[0]!.ip, '127.0.0.1');
    assert.equal(sessions.sessions[0]!.userAgent, 'curl/8');

    // User repo'da lastLoginAt persistent
    const saved = await users.findById(1);
    assert.notEqual(saved?.lastLoginAt, null);
  });

  it('bilinmeyen username -> InvalidCredentialsError', async () => {
    const { useCase } = build();
    await assert.rejects(
      useCase.execute({ username: 'yok', password: 'admin123' }),
      InvalidCredentialsError,
    );
  });

  it('yanlış password -> InvalidCredentialsError', async () => {
    const { useCase } = build();
    await assert.rejects(
      useCase.execute({ username: 'admin', password: 'wrong' }),
      InvalidCredentialsError,
    );
  });

  it('pasif hesap -> AccountInactiveError', async () => {
    const { useCase } = build({ active: false });
    await assert.rejects(
      useCase.execute({ username: 'admin', password: 'admin123' }),
      AccountInactiveError,
    );
  });

  it('hash kaydı yoksa -> InvalidCredentialsError', async () => {
    const users = InMemoryUserRepo.withSeed({ id: 1, username: 'admin' });
    // passwordHash YOK
    const useCase = new LoginUseCase({
      users,
      hasher: new FakePasswordHasher(),
      tokens: new FakeTokenIssuer(),
      sessions: new InMemoryRefreshSessionStore(),
      clock: fakeClock(),
      sha256: fakeSha256,
      refreshTokenTtlSeconds: ONE_WEEK_SEC,
    });
    await assert.rejects(
      useCase.execute({ username: 'admin', password: 'admin123' }),
      InvalidCredentialsError,
    );
  });
});
