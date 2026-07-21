/**
 * E-posta HTTP routes (Hono) — /v1/email altına mount edilir.
 *
 * Endpoint'ler:
 *   POST /v1/email/send — e-posta gönder (auth ZORUNLU; 20/dk rate limit).
 *     Açık-relay engeli SendNotificationEmail use-case'indedir; sonuç asla
 *     throw etmez, { success, messageId?, error? } döner (FE sözleşmesi).
 *   GET  /v1/email/log  — gönderim geçmişi (auth + admin) → { items, total }.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../../middleware/auth.js';
import { rateLimitMiddleware } from '../../../middleware/rateLimit.js';
import type { EmailLogRepository } from '../application/ports/EmailLogRepository.js';
import type { SendNotificationEmailUseCase } from '../application/useCases/SendNotificationEmail.js';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  html: z.string().max(200_000).optional(),
  text: z.string().max(50_000).optional(),
  fromName: z.string().max(200).optional(),
  replyTo: z.string().email().optional(),
  meta: z
    .object({
      kind: z.string().max(100).optional(),
      recipientUserId: z.coerce.string().max(200).optional(),
      notificationId: z.coerce.string().max(200).optional(),
    })
    .optional(),
});

const logQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export interface EmailRouterDeps {
  sendEmailUseCase: SendNotificationEmailUseCase;
  emailLogRepo: EmailLogRepository;
}

export function createEmailRouter(deps: EmailRouterDeps): Hono {
  const router = new Hono();

  router.post(
    '/send',
    authMiddleware,
    rateLimitMiddleware('email-send', 20),
    zValidator('json', sendEmailSchema),
    async (c) => {
      const auth = c.get('auth');
      const body = c.req.valid('json');

      const result = await deps.sendEmailUseCase.execute({
        to: body.to,
        subject: body.subject,
        ...(body.html !== undefined ? { html: body.html } : {}),
        ...(body.text !== undefined ? { text: body.text } : {}),
        ...(body.fromName !== undefined ? { fromName: body.fromName } : {}),
        ...(body.replyTo !== undefined ? { replyTo: body.replyTo } : {}),
        ...(body.meta !== undefined ? { meta: body.meta } : {}),
        sender: { userId: auth.userId, username: auth.username },
      });

      return c.json(result);
    },
  );

  router.get(
    '/log',
    authMiddleware,
    requireRole('admin'),
    zValidator('query', logQuerySchema),
    async (c) => {
      const { limit, offset } = c.req.valid('query');
      const result = await deps.emailLogRepo.list({ limit, offset });
      return c.json(result);
    },
  );

  return router;
}
