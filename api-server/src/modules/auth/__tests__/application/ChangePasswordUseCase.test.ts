import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CurrentPasswordMismatchError,
  InvalidCredentialsError,
} from '../../application/errors/AuthErrors.js';
import { ChangePasswordUseCase } from '../../application/useCases/ChangePasswordUseCase.js';
import { WeakPasswordError } from '../../domain/valueObjects/Password.js';

import { FakePasswordHasher, InMemoryRefreshSessionStore, InMemoryUserRepo } from './fakes.js';

function build(opts: { passwordHash?: string } = {}) {
  const users = InMemoryUserRepo.withSeed({
    id: 1,
    username: 'admin',
    passwordHash: opts.passwordHash ?? 'hash-of(current123)',
  });
  const sessions = new InMemoryRefreshSessionStore();
  // Aktif bir session ekle
  void sessions.create({
    jti: 'jti-active',
    userId: 1,
    refreshTokenHash: 'h',
    expiresAt: new Date(Date.now() + 86400_000),
  });
  const useCase = new ChangePasswordUseCase({
    users,
    hasher: new FakePasswordHasher(),
    sessions,
  });
  return { useCase, users, sessions };
}

describe('ChangePasswordUseCase', () => {
  it("happy path: hash güncellenir, tüm session'lar revoke edilir", async () => {
    const { useCase, users, sessions } = build();
    await useCase.execute({
      userId: 1,
      currentPassword: 'current123',
      newPassword: 'newpass123',
    });
    assert.equal(await users.findPasswordHashByUserId(1), 'hash-of(newpass123)');
    assert.notEqual(sessions.sessions[0]!.revokedAt, null);
  });

  it('yanlış current password -> CurrentPasswordMismatchError', async () => {
    const { useCase } = build();
    await assert.rejects(
      useCase.execute({
        userId: 1,
        currentPassword: 'wrong',
        newPassword: 'newpass123',
      }),
      CurrentPasswordMismatchError,
    );
  });

  it('zayıf yeni password -> WeakPasswordError', async () => {
    const { useCase } = build();
    await assert.rejects(
      useCase.execute({
        userId: 1,
        currentPassword: 'current123',
        newPassword: 'short',
      }),
      WeakPasswordError,
    );
  });

  it('hash kaydı yoksa -> InvalidCredentialsError', async () => {
    const users = InMemoryUserRepo.withSeed({ id: 2, username: 'noHash' });
    const sessions = new InMemoryRefreshSessionStore();
    const useCase = new ChangePasswordUseCase({
      users,
      hasher: new FakePasswordHasher(),
      sessions,
    });
    await assert.rejects(
      useCase.execute({
        userId: 2,
        currentPassword: 'whatever',
        newPassword: 'newpass123',
      }),
      InvalidCredentialsError,
    );
  });
});
