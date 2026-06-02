/**
 * Notifications HTTP routes (Hono).
 *
 * Endpoint'ler:
 *   GET  /v1/notifications              — kullanıcının bildirimleri (limit, unreadOnly)
 *   GET  /v1/notifications/unread-count — sadece sayı
 *   POST /v1/notifications/:id/read     — okundu işaretle
 *
 * Tümü auth gerektirir. recipientUserId context'teki auth.userId'den gelir.
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { authMiddleware } from '../../../middleware/auth.js';
import type { CreateNotificationUseCase } from '../application/useCases/CreateNotification.js';
import type { FetchNotificationsForUserUseCase } from '../application/useCases/FetchNotificationsForUser.js';
import {
  NotificationForbiddenError,
  NotificationNotFoundError,
} from '../application/useCases/MarkNotificationAsRead.js';
import type { MarkNotificationAsReadUseCase } from '../application/useCases/MarkNotificationAsRead.js';

export interface NotificationsRouterDeps {
  fetchUseCase: FetchNotificationsForUserUseCase;
  markAsReadUseCase: MarkNotificationAsReadUseCase;
  /** PR 2'de henüz endpoint olarak açılmaz; cron'ların kullanımı için DI'da tutuluyor. */
  createUseCase: CreateNotificationUseCase;
}

export function createNotificationsRouter(deps: NotificationsRouterDeps): Hono {
  const router = new Hono();

  router.use('*', authMiddleware);

  router.get('/', async (c) => {
    const auth = c.get('auth');
    const limitParam = c.req.query('limit');
    const unreadOnlyParam = c.req.query('unreadOnly');

    const limit = limitParam !== undefined ? parseLimit(limitParam) : undefined;
    const unreadOnly = unreadOnlyParam === 'true';

    const result = await deps.fetchUseCase.execute({
      recipientUserId: auth.userId,
      ...(limit !== undefined ? { limit } : {}),
      ...(unreadOnly ? { unreadOnly: true } : {}),
    });

    return c.json(result);
  });

  router.get('/unread-count', async (c) => {
    const auth = c.get('auth');
    const result = await deps.fetchUseCase.execute({
      recipientUserId: auth.userId,
      limit: 1,
    });
    return c.json({ count: result.unreadCount });
  });

  router.post('/:id/read', async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(400, { message: 'id zorunlu' });
    }

    try {
      await deps.markAsReadUseCase.execute({
        notificationId: id,
        actorUserId: auth.userId,
      });
    } catch (err: unknown) {
      if (err instanceof NotificationNotFoundError) {
        throw new HTTPException(404, { message: err.message });
      }
      if (err instanceof NotificationForbiddenError) {
        throw new HTTPException(403, { message: err.message });
      }
      throw err;
    }

    return c.json({ ok: true });
  });

  return router;
}

function parseLimit(raw: string): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n > 100) return 100;
  return Math.floor(n);
}
