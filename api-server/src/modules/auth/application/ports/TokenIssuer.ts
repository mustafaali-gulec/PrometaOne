/**
 * TokenIssuer — JWT üretimi + doğrulama port'u.
 *
 * Concrete impl: infrastructure/jwt/JwtTokenIssuer.ts (yapılacak).
 * Test'te FakeTokenIssuer'la sabit token üretilir.
 */
import type { UserRole } from '../../domain/valueObjects/UserRole.js';

export interface AccessTokenPayload {
  sub: number;
  username: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  sub: number;
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token süresi (saniye). */
  accessTokenTtlSeconds: number;
  /** Refresh token jti (DB'ye kaydetmek için). */
  refreshTokenJti: string;
}

export interface TokenIssuer {
  /** Access + refresh token üretir, jti otomatik üretilir. */
  issue(payload: AccessTokenPayload): IssuedTokens;
  /** Sadece access token (refresh akışı). */
  issueAccessToken(payload: AccessTokenPayload): { token: string; ttlSeconds: number };
  /** Refresh token'ı doğrula, payload döndür. */
  verifyRefreshToken(token: string): RefreshTokenPayload;
}

export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

export class TokenExpiredError extends Error {
  constructor() {
    super('Token süresi doldu');
    this.name = 'TokenExpiredError';
  }
}
