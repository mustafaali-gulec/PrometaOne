/**
 * RefreshTokenUseCase — refresh token ile yeni access token üretir.
 *
 * Akış:
 * 1. JWT signature + expire kontrolü (TokenIssuer.verifyRefreshToken)
 * 2. RefreshSessionStore.findActiveWithHash — DB'de aktif kayıt var mı,
 *    token hash eşleşiyor mu (security: DB sızsa bile token aktive olmaz)
 * 3. User'ı bul (sub'tan) — aktif değilse hata
 * 4. issueAccessToken — sadece yeni access (refresh aynı kalır rotation YOK
 *    bu PR'da; PR 4'te eklenebilir)
 */
import type { RefreshResponseDto } from '../dto/AuthDto.js';
import { AccountInactiveError, InvalidCredentialsError } from '../errors/AuthErrors.js';
import type { PasswordHasher as _UnusedHasher } from '../ports/PasswordHasher.js';
import type { RefreshSessionStore } from '../ports/RefreshSessionStore.js';
import type { TokenIssuer } from '../ports/TokenIssuer.js';
import type { UserRepository } from '../ports/UserRepository.js';

export interface RefreshTokenUseCaseDeps {
  tokens: TokenIssuer;
  sessions: RefreshSessionStore;
  users: UserRepository;
  sha256: (input: string) => string;
}

export class RefreshTokenUseCase {
  constructor(private readonly deps: RefreshTokenUseCaseDeps) {}

  async execute(input: { refreshToken: string }): Promise<RefreshResponseDto> {
    const payload = this.deps.tokens.verifyRefreshToken(input.refreshToken);

    const session = await this.deps.sessions.findActiveWithHash(
      payload.jti,
      this.deps.sha256(input.refreshToken),
    );
    if (!session) {
      throw new InvalidCredentialsError();
    }
    if (session.userId !== payload.sub) {
      throw new InvalidCredentialsError();
    }

    const user = await this.deps.users.findById(payload.sub);
    if (!user) throw new InvalidCredentialsError();
    if (!user.active) throw new AccountInactiveError();

    const issued = this.deps.tokens.issueAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return {
      accessToken: issued.token,
      expiresIn: issued.ttlSeconds,
    };
  }
}
