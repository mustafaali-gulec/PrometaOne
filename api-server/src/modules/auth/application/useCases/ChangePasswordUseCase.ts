/**
 * ChangePasswordUseCase — kullanıcı kendi şifresini değiştirir.
 *
 * Akış:
 * 1. Mevcut hash'i çek
 * 2. currentPassword doğru mu — verify
 * 3. newPassword Password VO validation (domain)
 * 4. Yeni hash'i kaydet
 * 5. Tüm refresh session'ları revoke (güvenlik: eski oturumlar geçersiz)
 */
import { Password } from '../../domain/valueObjects/Password.js';
import type { PasswordHasher } from '../ports/PasswordHasher.js';
import type { RefreshSessionStore } from '../ports/RefreshSessionStore.js';
import type { UserRepository } from '../ports/UserRepository.js';
import {
  CurrentPasswordMismatchError,
  InvalidCredentialsError,
} from '../errors/AuthErrors.js';

export interface ChangePasswordUseCaseDeps {
  users: UserRepository;
  hasher: PasswordHasher;
  sessions: RefreshSessionStore;
}

export class ChangePasswordUseCase {
  constructor(private readonly deps: ChangePasswordUseCaseDeps) {}

  async execute(input: {
    userId: number;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const hash = await this.deps.users.findPasswordHashByUserId(input.userId);
    if (hash === null) throw new InvalidCredentialsError();

    const ok = await this.deps.hasher.verify(input.currentPassword, hash);
    if (!ok) throw new CurrentPasswordMismatchError();

    const newPassword = Password.create(input.newPassword);
    const newHash = await this.deps.hasher.hash(newPassword);

    await this.deps.users.updatePasswordHash(input.userId, newHash);

    // Güvenlik: şifre değiştiğinde tüm aktif oturumları geçersiz kıl.
    await this.deps.sessions.revokeAllForUser(input.userId);
  }
}
