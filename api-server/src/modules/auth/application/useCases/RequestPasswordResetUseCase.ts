/**
 * RequestPasswordResetUseCase — email ile şifre sıfırlama akışı başlatır.
 *
 * Güvenlik notu: email bulunmasa bile başarılı dönmeli (user enumeration
 * önlemi). Sadece email'i bilenler reset link'i alabilir.
 */
import crypto from 'node:crypto';

import type { Clock } from '../ports/Clock.js';
import type { PasswordResetEmailSender, SupportedLang } from '../ports/PasswordResetEmailSender.js';
import type { PasswordResetTokenStore } from '../ports/PasswordResetTokenStore.js';
import type { UserRepository } from '../ports/UserRepository.js';

export interface RequestPasswordResetUseCaseDeps {
  users: UserRepository;
  tokens: PasswordResetTokenStore;
  email: PasswordResetEmailSender;
  clock: Clock;
  /** Token TTL — dakika. */
  ttlMinutes: number;
  /** Reset URL şablonu, "{token}" placeholder ile. Yoksa email'de URL gönderilmez. */
  resetUrlTemplate?: string;
}

export class RequestPasswordResetUseCase {
  constructor(private readonly deps: RequestPasswordResetUseCaseDeps) {}

  async execute(input: {
    email: string;
    lang?: SupportedLang;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const user = await this.deps.users.findByEmail(input.email);

    // Önemli: kullanıcı yoksa bile sessizce başarılı dön (enumeration önlemi)
    if (!user || !user.active || user.email === null) return;

    const token = crypto.randomBytes(32).toString('hex');
    const now = this.deps.clock.now();
    const expiresAt = new Date(now.getTime() + this.deps.ttlMinutes * 60 * 1000);

    await this.deps.tokens.create({
      userId: user.id,
      token,
      expiresAt,
      ...(input.ip !== undefined ? { ip: input.ip } : {}),
      ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
    });

    const resetUrl =
      this.deps.resetUrlTemplate !== undefined
        ? this.deps.resetUrlTemplate.replace('{token}', encodeURIComponent(token))
        : undefined;

    await this.deps.email.send({
      to: user.email,
      fullName: user.fullName ?? user.username,
      token,
      expiresInMinutes: this.deps.ttlMinutes,
      ...(resetUrl !== undefined ? { resetUrl } : {}),
      ...(input.lang !== undefined ? { lang: input.lang } : {}),
    });
  }
}
