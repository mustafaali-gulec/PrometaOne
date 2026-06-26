/**
 * Uygulama Durumu (AppState) HTTP route'ları.
 *
 * Tüm endpoint'ler authMiddleware ile korunur; HERHANGİ bir kimliği doğrulanmış
 * kullanıcı okuyup yazabilir (rol şartı YOK) — burası uygulamanın paylaşılan
 * durum kovasıdır ve RBAC eylem düzeyinde UI tarafında uygulanır. İş kuralı
 * yazmaz; use-case'leri çağırır, hata mapping errorMapping.ts'de.
 *
 * PUT gövdesi tüm uygulama blob'u olabilir (çok-MB) — value için küçük bir
 * boyut sınırı KONMAZ. Hono'nun varsayılan body limiti yoktur.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware } from '../../../middleware/auth.js';
import type {
  GetAppStateUseCase,
  SetAppStateUseCase,
} from '../application/useCases/AppStateUseCases.js';

import { mapAppStateError } from './errorMapping.js';

export interface AppStateRouterDeps {
  getAppState: GetAppStateUseCase;
  setAppState: SetAppStateUseCase;
}

const keyParam = z.object({ key: z.string().min(1).max(200) });
const scopeQuery = z.object({ scope: z.string().max(120).optional() });
const putBody = z.object({ value: z.unknown(), scope: z.string().max(120).optional() });

export function createAppStateRouter(deps: AppStateRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);

  const actorId = (c: { get: (k: string) => unknown }): number | null => {
    const auth = c.get('auth') as { userId?: number } | undefined;
    return auth?.userId ?? null;
  };

  // ===== APP STATE (key→JSONB) ============================================
  app.get('/:key', zValidator('param', keyParam), zValidator('query', scopeQuery), async (c) => {
    const { key } = c.req.valid('param');
    const { scope } = c.req.valid('query');
    try {
      const dto = await deps.getAppState.execute({
        key,
        ...(scope !== undefined ? { scope } : {}),
      });
      if (!dto) return c.json({ message: 'not found' }, 404);
      return c.json(dto);
    } catch (err) {
      mapAppStateError(err);
    }
  });

  app.put('/:key', zValidator('param', keyParam), zValidator('json', putBody), async (c) => {
    const { key } = c.req.valid('param');
    const b = c.req.valid('json');
    try {
      const result = await deps.setAppState.execute({
        key,
        value: b.value,
        actorUserId: actorId(c),
        ...(b.scope !== undefined ? { scope: b.scope } : {}),
      });
      return c.json(result);
    } catch (err) {
      mapAppStateError(err);
    }
  });

  return app;
}
