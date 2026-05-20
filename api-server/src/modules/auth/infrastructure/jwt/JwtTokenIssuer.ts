/**
 * JwtTokenIssuer — TokenIssuer port'unun jsonwebtoken implementasyonu.
 *
 * Access + refresh ayrı secret'larla imzalanır.
 * Refresh token rotation için her token'a benzersiz jti üretir.
 */
import crypto from 'node:crypto';

import jwt, { type SignOptions } from 'jsonwebtoken';

import {
  InvalidTokenError,
  TokenExpiredError,
  type AccessTokenPayload,
  type IssuedTokens,
  type RefreshTokenPayload,
  type TokenIssuer,
} from '../../application/ports/TokenIssuer.js';

export interface JwtTokenIssuerConfig {
  accessSecret: string;
  refreshSecret: string;
  /** Örn: '15m', '1h'. */
  accessExpires: string;
  /** Örn: '7d', '30d'. */
  refreshExpires: string;
  issuer: string;
}

export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly cfg: JwtTokenIssuerConfig) {
    if (cfg.accessSecret.length < 32) {
      throw new Error('accessSecret en az 32 karakter olmalı');
    }
    if (cfg.refreshSecret.length < 32) {
      throw new Error('refreshSecret en az 32 karakter olmalı');
    }
  }

  issue(payload: AccessTokenPayload): IssuedTokens {
    const jti = crypto.randomUUID();
    const accessOpts = {
      expiresIn: this.cfg.accessExpires,
      issuer: this.cfg.issuer,
    } as SignOptions;
    const refreshOpts = {
      expiresIn: this.cfg.refreshExpires,
      issuer: this.cfg.issuer,
    } as SignOptions;

    const accessToken = jwt.sign(payload, this.cfg.accessSecret, accessOpts);
    const refreshPayload: RefreshTokenPayload = { sub: payload.sub, jti };
    const refreshToken = jwt.sign(refreshPayload, this.cfg.refreshSecret, refreshOpts);

    return {
      accessToken,
      refreshToken,
      accessTokenTtlSeconds: parseDurationSeconds(this.cfg.accessExpires),
      refreshTokenJti: jti,
    };
  }

  issueAccessToken(payload: AccessTokenPayload): { token: string; ttlSeconds: number } {
    const opts = {
      expiresIn: this.cfg.accessExpires,
      issuer: this.cfg.issuer,
    } as SignOptions;
    return {
      token: jwt.sign(payload, this.cfg.accessSecret, opts),
      ttlSeconds: parseDurationSeconds(this.cfg.accessExpires),
    };
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const payload = jwt.verify(token, this.cfg.refreshSecret) as unknown;
      if (
        payload === null ||
        typeof payload !== 'object' ||
        !('sub' in payload) ||
        !('jti' in payload)
      ) {
        throw new InvalidTokenError('Refresh token payload geçersiz');
      }
      const p = payload as { sub: unknown; jti: unknown };
      if (typeof p.sub !== 'number' || typeof p.jti !== 'string') {
        throw new InvalidTokenError('Refresh token alanları geçersiz tipte');
      }
      return { sub: p.sub, jti: p.jti };
    } catch (err: unknown) {
      if (err instanceof InvalidTokenError) throw err;
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError(err instanceof Error ? err.message : 'Token doğrulanamadı');
    }
  }
}

/** '15m' / '1h' / '7d' -> saniye. */
function parseDurationSeconds(s: string): number {
  const match = /^(\d+)([smhd])$/.exec(s.trim());
  if (!match) return 900;
  const num = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's':
      return num;
    case 'm':
      return num * 60;
    case 'h':
      return num * 3600;
    case 'd':
      return num * 86400;
    default:
      return 900;
  }
}

/** SHA-256 hex hash — refresh token'ı DB'de hash'lemek için. */
export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
