/**
 * Push HTTP routes (Hono).
 *
 * Endpoint'ler:
 *   POST /v1/push/register-device    — cihaz kaydı (opsiyonel auth; token varsa kimliği ezer)
 *   POST /v1/push/unregister-device  — cihaz silme (opsiyonel auth)
 *   POST /v1/push/send               — push gönder (auth ZORUNLU)
 *   GET  /v1/push/public-key         — VAPID public key (guard'sız; licenseGuard yeter)
 *   GET  /v1/push/devices            — kendi aktif cihazları (auth)
 *   GET  /v1/push/devices/:username  — kullanıcının cihazları (auth; kendisi veya admin)
 *
 * Rate limit (in-memory): register/unregister 30/dk, send 60/dk (IP+username).
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { authMiddleware, optionalAuthMiddleware } from '../../../middleware/auth.js';
import { rateLimitMiddleware } from '../../../middleware/rateLimit.js';
import type { AuthContext } from '../../../types.js';
import type { PushDeviceRepository } from '../application/ports/PushDeviceRepository.js';
import { PushValidationError } from '../application/useCases/RegisterDevice.js';
import type { RegisterDeviceUseCase } from '../application/useCases/RegisterDevice.js';
import type { SendPushUseCase } from '../application/useCases/SendPush.js';
import type { UnregisterDevicesUseCase } from '../application/useCases/UnregisterDevices.js';
import type { PushDevice } from '../domain/entities/PushDevice.js';
import { PUSH_PLATFORMS, PUSH_PROVIDERS } from '../domain/entities/PushDevice.js';

// ---------------------------------------------------------------------------
// Şemalar
// ---------------------------------------------------------------------------

const keysSchema = z
  .object({
    p256dh: z.string().max(500),
    auth: z.string().max(500),
  })
  .partial();

const registerDeviceBase = z.object({
  id: z.string().max(100).optional(),
  // FE session.id sayı olabilir — string'e sabitle.
  userId: z.coerce.string().max(200).optional(),
  username: z.string().max(200).optional(),
  platform: z.enum(PUSH_PLATFORMS).default('web'),
  provider: z.enum(PUSH_PROVIDERS),
  endpoint: z.string().min(10).max(2000),
  keys: keysSchema.optional(),
  userAgent: z.string().max(1000).optional(),
  bundleId: z.string().max(300).optional(),
});

/**
 * username yalnız auth YOKSA zorunlu — zValidator auth context'ini göremediği
 * için şema istek başına kuruluyor (superRefine).
 */
function buildRegisterDeviceSchema(hasAuth: boolean) {
  return registerDeviceBase.superRefine((val, ctx) => {
    if (!hasAuth && (!val.username || val.username.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['username'],
        message: 'username zorunlu (Authorization token yoksa)',
      });
    }
    if (val.provider === 'web_push' && !val.endpoint.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endpoint'],
        message: "web_push endpoint'i https:// ile başlamalı",
      });
    }
  });
}

const unregisterDeviceSchema = z
  .object({
    username: z.string().max(200).optional(),
    provider: z.enum(PUSH_PROVIDERS).optional(),
    endpoint: z.string().min(10).max(2000).optional(),
  })
  .refine((val) => Boolean(val.endpoint) || Boolean(val.provider), {
    message: 'endpoint ya da provider zorunlu',
    path: ['provider'],
  });

