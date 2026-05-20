/**
 * VerifyPasswordResetTokenUseCase — reset token'ın UI tarafında
 * "açma" durumuyla görselleştirilebilmesi için var/yok/kullanılmış/expire bilgisi döner.
 *
 * Dönüş:
 *  - { valid: true }
 *  - { valid: false, reason: 'not_found' | 'used' | 'expired' }
 */
import type { Clock } from '../ports/Clock.js';
import type { PasswordResetTokenStore } from '../ports/PasswordResetTokenStore.js';

export type VerifyPasswordResetTokenResult =
  | { valid: true }
  | { valid: false; reason: 'not_found' | 'used' | 'expired' };

export interface VerifyPasswordResetTokenUseCaseDeps {
  tokens: PasswordResetTokenStore;
  clock: Clock;
}

export class VerifyPasswordResetTokenUseCase {
  constructor(private readonly deps: VerifyPasswordResetTokenUseCaseDeps) {}

  async execute(input: { token: string }): Promise<VerifyPasswordResetTokenResult> {
    const record = await this.deps.tokens.findByToken(input.token);
    if (!record) return { valid: false, reason: 'not_found' };
    if (record.usedAt !== null) return { valid: false, reason: 'used' };
    if (record.expiresAt.getTime() <= this.deps.clock.now().getTime()) {
      return { valid: false, reason: 'expired' };
    }
    return { valid: true };
  }
}
