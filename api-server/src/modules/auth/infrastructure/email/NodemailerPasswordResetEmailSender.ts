/**
 * NodemailerPasswordResetEmailSender — PasswordResetEmailSender port'unun
 * mevcut services/mailer.ts (nodemailer) backend'iyle implementasyonu.
 *
 * services/mailer içindeki buildPasswordResetEmail (4 dilli template) + sendMail
 * kullanılır; module dış'a HTTP/SMTP detayı sızmaz.
 */
import { buildPasswordResetEmail, sendMail } from '../../../../services/mailer.js';
import type {
  PasswordResetEmailSender,
  PasswordResetEmailSenderResult,
  SendPasswordResetEmailInput,
} from '../../application/ports/PasswordResetEmailSender.js';

export class NodemailerPasswordResetEmailSender implements PasswordResetEmailSender {
  async send(input: SendPasswordResetEmailInput): Promise<PasswordResetEmailSenderResult> {
    const mailContent = buildPasswordResetEmail({
      fullName: input.fullName,
      token: input.token,
      expiresInMinutes: input.expiresInMinutes,
      ...(input.lang !== undefined ? { lang: input.lang } : {}),
      ...(input.resetUrl !== undefined ? { resetUrl: input.resetUrl } : {}),
    });

    const result = await sendMail({
      to: input.to,
      subject: mailContent.subject,
      html: mailContent.html,
      text: mailContent.text,
    });

    const out: PasswordResetEmailSenderResult = { sent: result.success };
    if (result.messageId !== undefined) out.messageId = result.messageId;
    if (result.error !== undefined) out.error = result.error;
    return out;
  }
}
