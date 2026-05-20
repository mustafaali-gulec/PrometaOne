/**
 * PasswordResetEmailSender — şifre sıfırlama email'i gönderir.
 *
 * notifications.EmailService'tan ayrı çünkü bu çok daha özel (template
 * + ayrı dil + ayrı bağlam). Concrete impl notifications'a delege
 * edebilir veya kendi yolunu kullanabilir.
 */

export type SupportedLang = 'tr' | 'en' | 'de' | 'ar';

export interface SendPasswordResetEmailInput {
  to: string;
  fullName: string;
  token: string;
  expiresInMinutes: number;
  resetUrl?: string | undefined;
  lang?: SupportedLang | undefined;
}

export interface PasswordResetEmailSenderResult {
  sent: boolean;
  /** Provider mesaj ID'si (varsa) - log / debug icin. */
  messageId?: string;
  /** Hata mesaji (sent === false ise). */
  error?: string;
}

export interface PasswordResetEmailSender {
  send(input: SendPasswordResetEmailInput): Promise<PasswordResetEmailSenderResult>;
}
