/**
 * Auth modulu — Public API.
 *
 * Faz 3 / PR 4: DI composition root (registerAuthModule) + presentation routes.
 * Eski services/auth.ts + routes/auth.ts kaldirildi; runtime davranis ayni.
 *
 * Dis dunyaya acilan tek arayuz BURASIDIR. Use-case'leri direkt import etmek
 * ESLint kuraliyla yasak (internal'a dokunma).
 */
import type { Hono } from 'hono';
import type { Pool } from 'pg';

import { systemClock, type Clock } from './application/ports/Clock.js';
import { ChangePasswordUseCase } from './application/useCases/ChangePasswordUseCase.js';
import { GetCurrentUserUseCase } from './application/useCases/GetCurrentUserUseCase.js';
import { LoginUseCase } from './application/useCases/LoginUseCase.js';
import { LogoutAllSessionsUseCase } from './application/useCases/LogoutAllSessionsUseCase.js';
import { LogoutUseCase } from './application/useCases/LogoutUseCase.js';
import { RefreshTokenUseCase } from './application/useCases/RefreshTokenUseCase.js';
import { RequestPasswordResetUseCase } from './application/useCases/RequestPasswordResetUseCase.js';
import { ResetPasswordUseCase } from './application/useCases/ResetPasswordUseCase.js';
import { VerifyPasswordResetTokenUseCase } from './application/useCases/VerifyPasswordResetTokenUseCase.js';
import { BcryptPasswordHasher } from './infrastructure/bcrypt/BcryptPasswordHasher.js';
import { NodemailerPasswordResetEmailSender } from './infrastructure/email/NodemailerPasswordResetEmailSender.js';
import { JwtTokenIssuer, sha256Hex } from './infrastructure/jwt/JwtTokenIssuer.js';
import { PgPasswordResetTokenStore } from './infrastructure/persistence/PgPasswordResetTokenStore.js';
import { PgRefreshSessionStore } from './infrastructure/persistence/PgRefreshSessionStore.js';
import { PgUserRepository } from './infrastructure/persistence/PgUserRepository.js';
import { createAuthRouter } from './presentation/routes.js';

// ============================================================================
// Public re-exports — diger moduller buradan import eder.
// ============================================================================

// Domain
export { User } from './domain/entities/User.js';
export type { UserProps } from './domain/entities/User.js';
export { Email, InvalidEmailError } from './domain/valueObjects/Email.js';
export { Password, WeakPasswordError } from './domain/valueObjects/Password.js';
export { isAtLeast, ALL_USER_ROLES, type UserRole } from './domain/valueObjects/UserRole.js';

// Application Ports
export type { PasswordHasher } from './application/ports/PasswordHasher.js';
export type { UserRepository } from './application/ports/UserRepository.js';
export {
  InvalidTokenError,
  TokenExpiredError,
  type AccessTokenPayload,
  type RefreshTokenPayload,
  type IssuedTokens,
  type TokenIssuer,
} from './application/ports/TokenIssuer.js';
export type {
  RefreshSession,
  CreateRefreshSessionInput,
  RefreshSessionStore,
} from './application/ports/RefreshSessionStore.js';
export type {
  PasswordResetTokenRecord,
  PasswordResetTokenStore,
} from './application/ports/PasswordResetTokenStore.js';
export type {
  SendPasswordResetEmailInput,
  PasswordResetEmailSender,
  PasswordResetEmailSenderResult,
  SupportedLang,
} from './application/ports/PasswordResetEmailSender.js';
export { systemClock, type Clock } from './application/ports/Clock.js';

// Errors
export {
  InvalidCredentialsError,
  AccountInactiveError,
  CurrentPasswordMismatchError,
  InvalidPasswordResetTokenError,
  UserNotFoundError,
} from './application/errors/AuthErrors.js';

// DTOs
export {
  toPublicUserDto,
  type PublicUserDto,
  type LoginResponseDto,
  type RefreshResponseDto,
} from './application/dto/AuthDto.js';

// Use-cases (test/edge'den erisim icin)
export {
  LoginUseCase,
  type LoginInput,
  type LoginUseCaseDeps,
} from './application/useCases/LoginUseCase.js';
export { LogoutUseCase } from './application/useCases/LogoutUseCase.js';
export { LogoutAllSessionsUseCase } from './application/useCases/LogoutAllSessionsUseCase.js';
export {
  RefreshTokenUseCase,
  type RefreshTokenUseCaseDeps,
} from './application/useCases/RefreshTokenUseCase.js';
export { GetCurrentUserUseCase } from './application/useCases/GetCurrentUserUseCase.js';
export {
  ChangePasswordUseCase,
  type ChangePasswordUseCaseDeps,
} from './application/useCases/ChangePasswordUseCase.js';
export {
  RequestPasswordResetUseCase,
  type RequestPasswordResetUseCaseDeps,
  type RequestPasswordResetResult,
} from './application/useCases/RequestPasswordResetUseCase.js';
export {
  ResetPasswordUseCase,
  type ResetPasswordUseCaseDeps,
} from './application/useCases/ResetPasswordUseCase.js';
export {
  VerifyPasswordResetTokenUseCase,
  type VerifyPasswordResetTokenResult,
} from './application/useCases/VerifyPasswordResetTokenUseCase.js';