const sendPushSchema = z.object({
  notification: z.object({
    title: z.string().min(1).max(200),
    body: z.string().max(1000).nullish(),
    link: z.string().max(2000).nullish(),
    data: z.record(z.unknown()).nullish(),
  }),
  devices: z
    .array(
      z.object({
        provider: z.enum(PUSH_PROVIDERS),
        endpoint: z.string().min(10).max(2000),
        keys: keysSchema.optional(),
      }),
    )
    .max(100)
    .optional(),
  username: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export interface PushRouterDeps {
  registerDevice: RegisterDeviceUseCase;
  unregisterDevices: UnregisterDevicesUseCase;
  sendPush: SendPushUseCase;
  deviceQuery: Pick<PushDeviceRepository, 'findActiveByUsername'>;
  /** VAPID public key — yoksa null (FE demo anahtara düşer). */
  vapidPublicKey: string | null;
}

function toDeviceDto(d: PushDevice) {
  return {
    id: d.id,
    userId: d.userId,
    username: d.username,
    platform: d.platform,
    provider: d.provider,
    endpoint: d.endpoint,
    keys: d.keys,
    userAgent: d.userAgent,
    bundleId: d.bundleId,
    registeredAt: d.registeredAt.toISOString(),
    lastUsedAt: d.lastUsedAt.toISOString(),
    active: d.active,
  };
}

export function createPushRouter(deps: PushRouterDeps): Hono {
  const router = new Hono();

  // --- VAPID public key (guard'sız — abonelik için gerekli, sır değil) ------
  router.get('/public-key', (c) => c.json({ publicKey: deps.vapidPublicKey ?? null }));

  // --- Cihaz kaydı -----------------------------------------------------------
  router.post(
    '/register-device',
    optionalAuthMiddleware,
    rateLimitMiddleware('push-register', 30),
    async (c) => {
      const auth = c.get('auth') as AuthContext | undefined;

      let raw: unknown;
      try {
        raw = await c.req.json();
      } catch {
        return c.json({ error: 'validation_error', message: 'Geçersiz JSON gövde' }, 400);
      }

      const parsed = buildRegisterDeviceSchema(auth !== undefined).safeParse(raw);
      if (!parsed.success) {
        return c.json(
          {
            error: 'validation_error',
            message: 'Geçersiz istek gövdesi',
            details: parsed.error.flatten(),
          },
          400,
        );
      }

      try {
        const result = await deps.registerDevice.execute({
          ...(auth ? { auth: { userId: auth.userId, username: auth.username } } : {}),
          body: parsed.data,
        });
        return c.json({ success: true, deviceId: result.deviceId });
      } catch (err: unknown) {
        if (err instanceof PushValidationError) {
          throw new HTTPException(400, { message: err.message });
        }
        throw err;
      }
    },
  );

  // --- Cihaz silme -----------------------------------------------------------
  router.post(
    '/unregister-device',
    optionalAuthMiddleware,
    rateLimitMiddleware('push-unregister', 30),
    zValidator('json', unregisterDeviceSchema),
    async (c) => {
      const auth = c.get('auth') as AuthContext | undefined;
      const body = c.req.valid('json');

      try {
        const result = await deps.unregisterDevices.execute({
          ...(auth ? { auth: { userId: auth.userId, username: auth.username } } : {}),
          body,
        });
        return c.json({ success: true, removed: result.removed });
      } catch (err: unknown) {
        if (err instanceof PushValidationError) {
          throw new HTTPException(400, { message: err.message });
        }
        throw err;
      }
    },
  );

  // --- Push gönder (auth zorunlu) --------------------------------------------
  router.post(
    '/send',
    authMiddleware,
    rateLimitMiddleware('push-send', 60),
    zValidator('json', sendPushSchema),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');

      const result = await deps.sendPush.execute({
        auth: { userId: auth.userId, username: auth.username },
        notification: {
          title: body.notification.title,
          ...(body.notification.body != null ? { body: body.notification.body } : {}),
          ...(body.notification.link != null ? { link: body.notification.link } : {}),
          ...(body.notification.data != null ? { data: body.notification.data } : {}),
        },
        ...(body.devices !== undefined ? { devices: body.devices } : {}),
        ...(body.username !== undefined ? { username: body.username } : {}),
      });

      return c.json(result);
    },
  );

  // --- Cihaz listeleme (auth) --------------------------------------------------
  router.get('/devices', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const devices = await deps.deviceQuery.findActiveByUsername(auth.username);
    return c.json({ devices: devices.map(toDeviceDto) });
  });

  router.get('/devices/:username', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const target = c.req.param('username');
    if (auth.username !== target && auth.role !== 'admin') {
      throw new HTTPException(403, { message: 'Yalnız kendi cihazlarınızı görebilirsiniz' });
    }
    const devices = await deps.deviceQuery.findActiveByUsername(target);
    return c.json({ devices: devices.map(toDeviceDto) });
  });

  return router;
}
