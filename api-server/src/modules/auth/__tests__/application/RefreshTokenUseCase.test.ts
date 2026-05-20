import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AccountInactiveError,
  InvalidCredentialsError,
} from '../../application/errors/AuthErrors.js';
import { RefreshTokenUseCase } from '../../application/useCases/RefreshTokenUseCase.js';

import {
  fakeSha256,
  FakeTokenIssuer,
  InMemoryRefreshSessionStore,
  InMemoryUserRepo,
} from './fakes.js';

async function setup() {
  const users = InMemoryUserRepo.withSeed({ id: 1, username: 'admin', active: true });
  const sessions = new InMemoryRefreshSessionStore();
  const tokens = new FakeTokenIssuer();
  const issued = tokens.issue({ sub: 1, username: 'admin', role: 'admin' });
  await sessions.create({
    jti: issued.refreshTokenJti,
    userId: 1,
    refreshTokenHash: fakeSha256(issued.refreshToken),
    expiresAt: new Date(Date.now() + 86400_000),
  });
  const uc = new RefreshTokenUseCase({ tokens, sessions, users, sha256: fakeSha256 });
  return { uc, issued, users, sessions };
}

describe('RefreshTokenUseCase', () => {
  it('happy path: yeni access token döner', async () => {
    const { uc, issued } = await setup();
    const r = await uc.execute({ refreshToken: issued.refreshToken });
    assert.equal(r.accessToken, 'access:1:admin:refreshed');
    assert.equal(r.expiresIn, 900);
  });

  it('revoke edilmiş session -> InvalidCredentialsError', async () => {
    const { uc, issued, sessions } = await setup();
    await sessions.revoke(issued.refreshTokenJti);
    await assert.rejects(
      uc.execute({ refreshToken: issued.refreshToken }),
      InvalidCredentialsError,
    );
  });

  it('pasif kullanıcı -> AccountInactiveError', async () => {
    const { uc, issued, users } = await setup();
    const u = await users.findById(1);
    if (u) await users.save(u.deactivate());
    await assert.rejects(
      uc.execute({ refreshToken: issued.refreshToken }),
      AccountInactiveError,
    );
  });

  it('bozuk token -> hata', async () => {
    const { uc } = await setup();
    await assert.rejects(
      uc.execute({ refreshToken: 'bozuk' }),
      /Bozuk refresh token/,
    );
  });
});
