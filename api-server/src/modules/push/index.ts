/**
 * Push modülü — Public API + DI composition root.
 *
 * registerPushModule(pool) PgPushDeviceRepository + use-case'leri + PushSender'ı
 * wire eder ve { router } döndürür. api-server/src/index.ts bunu `/v1/push`
 * altına mount eder.
 *
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT env'leri yoksa
 * NoopPushSender kullanılır: boot ASLA patlamaz — cihaz kaydı çalışır,
 * gönderim loglanıp atlanır.
 */
import type { Hono } from 'hono';
import type { Pool } from 'pg';

import { config } from '../../config.js';

import {
  RegisterDeviceUseCase,
  PushValidationError,
} from './application/useCases/RegisterDevice.js';
import { SendPushUseCase } from './application/useCases/SendPush.js';
import { UnregisterDevicesUseCase } from './application/useCases/UnregisterDevices.js';
import { PgPushDeviceRepository } from './infrastructure/persistence/PgPushDeviceRepository.js';
import { NoopPushSender } from './infrastructure/webpush/NoopPushSender.js';
import { WebPushSender } from './infrastructure/webpush/WebPushSender.js';
import { createPushRouter } from './presentation/routes.js';

// ===========================================================================
// Public API re-exports
// ===========================================================================
export type {
  PushDevice,
  PushKeys,
  PushPlatform,
  PushProvider,
} from './domain/entities/PushDevice.js';
export type {
  PushDeviceRepository,
  UpsertDeviceInput,
} from './application/ports/PushDeviceRepository.js';
export type { PushPayload, PushSender, PushSendResult } from './application/ports/PushSender.js';
export { RegisterDeviceUseCase, UnregisterDevicesUseCase, SendPushUseCase, PushValidationError };

export interface RegisteredPushModule {
  router: Hono;
}

export function registerPushModule(pool: Pool): RegisteredPushModule {
  // 1. Infrastructure binding
  const repo = new PgPushDeviceRepository(pool);

  const vapidPublicKey = config.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = config.VAPID_PRIVATE_KEY;
  const sender =
    vapidPublicKey && vapidPrivateKey
      ? new WebPushSender({
          publicKey: vapidPublicKey,
          privateKey: vapidPrivateKey,
          subject: config.VAPID_SUBJECT ?? 'mailto:noreply@prometa.local',
        })
      : new NoopPushSender();

  // 2. Use-cases
  const registerDevice = new RegisterDeviceUseCase(repo);
  const unregisterDevices = new UnregisterDevicesUseCase(repo);
  const sendPush = new SendPushUseCase(repo, sender);

  // 3. Presentation
  const router = createPushRouter({
    registerDevice,
    unregisterDevices,
    sendPush,
    deviceQuery: repo,
    vapidPublicKey: vapidPublicKey ?? null,
  });

  return { router };
}
