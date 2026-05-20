import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LogoutUseCase } from '../../application/useCases/LogoutUseCase.js';
import { InMemoryRefreshSessionStore } from './fakes.js';

describe('LogoutUseCase', () => {
  it('refresh session\'ı revoke eder', async () => {
    const sessions = new InMemoryRefreshSessionStore();
    await sessions.create({
      jti: 'jti-1',
      userId: 1,
      refreshTokenHash: 'h',
      expiresAt: new Date(Date.now() + 86400_000),
    });
    const uc = new LogoutUseCase(sessions);

    await uc.execute({ refreshTokenJti: 'jti-1' });

    assert.notEqual(sessions.sessions[0]!.revokedAt, null);
  });

  it('mevcut olmayan jti için sessizce başarılı', async () => {
    const sessions = new InMemoryRefreshSessionStore();
    const uc = new LogoutUseCase(sessions);
    await uc.execute({ refreshTokenJti: 'yok' });
    assert.equal(sessions.sessions.length, 0);
  });
});
