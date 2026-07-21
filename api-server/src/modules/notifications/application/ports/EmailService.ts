/**
 * EmailService — port (interface).
 *
 * Concrete implementation infrastructure/email/NodemailerEmailService.ts.
 *
 * GERİYE UYUMLU genişletme (/v1/email/send için):
 *   - text artık opsiyonel; fromName/replyTo eklendi.
 *   - send() SMTP Message-ID döndürür ({ messageId? }) — mevcut çağıranlar
 *     dönüşü yok saydığı için kırılmaz.
 */

export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Görünen gönderici adı — adres cfg.from'daki adres kalır. */
  fromName?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  /** SMTP sunucusunun döndürdüğü Message-ID (varsa). */
  messageId?: string;
}

export interface EmailService {
  send(req: SendEmailRequest): Promise<SendEmailResult>;
}
