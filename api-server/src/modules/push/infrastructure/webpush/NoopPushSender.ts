/**
 * NoopPushSender — VAPID anahtarları yapılandırılmamışsa kullanılan PushSender.
 *
 * Boot asla patlamaz: cihaz KAYDI normal çalışır, GÖNDERİM loglanıp atlanır ve
 * dürüstçe ok:false döner (FE tarafında yalancı başarı görünmez).
 */
import type {
  PushPayload,
  PushSender,
  PushSendResult,
} from '../../application/ports/PushSender.js';
import type { PushDevice } from '../../domain/entities/PushDevice.js';

export interface NoopPushLogger {
  warn(msg: string): void;
}

export class NoopPushSender implements PushSender {
  private warned = false;

  constructor(private readonly logger: NoopPushLogger = console) {}

  send(device: PushDevice, payload: PushPayload): Promise<PushSendResult> {
    if (!this.warned) {
      this.warned = true;
      this.logger.warn(
        '[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY tanımlı değil — push gönderimi atlanıyor ' +
          '(cihaz kaydı çalışmaya devam eder).',
      );
    }
    this.logger.warn(
      `[push] atlandı (VAPID yok): ${device.provider} ${device.username} — "${payload.title}"`,
    );
    return Promise.resolve({
      ok: false,
      error: 'push yapılandırılmamış (VAPID anahtarları eksik)',
    });
  }
}
