/**
 * LoginUseCase — kullanıcı adı + şifre ile login.
 *
 * Akış:
 * 1. UserRepository.findByUsername
 * 2. user yoksa veya pasifse → InvalidCredentials / AccountInactive
 * 3. PasswordHasher.verify
 * 4. TokenIssuer.issue (access + refresh + jti)
 * 5. RefreshSessionStore.create (token hash)
 * 6. user.recordLogin → save
 * 7. DTO döner
 */
import type { Clock } from '../ports/Clock.js';
import type { PasswordHasher } from '../ports/PasswordHasher.js';
import type { RefreshSessionStore } from '../ports/RefreshSessionStore.js';
import type { TokenIssuer } from '../ports/TokenIssuer.js';
import type { UserRepository } from '../ports/UserRepository.js';
import {
  AccountInactiveError,
  InvalidCredentialsError,
} from '../errors/AuthErrors.js';
import { toPublicUserDto, type LoginResponseDto } from '../dto/AuthDto.js';

export interface LoginInput {
  username: string;
  password: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface LoginUseCaseDeps {
  users: UserRepository;
  hasher: PasswordHasher;
  tokens: TokenIssuer;
  sessions: RefreshSessionStore;
  clock: Clock;
  /** SHA-256 hex hash helper (refresh token store için). */
  sha256: (input: string) => string;
  /** Refresh token TTL (saniye) — sessions.expiresAt için. */
  refreshTokenTtlSeconds: number;
}

export class LoginUseCase {
  constructor(private readonly deps: LoginUseCaseDeps) {}

  async execute(input: LoginInput): Promise<LoginResponseDto> {
    const user = await this.deps.users.findByUsername(input.username);
    if (!user) throw new InvalidCredentialsError();
    if (!user.active) throw new AccountInactiveError();

    const hash = await this.deps.users.findPasswordHashByUserId(user.id);
    if (hash === null) throw new InvalidCredentialsError();

    const ok = await this.deps.hasher.verify(input.password, hash);
    if (!ok) throw new InvalidCredentialsError();

    const issued = this.deps.tokens.issue({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    const now = this.deps.clock.now();
    const expiresAt = new Date(now.getTime() + this.deps.refreshTokenTtlSeconds * 1000);

    await this.deps.sessions.create({
      jti: issued.refreshTokenJti,
      userId: user.id,
      refreshTokenHash: this.deps.sha256(issued.refreshToken),
      ...(input.ip !== undefined ? { ip: input.ip } : {}),
      ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
      expiresAt,
    });

    const updated = user.recordLogin(now);
    await this.deps.users.save(updated);

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      expiresIn: issued.accessTokenTtlSeconds,
      user: toPublicUserDto(updated.toJSON()),
    };
  }
}
