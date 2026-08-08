/**
 * LinkedIn işe alım entegrasyonu HTTP route'ları — /v1/hr/linkedin altına mount.
 *
 * Tümü authMiddleware + companyScopeGuard ile korunur; yazma işlemleri
 * 'hr_manager' rolü ister (HR modülünün geri kalanıyla aynı eşik).
 *
 * Public uçlar (XML beslemesi + OAuth callback) BURADA DEĞİL, feedRoutes.ts'de:
 * ikisi de tarayıcı/crawler'dan çerezsiz gelir, JWT taşıyamaz.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard, requireRole } from '../../../../middleware/auth.js';
import type { CloseJobPostingUseCase } from '../application/useCases/CloseJobPostingUseCase.js';
import type {
  DeleteLinkedInConnectionUseCase,
  GetLinkedInConnectionUseCase,
  SaveLinkedInConnectionUseCase,
  TestLinkedInConnectionUseCase,
} from '../application/useCases/ConnectionUseCases.js';
import type { ListLinkedInPostsUseCase } from '../application/useCases/ListLinkedInPostsUseCase.js';
import type { StartLinkedInOAuthUseCase } from '../application/useCases/OAuthUseCases.js';
import type { PublishJobPostingUseCase } from '../application/useCases/PublishJobPostingUseCase.js';
import { ALL_LINKEDIN_CHANNELS } from '../domain/valueObjects/LinkedInChannel.js';

import { mapLinkedInError } from './errorMapping.js';

export interface LinkedInRouterDeps {
  getConnection: GetLinkedInConnectionUseCase;
  saveConnection: SaveLinkedInConnectionUseCase;
  deleteConnection: DeleteLinkedInConnectionUseCase;
  testConnection: TestLinkedInConnectionUseCase;
  startOAuth: StartLinkedInOAuthUseCase;
  publishJobPosting: PublishJobPostingUseCase;
  closeJobPosting: CloseJobPostingUseCase;
  listPosts: ListLinkedInPostsUseCase;
  /** İstek bağlamından dışa açık kök adresi çözer (env yoksa Host başlığından). */
  resolvePublicBaseUrl: (requestUrl: string) => string;
  /** LinkedIn uygulamasına kayıtlı dönüş adresi. */
  resolveRedirectUri: (requestUrl: string) => string;
}

const companyId = z.coerce.number().int().positive();
const channel = z.enum(ALL_LINKEDIN_CHANNELS);
const nullableTrimmed = z.string().trim().max(2000).nullable();

export function createLinkedInRouter(deps: LinkedInRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', companyScopeGuard);
  const requireHrWrite = requireRole('hr_manager');

  const actor = (c: { get: (k: string) => unknown }): number | null => {
    const auth = c.get('auth') as { userId?: number } | undefined;
    return auth?.userId ?? null;
  };

  // ===== BAĞLANTI ==========================================================
  app.get('/connection', zValidator('query', z.object({ companyId })), async (c) => {
    const q = c.req.valid('query');
    try {
      const res = await deps.getConnection.execute({
        companyId: q.companyId,
        publicBaseUrl: deps.resolvePublicBaseUrl(c.req.url),
      });
      return c.json(res);
    } catch (err) {
      mapLinkedInError(err);
    }
  });

  app.put(
    '/connection',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId,
        clientId: z.string().trim().max(200).optional(),
        clientSecret: z.string().trim().max(400).optional(),
        organizationUrn: nullableTrimmed.optional(),
        organizationName: nullableTrimmed.optional(),
        autoPublish: z.boolean().optional(),
        channels: z.array(channel).min(1).optional(),
        careerSiteBaseUrl: nullableTrimmed.optional(),
        isActive: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const connection = await deps.saveConnection.execute({ ...b, actorId: actor(c) });
        return c.json({ connection });
      } catch (err) {
        mapLinkedInError(err);
      }
    },
  );

  app.delete(
    '/connection',
    requireHrWrite,
    zValidator('query', z.object({ companyId })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        await deps.deleteConnection.execute({ companyId: q.companyId });
        return c.json({ deleted: true });
      } catch (err) {
        mapLinkedInError(err);
      }
    },
  );

  app.post(
    '/connection/test',
    requireHrWrite,
    zValidator('json', z.object({ companyId })),
    async (c) => {
      const b = c.req.valid('json');
      try {
        return c.json(await deps.testConnection.execute({ companyId: b.companyId }));
      } catch (err) {
        mapLinkedInError(err);
      }
    },
  );

  // ===== OAUTH =============================================================
  app.post(
    '/oauth/start',
    requireHrWrite,
    zValidator('json', z.object({ companyId })),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const res = await deps.startOAuth.execute({
          companyId: b.companyId,
          actorId: actor(c),
          redirectUri: deps.resolveRedirectUri(c.req.url),
        });
        return c.json(res);
      } catch (err) {
        mapLinkedInError(err);
      }
    },
  );

  // ===== İLAN YAYINLAMA ====================================================
  app.post(
    '/publish',
    requireHrWrite,
    zValidator(
      'json',
      z.object({
        companyId,
        postingRef: z.string().trim().min(1).max(120),
        title: z.string().trim().min(1).max(300),
        description: z.string().max(20000).default(''),
        slug: nullableTrimmed.optional(),
        location: nullableTrimmed.optional(),
        employmentType: nullableTrimmed.optional(),
        companyName: nullableTrimmed.optional(),
        applyUrl: nullableTrimmed.optional(),
        lang: z.enum(['tr', 'en', 'de', 'ar']).optional(),
        channels: z.array(channel).min(1).optional(),
        trigger: z.enum(['auto', 'manual']).optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        return c.json(await deps.publishJobPosting.execute({ ...b, actorId: actor(c) }));
      } catch (err) {
        mapLinkedInError(err);
      }
    },
  );

  app.post(
    '/close',
    requireHrWrite,
    zValidator('json', z.object({ companyId, postingRef: z.string().trim().min(1).max(120) })),
    async (c) => {
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.closeJobPosting.execute({
            companyId: b.companyId,
            postingRef: b.postingRef,
            actorId: actor(c),
          }),
        );
      } catch (err) {
        mapLinkedInError(err);
      }
    },
  );

  // ===== GÖNDERİM KAYITLARI ================================================
  app.get(
    '/posts',
    zValidator(
      'query',
      z.object({
        companyId,
        postingRef: z.string().trim().max(120).optional(),
        limit: z.coerce.number().int().min(1).max(1000).optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        return c.json(await deps.listPosts.execute(q));
      } catch (err) {
        mapLinkedInError(err);
      }
    },
  );

  return app;
}
