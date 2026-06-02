import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InvalidPasswordResetTokenError } from '../../application/errors/AuthErrors.js';
import { ResetPasswordUseCase } from '../../application/useCases/ResetPasswordUseCase.js';
import { WeakPasswordError } from '../../domain/valueObjects/Password.js';

import {
  FakePasswordHasher,
  InMemoryPasswordResetTokenStore,
  InMemoryRefreshSessionStore,
  InMemoryUserRepo,
} from './fakes.js';

async function build() {
  const users = InMemoryUserRepo.withSeed({
    id: 1,
    username: 'admin',
    passwordHash: 'hash-of(old)',
  });
  const tokens = new InMemoryPasswordResetTokenStore();
  await tokens.create({
    userId: 1,
    token: 'valid-token',
    expiresAt: new Date(Date.now() + 15 * 60_000),
  });
  const sessions = new InMemoryRefreshSessionStore();
  await sessions.create({
    jti: 'jti-1',
    userId: 1,
    refreshTokenHash: 'h',
    expiresAt: new Date(Date.now() + 86400_000),
  });
  const useCase = new ResetPasswordUseCase({
    users,
    tokens,
    sessions,
    hasher: new FakePasswordHasher(),
  });
  return { useCase, users, tokens, sessions };
}

describe('ResetPasswordUseCase', () => {
  it("happy path: hash güncellenir, token markUsed, session'lar revoke", async () => {
    const { useCase, users, tokens, sessions } = await build();
    await useCase.execute({ token: 'valid-token', newPassword: 'newpass123' });
    assert.equal(await users.findPasswordHashByUserId(1), 'hash-of(newpass123)');
    assert.notEqual(tokens.records[0]!.usedAt, null);
    assert.notEqual(sessions.sessions[0]!.revokedAt, null);
  });

  it('geçersiz token -> InvalidPasswordResetTokenError', async () => {
    const { useCase } = await build();
    await assert.rejects(
      useCase.execute({ token: 'yok', newPassword: 'newpass123' }),
      InvalidPasswordResetTokenError,
    );
  });

  it('zayıf password -> WeakPasswordError', async () => {
    const { useCase } = await build();
    await assert.rejects(
      useCase.execute({ token: 'valid-token', newPassword: 'short' }),
      WeakPasswordError,
    );
  });

  it('kullanılmış token -> InvalidPasswordResetTokenError', async () => {
    const { useCase, tokens } = await build();
    await tokens.markUsed('valid-token');
    await assert.rejects(
      useCase.execute({ token: 'valid-token', newPassword: 'newpass123' }),
      InvalidPasswordResetTokenError,
    );
  });
});
