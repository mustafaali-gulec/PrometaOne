/**
 * RequestPasswordResetUseCase — sifre sifirlama akisini baslatir.
 *
 * Akis:
 *  1. emailOrUsername ile user bul (kullanici adi VEYA email)
 *  2. user yoksa / pasifse / email'i yoksa -> sessizce null (enumeration korumasi)
 *  3. Eski kullanilmamis token'lari revoke
 *  4. Yeni token uret (deps.generateToken — default crypto.randomBytes(32) hex)
 *  5. tokens.create + email.send
 *  6. Email gonderildiyse tokens.markEmailSent
 *
 * Donus:
 *  - null  -> user yoksa veya gonderilemez ise (presentation katmani yine 200 donmeli)
 *  - { token, emailSent } -> islem yapildi; presentation dev/test modunda token'i
 *    response'a koyabilir, prod'da gizler.
 */
import crypto from 'node:crypto';

import type { Clock } from '../ports/Clock.js';
import type {
  PasswordResetEmailSender,
  SupportedLang,
} from '../ports/PasswordResetEmailSender.js';
import type { PasswordResetTokenStore } from '../ports/PasswordResetTokenStore.js';
import type { UserRepository } from '../ports/UserRepository.js';

export interface RequestPasswordResetUseCaseDeps {
  users: UserRepository;
  tokens: PasswordResetTokenStore;
  email: PasswordResetEmailSender;
  clock: Clock;
  /** Token TTL — dakika. */
  ttlMinutes: number;
  /** Reset URL sablonu, "{token}" placeholder ile. Yoksa email'de URL gonderilmez. */
  resetUrlTemplate?: string;
  /**
   * Token uretici. Default: crypto.randomBytes(32).toString('hex') (64 karakterlik hex).
   * Test'lerde sabit token uretmek veya custom format (orn. 6-haneli kod) icin override.
   */
  generateToken?: () => string;
}

export interface RequestPasswordResetResult {
  token: string;
  emailSent: boolean;
}

export class RequestPasswordResetUseCase {
  constructor(private readonly deps: RequestPasswordResetUseCaseDeps) {}

  async execute(input: {
    emailOrUsername: string;
    lang?: SupportedLang;
    ip?: string;
    userAgent?: string;
  }): Promise<RequestPasswordResetResult | null> {
    const user = await this.deps.users.findByEmailOrUsername(input.emailOrUsername);

    // Onemli: kullanici yoksa bile sessizce null don (enumeration onlemi).
    // Presentation katmani yine 200 OK donmeli.
    if (!user || !user.active || user.email === null) return null;

    // Eski kullanilmamis token'lari temizle — ayni user icin tek aktif token kurali.
    await this.deps.tokens.revokeUnusedForUser(user.id);

    const token = this.deps.generateToken
      ? this.deps.generateToken()
      : crypto.randomBytes(32).toString('hex');

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

    const result = await this.deps.email.send({
      to: user.email,
      fullName: user.fullName ?? user.username,
      token,
      expiresInMinutes: this.deps.ttlMinutes,
      ...(resetUrl !== undefined ? { resetUrl } : {}),
      ...(input.lang !== undefined ? { lang: input.lang } : {}),
    });

    if (result.sent) {
      await this.deps.tokens.markEmailSent(token);
    }

    return { token, emailSent: result.sent };
  }
}
