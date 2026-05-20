/**
 * LogoutUseCase — refresh session'ı revoke eder.
 *
 * Access token zaten kısa süreli; sadece refresh'i geçersiz kılmak yeterli.
 */
import type { RefreshSessionStore } from '../ports/RefreshSessionStore.js';

export class LogoutUseCase {
  constructor(private readonly sessions: RefreshSessionStore) {}

  async execute(input: { refreshTokenJti: string }): Promise<void> {
    await this.sessions.revoke(input.refreshTokenJti);
  }
}
