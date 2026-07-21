/**
 * PushSender — port (interface).
 *
 * Concrete implementation'lar:
 *   infrastructure/webpush/WebPushSender.ts  (web-push + VAPID)
 *   infrastructure/webpush/NoopPushSender.ts (VAPID yapılandırılmamışsa)
 */
import type { PushDevice } from '../../domain/entities/PushDevice.js';

export interface PushPayload {
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, unknown>;
}

export interface PushSendResult {
  ok: boolean;
  /**
   * Abonelik kalıcı olarak geçersiz (HTTP 404/410) — çağıran cihazı
   * pasife almalıdır.
   */
  gone?: boolean;
  error?: string;
}

export interface PushSender {
  send(device: PushDevice, payload: PushPayload): Promise<PushSendResult>;
}
