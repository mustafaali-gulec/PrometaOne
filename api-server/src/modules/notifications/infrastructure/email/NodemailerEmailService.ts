/**
 * NodemailerEmailService — EmailService port'unun nodemailer SMTP
 * implementasyonu.
 *
 * Transporter dışarıdan inject edilir (DI). Test'te `nodemailer.createTransport({ jsonTransport: true })` ile fake transport verilebilir.
 */
import type { Transporter } from 'nodemailer';

import type { EmailService, SendEmailRequest } from '../../application/ports/EmailService.js';

export interface NodemailerEmailServiceConfig {
  /** Gönderici adı + adresi. Örn: "Prometa One <noreply@prometa.local>" */
  from: string;
}

export class NodemailerEmailService implements EmailService {
  constructor(
    private readonly transporter: Transporter,
    private readonly cfg: NodemailerEmailServiceConfig,
  ) {}

  async send(req: SendEmailRequest): Promise<void> {
    await this.transporter.sendMail({
      from: this.cfg.from,
      to: req.to,
      subject: req.subject,
      text: req.text,
      html: req.html,
    });
  }
}
