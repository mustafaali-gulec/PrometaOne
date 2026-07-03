/**
 * Lisanslama HTTP route'ları — /v1/license.
 *
 * GET /status PUBLIC'tir (auth YOK): frontend lisans yokken/girriş öncesi de
 * durumu gösterebilsin. Kalan endpoint'ler authMiddleware + requireRole('admin')
 * ister. İş kuralı yazmaz; LicenseService/PgLicenseStore'u çağırır.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../../middleware/auth.js';
import type { LicenseService } from '../application/LicenseService.js';
import type { PgLicenseStore } from '../infrastructure/persistence/PgLicenseStore.js';

export interface LicensingRouterDeps {
  service: LicenseService;
  store: PgLicenseStore;
  /** Bu makinenin donanım kimliği (config.PROMETA_FINGERPRINT). */
  machineFingerprint: string | null;
}

const activateBody = z.object({
  license: z.union([z.string().min(1), z.record(z.unknown())]),
});

const terminalParam = z.object({ id: z.string().uuid() });

export function createLicensingRouter(deps: LicensingRouterDeps): Hono {
  const app = new Hono();

  // ===== PUBLIC ============================================================
  // Lisans durumu — login ekranı / kurulum sihirbazı auth'suz sorgular.
  app.get('/status', async (c) => {
    const status = await deps.service.getStatus();
    return c.json(status);
  });

  // ===== ADMIN =============================================================
  const admin = new Hono();
  admin.use('*', authMiddleware, requireRole('admin'));

  // Lisans aktivasyonu — { license: <dosya içeriği string|obje> }
  admin.post('/activate', zValidator('json', activateBody), async (c) => {
    const { license } = c.req.valid('json');
    const auth = c.get('auth');
    const result = await deps.service.activate(license, auth?.username ?? null);
    if (!result.ok) {
      return c.json(
        {
          error: 'license_invalid',
          reason: result.verification.reason,
          message: 'Lisans doğrulanamadı — dosya bozuk, süresi geçmiş veya bu makineye ait değil.',
        },
        400,
      );
    }
    return c.json({ ok: true, status: await deps.service.getStatus() });
  });

  // Kayıtlı terminaller (koltuklar)
  admin.get('/terminals', async (c) => {
    const terminals = await deps.store.listTerminals();
    return c.json({ terminals });
  });

  // Koltuk boşaltma — terminal kaydını sil
  admin.delete('/terminals/:id', zValidator('param', terminalParam), async (c) => {
    const { id } = c.req.valid('param');
    const deleted = await deps.store.deleteTerminal(id.toLowerCase());
    if (!deleted) return c.json({ error: 'not_found', message: 'Terminal bulunamadı' }, 404);
    return c.json({ ok: true });
  });

  // Bu makinenin donanım kimliği — lisans talebinde müşteri bunu gönderir
  admin.get('/fingerprint', (c) => {
    return c.json({ fingerprint: deps.machineFingerprint });
  });

  app.route('/', admin);
  return app;
}
