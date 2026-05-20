/**
 * ResetPasswordUseCase — token ile yeni şifre belirler.
 *
 * Akış:
 * 1. Token aktif mi (kullanılmamış + expire değil)
 * 2. newPassword domain validation (Password VO)
 * 3. Hash + updatePasswordHash
 * 4. Token markUsed
 * 5. Tüm session'ları revoke
 */
import { Password } from '../../domain/valueObjects/Password.js';
import type { PasswordHasher } from '../ports/PasswordHasher.js';
import type { PasswordResetTokenStore } from '../ports/PasswordResetTokenStore.js';
import type { RefreshSessionStore } from '../ports/RefreshSessionStore.js';
import type { UserRepository } from '../ports/UserRepository.js';
import { InvalidPasswordResetTokenError } from '../errors/AuthErrors.js';

export interface ResetPasswordUseCaseDeps {
  users: UserRepository;
  tokens: PasswordResetTokenStore;
  sessions: RefreshSessionStore;
  hasher: PasswordHasher;
}

export class ResetPasswordUseCase {
  constructor(private readonly deps: ResetPasswordUseCaseDeps) {}

  async execute(input: { token: string; newPassword: string }): Promise<void> {
    const record = await this.deps.tokens.findActive(input.token);
    if (!record) throw new InvalidPasswordResetTokenError();

    const newPassword = Password.create(input.newPassword);
    const newHash = await this.deps.hasher.hash(newPassword);

    await this.deps.users.updatePasswordHash(record.userId, newHash);
    await this.deps.tokens.markUsed(input.token);
    await this.deps.sessions.revokeAllForUser(record.userId);
  }
}
