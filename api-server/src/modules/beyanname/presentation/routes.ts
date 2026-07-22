/**
 * Beyanname (KDV1 + GİB e-Beyan) HTTP route'ları — /v1/beyanname.
 *
 * authMiddleware + companyScopeGuard tüm rotalarda; yazma/gönderim uçları
 * 'cfo' rolü ister. Use-case'leri çağırır, hata mapping errorMapping.ts'de.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard, requireRole } from '../../../middleware/auth.js';
import type { BeyannameConfig } from '../application/dto/BeyannameDtos.js';
import type { BeyannameService } from '../application/useCases/BeyannameService.js';
import type { BeyannameCredentialService } from '../application/useCases/CredentialUseCases.js';

import { mapBeyannameError } from './errorMapping.js';

export interface BeyannameRouterDeps {
  credentials: BeyannameCredentialService;
  beyanname: BeyannameService;
}

const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });

const donemSchema = z.object({
  tip: z.enum(['AYLIK', 'UC_AYLIK']),
  yil: z.number().int().min(2000).max(2100),
  ay: z.enum([
    'OCAK',
    'SUBAT',
    'MART',
    'NISAN',
    'MAYIS',
    'HAZIRAN',
    'TEMMUZ',
    'AGUSTOS',
    'EYLUL',
    'EKIM',
    'KASIM',
    'ARALIK',
  ]),
});

const sifatSchema = z.object({
  tip: z.enum(['MUKELLEF', 'MIRASCI', 'KANUNI_TEMSILCI']),
  adSoyadUnvan: z.string().min(1),
  tckn: z.string().optional(),
  vkn: z.string().optional(),
  eposta: z.string().email().max(50),
  telefon: z.string().min(1),
});

const duzenleyenSchema = z.object({
  tckn: z.string().optional(),
  vkn: z.string().optional(),
  adSoyadUnvan: z.string().min(1),
  eposta: z.string().email().max(50),
  telefon: z.string().min(1),
});

const configSchema = z.object({
  apiKey: z.string().min(1),
  ortam: z.enum(['test', 'prod', 'mock']),
  entegratorVkn: z.string().min(1),
  entegratorUnvan: z.string().min(1).max(20),
  mukellefVkn: z.string().min(1),
  sifat: sifatSchema,
  duzenleyen: duzenleyenSchema,
});

const payloadSchema = z
  .object({
    matrah: z.record(z.unknown()).optional(),
    indirimler: z.record(z.unknown()).optional(),
    istisnalar: z.record(z.unknown()).optional(),
    ihracKaydiylaTeslimler: z.record(z.unknown()).optional(),
    ekler: z.record(z.unknown()).optional(),
    sonucHesaplari: z.record(z.unknown()).optional(),
  })
  .optional();

const ozelOnaySecimSchema = z
  .object({
    kanuniSuresindenSonra: z.boolean().optional(),
    pismanlikTalebi: z.boolean().optional(),
    izah: z.boolean().optional(),
    ihtiraziKayit: z.boolean().optional(),
  })
  .optional();

export function createBeyannameRouter(deps: BeyannameRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', companyScopeGuard);
  const requireWrite = requireRole('cfo');

  const actor = (c: { get: (k: string) => unknown }): number | null => {
    const auth = c.get('auth') as { userId?: number } | undefined;
    return auth?.userId ?? null;
  };

  // ===== Entegrasyon ayarları (credentials) ================================
  app.get('/credentials', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      return c.json({ credential: await deps.credentials.getMasked(q.companyId) });
    } catch (err) {
      mapBeyannameError(err);
    }
  });

  app.put(
    '/credentials',
    requireWrite,
    zValidator('json', z.object({ companyId: z.number().int().positive(), config: configSchema })),
    async (c) => {
      const b = c.req.valid('json');
      const config: BeyannameConfig = {
        apiKey: b.config.apiKey,
        ortam: b.config.ortam,
        entegratorVkn: b.config.entegratorVkn,
        entegratorUnvan: b.config.entegratorUnvan,
        mukellefVkn: b.config.mukellefVkn,
        sifat: {
          tip: b.config.sifat.tip,
          adSoyadUnvan: b.config.sifat.adSoyadUnvan,
          ...(b.config.sifat.tckn !== undefined ? { tckn: b.config.sifat.tckn } : {}),
          ...(b.config.sifat.vkn !== undefined ? { vkn: b.config.sifat.vkn } : {}),
          eposta: b.config.sifat.eposta,
          telefon: b.config.sifat.telefon,
        },
        duzenleyen: {
          adSoyadUnvan: b.config.duzenleyen.adSoyadUnvan,
          ...(b.config.duzenleyen.tckn !== undefined ? { tckn: b.config.duzenleyen.tckn } : {}),
          ...(b.config.duzenleyen.vkn !== undefined ? { vkn: b.config.duzenleyen.vkn } : {}),
          eposta: b.config.duzenleyen.eposta,
          telefon: b.config.duzenleyen.telefon,
        },
      };
      try {
        await deps.credentials.save({ companyId: b.companyId, config, createdBy: actor(c) });
        return c.json({ credential: await deps.credentials.getMasked(b.companyId) }, 201);
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.delete('/credentials', requireWrite, zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      await deps.credentials.delete(q.companyId);
      return c.json({ ok: true });
    } catch (err) {
      mapBeyannameError(err);
    }
  });

  app.post(
    '/credentials/test',
    requireWrite,
    zValidator('json', z.object({ companyId: z.number().int().positive() })),
    async (c) => {
      const b = c.req.valid('json');
      try {
        return c.json(await deps.credentials.testConnection(b.companyId));
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  // ===== Lokal beyanname CRUD ==============================================
  app.get(
    '/declarations',
    zValidator(
      'query',
      companyIdQ.extend({
        durum: z.enum(['taslak', 'gonderildi', 'kontrol_edildi', 'onaylandi', 'hatali']).optional(),
        yil: z.coerce.number().int().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.beyanname.list(q.companyId, {
          ...(q.durum !== undefined ? { durum: q.durum } : {}),
          ...(q.yil !== undefined ? { yil: q.yil } : {}),
        });
        return c.json({ declarations: list });
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.get(
    '/declarations/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json({ declaration: await deps.beyanname.get(q.companyId, id) });
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.post(
    '/declarations',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        tur: z.literal('KDV1').optional(),
        donem: donemSchema,
        vergiDairesiKod: z.string().nullable().optional(),
        vergiDairesiAd: z.string().nullable().optional(),
        duzeltmeMi: z.boolean().optional(),
        payload: payloadSchema,
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const rec = await deps.beyanname.create({
          companyId: b.companyId,
          ...(b.tur !== undefined ? { tur: b.tur } : {}),
          donem: b.donem,
          ...(b.vergiDairesiKod !== undefined ? { vergiDairesiKod: b.vergiDairesiKod } : {}),
          ...(b.vergiDairesiAd !== undefined ? { vergiDairesiAd: b.vergiDairesiAd } : {}),
          ...(b.duzeltmeMi !== undefined ? { duzeltmeMi: b.duzeltmeMi } : {}),
          ...(b.payload !== undefined ? { payload: b.payload } : {}),
          createdBy: actor(c),
        });
        return c.json({ declaration: rec }, 201);
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.put(
    '/declarations/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        donem: donemSchema.optional(),
        vergiDairesiKod: z.string().nullable().optional(),
        vergiDairesiAd: z.string().nullable().optional(),
        duzeltmeMi: z.boolean().optional(),
        payload: payloadSchema,
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const rec = await deps.beyanname.update(b.companyId, id, {
          ...(b.donem !== undefined ? { donem: b.donem } : {}),
          ...(b.vergiDairesiKod !== undefined ? { vergiDairesiKod: b.vergiDairesiKod } : {}),
          ...(b.vergiDairesiAd !== undefined ? { vergiDairesiAd: b.vergiDairesiAd } : {}),
          ...(b.duzeltmeMi !== undefined ? { duzeltmeMi: b.duzeltmeMi } : {}),
          ...(b.payload !== undefined ? { payload: b.payload } : {}),
        });
        return c.json({ declaration: rec });
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.delete(
    '/declarations/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        await deps.beyanname.remove(q.companyId, id);
        return c.json({ ok: true });
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  // ===== GİB e-Beyan akışı =================================================
  const bodyCompanyId = z.object({ companyId: z.number().int().positive() });

  app.post(
    '/declarations/:id/send',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', bodyCompanyId),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(await deps.beyanname.send(b.companyId, id, actor(c)));
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.post(
    '/declarations/:id/check',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', bodyCompanyId),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(await deps.beyanname.check(b.companyId, id, actor(c)));
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.get(
    '/declarations/:id/ozel-onay',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.beyanname.ozelOnay(q.companyId, id));
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.post(
    '/declarations/:id/approve',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        ozelOnaySecim: ozelOnaySecimSchema,
        ozelOnayDetay: z.record(z.unknown()).optional(),
        duzeltmeAciklama: z.string().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.beyanname.approve(
            b.companyId,
            id,
            {
              ...(b.ozelOnaySecim !== undefined ? { ozelOnaySecim: b.ozelOnaySecim } : {}),
              ...(b.ozelOnayDetay !== undefined ? { ozelOnayDetay: b.ozelOnayDetay } : {}),
              ...(b.duzeltmeAciklama !== undefined ? { duzeltmeAciklama: b.duzeltmeAciklama } : {}),
            },
            actor(c),
          ),
        );
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.post(
    '/declarations/:id/make-draft',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', bodyCompanyId),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(await deps.beyanname.makeDraft(b.companyId, id, actor(c)));
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.post(
    '/declarations/:id/refresh-status',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', bodyCompanyId),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(await deps.beyanname.refreshStatus(b.companyId, id, actor(c)));
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.get(
    '/declarations/:id/pdf',
    zValidator('param', idParam),
    zValidator(
      'query',
      companyIdQ.extend({
        type: z.enum(['beyanname', 'tahakkuk', 'ihbarname', 'hatali']).default('beyanname'),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const buf = await deps.beyanname.pdf(q.companyId, id, q.type, actor(c));
        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', `inline; filename="beyanname-${id}-${q.type}.pdf"`);
        return c.body(buf as unknown as ArrayBuffer);
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  // ===== GİB'deki beyannameler + referanslar ===============================
  app.get(
    '/gib/beyannameler',
    zValidator(
      'query',
      companyIdQ.extend({
        durum: z.string().optional(),
        page: z.coerce.number().int().min(0).optional(),
        size: z.coerce.number().int().min(1).max(100).optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const page = await deps.beyanname.listGib(q.companyId, {
          beyannameTuru: ['KDV1'],
          ...(q.durum !== undefined ? { beyannameDurum: [q.durum] } : {}),
          ...(q.page !== undefined ? { page: q.page } : {}),
          ...(q.size !== undefined ? { size: q.size } : {}),
        });
        return c.json(page);
      } catch (err) {
        mapBeyannameError(err);
      }
    },
  );

  app.get('/reference/vergi-daireleri', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      return c.json({ vergiDaireleri: await deps.beyanname.vergiDaireleri(q.companyId) });
    } catch (err) {
      mapBeyannameError(err);
    }
  });

  app.get('/reference/kdv-oranlari', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      return c.json({ kdvOranlari: await deps.beyanname.kdvOranlari(q.companyId) });
    } catch (err) {
      mapBeyannameError(err);
    }
  });

  return app;
}