// Infrastructure (concrete impl'ler)
export {
  BcryptPasswordHasher,
  type BcryptPasswordHasherConfig,
} from './infrastructure/bcrypt/BcryptPasswordHasher.js';
export {
  JwtTokenIssuer,
  type JwtTokenIssuerConfig,
  sha256Hex,
} from './infrastructure/jwt/JwtTokenIssuer.js';
export { PgUserRepository } from './infrastructure/persistence/PgUserRepository.js';
export { PgRefreshSessionStore } from './infrastructure/persistence/PgRefreshSessionStore.js';
export { PgPasswordResetTokenStore } from './infrastructure/persistence/PgPasswordResetTokenStore.js';
export { NodemailerPasswordResetEmailSender } from './infrastructure/email/NodemailerPasswordResetEmailSender.js';

// Router (composition root tarafindan sunulur)
export { createAuthRouter, type AuthRouterDeps } from './presentation/routes.js';

// ============================================================================
// DI Composition Root
// ============================================================================

export interface AuthModuleConfig {
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpires: string;
    refreshExpires: string;
    issuer: string;
  };
  bcrypt: {
    rounds: number;
  };
  passwordReset: {
    ttlMinutes: number;
    resetUrlTemplate?: string;
  };
  exposeDevTokens: boolean;
}

export interface AuthModuleDeps {
  pool: Pool;
  clock?: Clock;
}

export interface AuthModule {
  router: Hono;
  useCases: {
    login: LoginUseCase;
    refreshToken: RefreshTokenUseCase;
    logout: LogoutUseCase;
    logoutAllSessions: LogoutAllSessionsUseCase;
    getCurrentUser: GetCurrentUserUseCase;
    changePassword: ChangePasswordUseCase;
    requestPasswordReset: RequestPasswordResetUseCase;
    resetPassword: ResetPasswordUseCase;
    verifyPasswordResetToken: VerifyPasswordResetTokenUseCase;
  };
}

export function registerAuthModule(cfg: AuthModuleConfig, deps: AuthModuleDeps): AuthModule {
  const clock = deps.clock ?? systemClock;

  const users = new PgUserRepository(deps.pool);
  const sessions = new PgRefreshSessionStore(deps.pool);
  const passwordResetTokens = new PgPasswordResetTokenStore(deps.pool);
  const hasher = new BcryptPasswordHasher({ rounds: cfg.bcrypt.rounds });
  const tokens = new JwtTokenIssuer({
    accessSecret: cfg.jwt.accessSecret,
    refreshSecret: cfg.jwt.refreshSecret,
    accessExpires: cfg.jwt.accessExpires,
    refreshExpires: cfg.jwt.refreshExpires,
    issuer: cfg.jwt.issuer,
  });
  const emailSender = new NodemailerPasswordResetEmailSender();

  const refreshTokenTtlSeconds = parseDurationSeconds(cfg.jwt.refreshExpires);

  const login = new LoginUseCase({
    users,
    hasher,
    tokens,
    sessions,
    clock,
    sha256: sha256Hex,
    refreshTokenTtlSeconds,
  });

  const refreshToken = new RefreshTokenUseCase({
    tokens,
    sessions,
    users,
    sha256: sha256Hex,
  });

  const logout = new LogoutUseCase(sessions);
  const logoutAllSessions = new LogoutAllSessionsUseCase(sessions);
  const getCurrentUser = new GetCurrentUserUseCase(users);

  const changePassword = new ChangePasswordUseCase({
    users,
    hasher,
    sessions,
  });

  const requestPasswordReset = new RequestPasswordResetUseCase({
    users,
    tokens: passwordResetTokens,
    email: emailSender,
    clock,
    ttlMinutes: cfg.passwordReset.ttlMinutes,
    generateToken: () => String(Math.floor(100000 + Math.random() * 900000)),
    ...(cfg.passwordReset.resetUrlTemplate !== undefined
      ? { resetUrlTemplate: cfg.passwordReset.resetUrlTemplate }
      : {}),
  });

  const resetPassword = new ResetPasswordUseCase({
    users,
    tokens: passwordResetTokens,
    sessions,
    hasher,
  });

  const verifyPasswordResetToken = new VerifyPasswordResetTokenUseCase({
    tokens: passwordResetTokens,
    clock,
  });

  const router = createAuthRouter({
    loginUseCase: login,
    refreshTokenUseCase: refreshToken,
    logoutAllSessionsUseCase: logoutAllSessions,
    getCurrentUserUseCase: getCurrentUser,
    changePasswordUseCase: changePassword,
    requestPasswordResetUseCase: requestPasswordReset,
    resetPasswordUseCase: resetPassword,
    verifyPasswordResetTokenUseCase: verifyPasswordResetToken,
    exposeDevTokens: cfg.exposeDevTokens,
  });

  return {
    router,
    useCases: {
      login,
      refreshToken,
      logout,
      logoutAllSessions,
      getCurrentUser,
      changePassword,
      requestPasswordReset,
      resetPassword,
      verifyPasswordResetToken,
    },
  };
}

function parseDurationSeconds(s: string): number {
  const match = /^(\d+)([smhd])$/.exec(s.trim());
  if (!match) return 7 * 86400;
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
      return 7 * 86400;
  }
}
