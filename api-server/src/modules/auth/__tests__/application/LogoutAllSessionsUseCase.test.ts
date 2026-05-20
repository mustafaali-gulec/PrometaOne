import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LogoutAllSessionsUseCase } from '../../application/useCases/LogoutAllSessionsUseCase.js';
import { InMemoryRefreshSessionStore } from './fakes.js';

describe('LogoutAllSessionsUseCase', () => {
  it('kullanıcının tüm aktif session\'larını revoke eder', async () => {
    const sessions = new InMemoryRefreshSessionStore();
    await sessions.create({
      jti: 'a',
      userId: 1,
      refreshTokenHash: 'h',
      expiresAt: new Date(Date.now() + 86400_000),
    });
    await sessions.create({
      jti: 'b',
      userId: 1,
      refreshTokenHash: 'h2',
      expiresAt: new Date(Date.now() + 86400_000),
    });
    await sessions.create({
      jti: 'c',
      userId: 2,
      refreshTokenHash: 'h3',
      expiresAt: new Date(Date.now() + 86400_000),
    });

    const uc = new LogoutAllSessionsUseCase(sessions);
    await uc.execute({ userId: 1 });

    assert.notEqual(sessions.sessions[0]!.revokedAt, null, 'a revoke edildi');
    assert.notEqual(sessions.sessions[1]!.revokedAt, null, 'b revoke edildi');
    assert.equal(sessions.sessions[2]!.revokedAt, null, 'c (başka user) revoke edilmedi');
  });

  it('user yoksa hata atmaz', async () => {
    const sessions = new InMemoryRefreshSessionStore();
    const uc = new LogoutAllSessionsUseCase(sessions);
    await uc.execute({ userId: 999 });
    assert.equal(sessions.sessions.length, 0);
  });
});
