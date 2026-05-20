/**
 * Auth modülü — Public API.
 *
 * Faz 3 / PR 2: domain + ports + infrastructure.
 * Use-cases + DI composition sonraki PR'da.
 * Bu PR runtime'a hiç dokunmuyor — mevcut routes/auth.ts hala aktif.
 */

// Domain
export { User } from './domain/entities/User.js';
export type { UserProps } from './domain/entities/User.js';
export { Email, InvalidEmailError } from './domain/valueObjects/Email.js';
export { Password, WeakPasswordError } from './domain/valueObjects/Password.js';
export {
  isAtLeast,
  ALL_USER_ROLES,
  type UserRole,
} from './domain/valueObjects/UserRole.js';

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
export { systemClock, type Clock } from './application/ports/Clock.js';

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
