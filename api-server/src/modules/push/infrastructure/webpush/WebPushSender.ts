/**
 * WebPushSender — PushSender port'unun `web-push` (VAPID) implementasyonu.
 *
 * Yalnız provider='web_push' cihazlara gönderir; fcm/apn kayıt olarak
 * desteklenir ama gönderim sağlayıcısı henüz bağlı değildir (ok:false döner).
 * VAPID detayları global state yerine ÇAĞRI BAŞINA verilir — geçersiz anahtar
 * boot'u değil yalnız ilgili gönderimi düşürür.
 */
import webpush from 'web-push';

import type {
  PushPayload,
  PushSender,
  PushSendResult,
} from '../../application/ports/PushSender.js';
import type { PushDevice } from '../../domain/entities/PushDevice.js';

export interface WebPushSenderConfig {
  publicKey: string;
  privateKey: string;
  /** 'mailto:...' veya https URL (VAPID sub claim). */
  subject: string;
}

export class WebPushSender implements PushSender {
  constructor(private readonly cfg: WebPushSenderConfig) {}

  async send(device: PushDevice, payload: PushPayload): Promise<PushSendResult> {
    if (device.provider !== 'web_push') {
      return { ok: false, error: `provider '${device.provider}' için gönderim henüz bağlı değil` };
    }
    if (!device.keys?.p256dh || !device.keys.auth) {
      return { ok: false, error: 'cihaz kaydında p256dh/auth anahtarları eksik' };
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: device.endpoint,
          keys: { p256dh: device.keys.p256dh, auth: device.keys.auth },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body ?? '',
          link: payload.link ?? null,
          data: payload.data ?? null,
        }),
        {
          vapidDetails: {
            subject: this.cfg.subject,
            publicKey: this.cfg.publicKey,
            privateKey: this.cfg.privateKey,
          },
          TTL: 60 * 60 * 24, // 24 saat
        },
      );
      return { ok: true };
    } catch (err: unknown) {
      const statusCode =
        typeof err === 'object' && err !== null && 'statusCode' in err
          ? Number(err.statusCode)
          : undefined;
      if (statusCode === 404 || statusCode === 410) {
        return { ok: false, gone: true, error: `abonelik geçersiz (http-${statusCode})` };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }
}
