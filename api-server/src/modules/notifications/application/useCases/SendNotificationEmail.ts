/**
 * SendNotificationEmail — /v1/email/send'in use-case'i.
 *
 * Kurallar:
 *   1. meta.kind === 'test' → `to`, çağıranın KENDİ e-postası olmalı
 *      (users tablosundan username ile çözülür; eşleşmezse
 *      { success:false, error } — 403 değil).
 *   2. Aksi hâlde `to`, app_state_entities aynasındaki hrEmployees
 *      e-postalarından biri OLMALI — açık-relay engeli.
 *   3. Sonuç HER DURUMDA email_log'a yazılır (sent/failed).
 *   4. ASLA throw etmez → { success, messageId?, error? } döner.
 */
import type { Clock } from '../ports/Clock.js';
import type { EmailLogRepository } from '../ports/EmailLogRepository.js';
import type { EmailRecipientDirectory } from '../ports/EmailRecipientDirectory.js';
import type { EmailService } from '../ports/EmailService.js';
import type { IdGenerator } from '../ports/IdGenerator.js';

export interface SendNotificationEmailInput {
  to: string;
  subject: string;
  html?: string | undefined;
  text?: string | undefined;
  fromName?: string | undefined;
  replyTo?: string | undefined;
  meta?:
    | {
        kind?: string | undefined;
        recipientUserId?: string | undefined;
        notificationId?: string | undefined;
      }
    | undefined;
  /** Çağıranın kimliği (authMiddleware zorunlu → hep var). */
  sender: { userId: number; username: string };
}

export interface SendNotificationEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SendNotificationEmailConfig {
  /** SMTP gerçekten yapılandırılmış mı? Değilse dürüstçe success:false. */
  emailConfigured: boolean;
  /** email_log.provider değeri (örn. 'smtp'). */
  providerName: string;
}

export class SendNotificationEmailUseCase {
  constructor(
    private readonly email: EmailService,
    private readonly logRepo: EmailLogRepository,
    private readonly directory: EmailRecipientDirectory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly cfg: SendNotificationEmailConfig,
  ) {}

  async execute(input: SendNotificationEmailInput): Promise<SendNotificationEmailResult> {
    let result: SendNotificationEmailResult;

    try {
      result = await this.validateAndSend(input);
    } catch (err: unknown) {
      // Kural 4: asla throw yok — beklenmeyen hata da sonuca dönüşür.
      result = { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    await this.writeLog(input, result);
    return result;
  }

  private async validateAndSend(
    input: SendNotificationEmailInput,
  ): Promise<SendNotificationEmailResult> {
    // Kural 1: test e-postası yalnız çağıranın kendi adresine.
    if (input.meta?.kind === 'test') {
      const ownEmail = await this.directory.findUserEmailByUsername(input.sender.username);
      if (!ownEmail || ownEmail.toLowerCase() !== input.to.toLowerCase()) {
        return {
          success: false,
          error: 'Test e-postası yalnız kendi adresinize gönderilebilir',
        };
      }
    } else {
      // Kural 2: açık-relay engeli — alıcı kayıtlı bir çalışan e-postası olmalı.
      const known = await this.directory.isKnownEmployeeEmail(input.to);
      if (!known) {
        return {
          success: false,
          error: 'Alıcı adres sistemde kayıtlı bir çalışan e-postası değil',
        };
      }
    }

    if (!this.cfg.emailConfigured) {
      // Yalancı başarı yok: SMTP yoksa dürüstçe bildir.
      return { success: false, error: 'SMTP yapılandırılmamış (SMTP_HOST/USER/PASS eksik)' };
    }

    try {
      const sent = await this.email.send({
        to: input.to,
        subject: input.subject,
        html: input.html ?? textToHtml(input.text ?? ''),
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.fromName !== undefined ? { fromName: input.fromName } : {}),
        ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
      });
      return {
        success: true,
        ...(sent.messageId !== undefined ? { messageId: sent.messageId } : {}),
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async writeLog(
    input: SendNotificationEmailInput,
    result: SendNotificationEmailResult,
  ): Promise<void> {
    try {
      await this.logRepo.insert({
        id: this.ids.next(),
        toAddress: input.to,
        subject: input.subject,
        status: result.success ? 'sent' : 'failed',
        provider: this.cfg.emailConfigured ? this.cfg.providerName : null,
        messageId: result.messageId ?? null,
        error: result.error ?? null,
        kind: input.meta?.kind ?? null,
        recipientUserId: input.meta?.recipientUserId ?? null,
        notificationId: input.meta?.notificationId ?? null,
        senderUserId: String(input.sender.userId),
        meta: input.meta ? { ...input.meta } : null,
        createdAt: this.clock.now(),
      });
    } catch (err: unknown) {
      // Log yazımı gönderim sonucunu asla düşürmez.
      console.error('[email] email_log yazılamadı:', err);
    }
  }
}

/** html verilmemişse düz metinden basit, kaçışlı bir HTML gövde üret. */
function textToHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<pre style="font-family:inherit;white-space:pre-wrap">${escaped}</pre>`;
}
