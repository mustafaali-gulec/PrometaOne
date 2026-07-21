/**
 * NodemailerEmailService — EmailService port'unun nodemailer SMTP
 * implementasyonu.
 *
 * Transporter dışarıdan inject edilir (DI). Test'te `nodemailer.createTransport({ jsonTransport: true })` ile fake transport verilebilir.
 */
import type { Transporter } from 'nodemailer';

import type {
  EmailService,
  SendEmailRequest,
  SendEmailResult,
} from '../../application/ports/EmailService.js';

export interface NodemailerEmailServiceConfig {
  /** Gönderici adı + adresi. Örn: "Prometa One <noreply@prometa.local>" */
  from: string;
}

export class NodemailerEmailService implements EmailService {
  constructor(
    private readonly transporter: Transporter,
    private readonly cfg: NodemailerEmailServiceConfig,
  ) {}

  async send(req: SendEmailRequest): Promise<SendEmailResult> {
    const info: unknown = await this.transporter.sendMail({
      from: req.fromName ? overrideDisplayName(this.cfg.from, req.fromName) : this.cfg.from,
      to: req.to,
      subject: req.subject,
      ...(req.text !== undefined ? { text: req.text } : {}),
      html: req.html,
      ...(req.replyTo !== undefined ? { replyTo: req.replyTo } : {}),
    });

    const messageId =
      typeof info === 'object' && info !== null && 'messageId' in info
        ? (info as { messageId?: unknown }).messageId
        : undefined;
    return typeof messageId === 'string' ? { messageId } : {};
  }
}

/**
 * "Ad <adres>" biçimindeki from'un yalnız GÖRÜNEN ADINI değiştirir — adres
 * sabit kalır (SPF/DKIM hizası bozulmasın). Header injection'a karşı CR/LF ve
 * tırnak temizlenir.
 */
function overrideDisplayName(configuredFrom: string, fromName: string): string {
  const address = /<([^>]+)>/.exec(configuredFrom)?.[1] ?? configuredFrom;
  const safeName = fromName.replace(/[\r\n"<>]/g, ' ').trim();
  return safeName ? `"${safeName}" <${address}>` : configuredFrom;
}
