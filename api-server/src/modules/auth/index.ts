/**
 * Auth modülü — Public API.
 *
 * Faz 3 / PR 3: domain + ports + infrastructure + use-cases + errors.
 * DI composition + presentation routes sonraki PR'da (PR 4).
 *
 * Bu PR runtime'a hala dokunmuyor — routes/auth.ts aktif kalır.
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
export type {
  PasswordResetTokenRecord,
  PasswordResetTokenStore,
} from './application/ports/PasswordResetTokenStore.js';
export type {
  SendPasswordResetEmailInput,
  PasswordResetEmailSender,
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

// Use-cases
export {
  LoginUseCase,
  type LoginInput,
  type LoginUseCaseDeps,
} from './application/useCases/LoginUseCase.js';
export { LogoutUseCase } from './application/useCases/LogoutUseCase.js';
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
} from './application/useCases/RequestPasswordResetUseCase.js';
export {
  ResetPasswordUseCase,
  type ResetPasswordUseCaseDeps,
} from './application/useCases/ResetPasswordUseCase.js';

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
