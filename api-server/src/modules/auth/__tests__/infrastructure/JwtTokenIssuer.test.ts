import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import jwt from 'jsonwebtoken';

import { InvalidTokenError, TokenExpiredError } from '../../application/ports/TokenIssuer.js';
import { JwtTokenIssuer, sha256Hex } from '../../infrastructure/jwt/JwtTokenIssuer.js';

const cfg = {
  accessSecret: 'a'.repeat(32),
  refreshSecret: 'b'.repeat(32),
  accessExpires: '15m',
  refreshExpires: '7d',
  issuer: 'test',
};

describe('JwtTokenIssuer', () => {
  it('secret 32 karakterden kısaysa fırlatır', () => {
    assert.throws(() => new JwtTokenIssuer({ ...cfg, accessSecret: 'short' }), /32 karakter/);
  });

  it('issue access + refresh üretir, jti unique', () => {
    const t = new JwtTokenIssuer(cfg);
    const a = t.issue({ sub: 1, username: 'admin', role: 'admin', companies: [] });
    const b = t.issue({ sub: 1, username: 'admin', role: 'admin', companies: [] });

    assert.match(a.accessToken, /^eyJ/);
    assert.match(a.refreshToken, /^eyJ/);
    assert.equal(a.accessTokenTtlSeconds, 900);
    assert.notEqual(a.refreshTokenJti, b.refreshTokenJti, 'jti farklı');
  });

  it('issueAccessToken sadece access üretir', () => {
    const t = new JwtTokenIssuer(cfg);
    const r = t.issueAccessToken({ sub: 5, username: 'u', role: 'editor', companies: [] });
    assert.match(r.token, /^eyJ/);
    assert.equal(r.ttlSeconds, 900);
  });

  it('verifyRefreshToken doğru imzayı kabul eder', () => {
    const t = new JwtTokenIssuer(cfg);
    const a = t.issue({ sub: 42, username: 'x', role: 'cfo', companies: [1, 2] });
    const payload = t.verifyRefreshToken(a.refreshToken);
    assert.equal(payload.sub, 42);
    assert.equal(payload.jti, a.refreshTokenJti);
  });

  it('verifyRefreshToken yanlış imza için InvalidTokenError', () => {
    const t = new JwtTokenIssuer(cfg);
    const bad = jwt.sign({ sub: 1, jti: 'x' }, 'baska-secret-' + 'x'.repeat(20));
    assert.throws(() => t.verifyRefreshToken(bad), InvalidTokenError);
  });

  it('verifyRefreshToken expired token için TokenExpiredError', () => {
    const t = new JwtTokenIssuer(cfg);
    const expired = jwt.sign(
      { sub: 1, jti: 'x', exp: Math.floor(Date.now() / 1000) - 10 },
      cfg.refreshSecret,
    );
    assert.throws(() => t.verifyRefreshToken(expired), TokenExpiredError);
  });

  it('sha256Hex 64 karakter hex döner', () => {
    const h = sha256Hex('selam');
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(sha256Hex('selam'), h, 'aynı input aynı hash');
    assert.notEqual(sha256Hex('SELAM'), h, 'case-sensitive');
  });
});
