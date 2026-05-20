/**
 * LogoutAllSessionsUseCase — bir kullanıcının TÜM refresh oturumlarını revoke eder.
 *
 * Eski `/logout` endpoint'inin davranışıyla uyumludur: kullanıcı login'le ulaşan
 * tüm cihazlar/oturumlar tek seferde geçersiz kılınır.
 */
import type { RefreshSessionStore } from '../ports/RefreshSessionStore.js';

export class LogoutAllSessionsUseCase {
  constructor(private readonly sessions: RefreshSessionStore) {}

  async execute(input: { userId: number }): Promise<void> {
    await this.sessions.revokeAllForUser(input.userId);
  }
}
