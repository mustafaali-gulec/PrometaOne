/**
 * Auth modülü — Public API.
 *
 * Faz 3 / PR 1: sadece domain + ports. Use-case + infrastructure +
 * presentation sonraki PR'larda.
 *
 * Bu PR runtime'a hiç dokunmaz — mevcut routes/auth.ts hala aktif.
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
  RefreshSessionStore,
} from './application/ports/RefreshSessionStore.js';
export { systemClock, type Clock } from './application/ports/Clock.js';
