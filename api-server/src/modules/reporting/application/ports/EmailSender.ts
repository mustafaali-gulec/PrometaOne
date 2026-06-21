/**
 * EmailSender portu — zamanlanmış rapor e-postası (ek dosyalı).
 * Concrete: infrastructure/email/NodemailerEmailSender.ts (+ NoopEmailSender).
 * (notifications EmailService ile aynı felsefe; burada attachment desteği var.)
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailRequest {
  to: string; // virgülle ayrılmış alıcılar
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailSender {
  send(req: SendEmailRequest): Promise<void>;
}
