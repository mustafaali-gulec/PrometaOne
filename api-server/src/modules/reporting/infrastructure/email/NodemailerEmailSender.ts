/**
 * EmailSender implementasyonları.
 *   - NodemailerEmailSender: SMTP üzerinden ek dosyalı e-posta.
 *   - NoopEmailSender: SMTP konfigüre değilken (dev) — konsola loglar, göndermez.
 */
import nodemailer, { type Transporter } from 'nodemailer';

import type { EmailSender, SendEmailRequest } from '../../application/ports/EmailSender.js';

export class NodemailerEmailSender implements EmailSender {
  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
  ) {}

  async send(req: SendEmailRequest): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: req.to,
      subject: req.subject,
      text: req.text,
      ...(req.html ? { html: req.html } : {}),
      ...(req.attachments
        ? {
            attachments: req.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              ...(a.contentType ? { contentType: a.contentType } : {}),
            })),
          }
        : {}),
    });
  }
}

export class NoopEmailSender implements EmailSender {
  send(req: SendEmailRequest): Promise<void> {
    console.warn(
      `[reporting] (no-op email — SMTP yok) → ${req.to} | "${req.subject}" | ek: ${req.attachments?.length ?? 0}`,
    );
    return Promise.resolve();
  }
}

export interface EmailSenderConfig {
  smtpHost?: string | undefined;
  smtpPort?: number | undefined;
  smtpSecure?: boolean;
  smtpUser?: string | undefined;
  smtpPass?: string | undefined;
  emailFrom: string;
}

/** SMTP konfigüre ise Nodemailer, değilse Noop döner. (notifications deseni.) */
export function buildEmailSender(cfg: EmailSenderConfig): EmailSender {
  if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) {
    return new NoopEmailSender();
  }
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort ?? 587,
    secure: cfg.smtpSecure ?? false,
    auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });
  return new NodemailerEmailSender(transporter, cfg.emailFrom);
}
