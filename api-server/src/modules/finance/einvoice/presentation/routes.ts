/**
 * E-Fatura + FX HTTP route'ları (Faz 6 / PR 6).
 *
 * authMiddleware ile korunur; yazma işlemleri 'cfo' rolü ister. Use-case'leri
 * çağırır, hata mapping errorMapping.ts'de. app.ts `/v1/finance` altına mount eder
 * (finance router ile aynı prefix; yollar /einvoice/* ve /fx/*).
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../../../middleware/auth.js';
import type {
  FetchAndStoreRatesUseCase,
  GetCurrentRatesUseCase,
  GetRateAtUseCase,
} from '../../fx/application/useCases/RateUseCases.js';
import type {
  CreateRevaluationUseCase,
  ListRevaluationsUseCase,
  PostRevaluationUseCase,
} from '../../fx/application/useCases/RevaluationUseCases.js';
import type { SyncLogRepository } from '../application/ports/EInvoiceRepositories.js';
import type {
  DeleteCredentialUseCase,
  SaveCredentialUseCase,
  TestConnectionUseCase,
} from '../application/useCases/CredentialUseCases.js';
import type {
  IgnoreEInvoiceUseCase,
  ImportEInvoiceUseCase,
  ListEInvoicesUseCase,
} from '../application/useCases/ImportEInvoiceUseCases.js';
import type {
  ListUnmappedPartiesUseCase,
  MapPartyUseCase,
} from '../application/useCases/PartyMappingUseCases.js';
import type { SyncEInvoicesUseCase } from '../application/useCases/SyncEInvoicesUseCase.js';
import type { CredentialConfig } from '../domain/entities/EInvoiceCredential.js';

import { mapEInvoiceError } from './errorMapping.js';

export interface EInvoiceRouterDeps {
  listEInvoices: ListEInvoicesUseCase;
  syncEInvoices: SyncEInvoicesUseCase;
  importEInvoice: ImportEInvoiceUseCase;
  ignoreEInvoice: IgnoreEInvoiceUseCase;
  saveCredential: SaveCredentialUseCase;
  testConnection: TestConnectionUseCase;
  deleteCredential: DeleteCredentialUseCase;
  mapParty: MapPartyUseCase;
  listUnmappedParties: ListUnmappedPartiesUseCase;
  syncLog: SyncLogRepository;
  // FX
  fetchAndStoreRates: FetchAndStoreRatesUseCase;
  getCurrentRates: GetCurrentRatesUseCase;
  getRateAt: GetRateAtUseCase;
  createRevaluation: CreateRevaluationUseCase;
  postRevaluation: PostRevaluationUseCase;
  listRevaluations: ListRevaluationsUseCase;
}

const provider = z.enum(['elogo', 'qnb_efinans', 'logo_db', 'mock']);
const currency = z.enum(['TRY', 'USD', 'EUR']);
const direction = z.enum(['incoming', 'outgoing']);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });

export function createEInvoiceRouter(deps: EInvoiceRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  const requireWrite = requireRole('cfo');

  const actor = (c: { get: (k: string) => unknown }): number | null => {
    const auth = c.get('auth') as { userId?: number } | undefined;
    return auth?.userId ?? null;
  };

  // ===== E-FATURA =========================================================
  app.get(
    '/einvoice',
    zValidator(
      'query',
      companyIdQ.extend({
        direction: direction.optional(),
        pendingOnly: z.coerce.boolean().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listEInvoices.execute({
          companyId: q.companyId,
          ...(q.direction !== undefined ? { direction: q.direction } : {}),
          ...(q.pendingOnly !== undefined ? { pendingOnly: q.pendingOnly } : {}),
        });
        return c.json({ einvoices: list.map((e) => e.toJSON()) });
      } catch (err) {
        mapEInvoiceError(err);
      }
    },
  );

  app.post(
    '/einvoice/sync',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        provider,
        dateFrom: dateStr,
        dateTo: dateStr,
        direction: z.enum(['incoming', 'outgoing', 'both']).optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const res = await deps.syncEInvoices.execute({
          companyId: b.companyId,
          provider: b.provider,
          dateFrom: b.dateFrom,
          dateTo: b.dateTo,
          ...(b.direction !== undefined ? { direction: b.direction } : {}),
          trigger: 'api',
          actorUserId: actor(c),
        });
        return c.json(res);
      } catch (err) {
        mapEInvoiceError(err);
      }
    },
  );

  app.post(
    '/einvoice/:id/import',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        cashflowCatId: z.number().int().positive().nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const res = await deps.importEInvoice.execute({
          companyId: b.companyId,
          einvoiceId: id,
          ...(b.cashflowCatId !== undefined ? { cashflowCatId: b.cashflowCatId } : {}),
          actorUserId: actor(c),
        });
        return c.json(res, 201);
      } catch (err) {
        mapEInvoiceError(err);
      }
    },
  );

  app.post(
    '/einvoice/:id/ignore',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        reason: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        await deps.ignoreEInvoice.execute({
          companyId: b.companyId,
          einvoiceId: id,
          ...(b.reason !== undefined ? { reason: b.reason } : {}),
        });
        return c.json({ ok: true });
      } catch (err) {
        mapEInvoiceError(err);
      }
    },
  );

  app.get('/einvoice/sync-log', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      return c.json({ logs: await deps.syncLog.listByCompany(q.companyId) });
    } catch (err) {
      mapEInvoiceError(err);
    }
  });

  // --- Credentials ---
  app.put(
    '/einvoice/credentials',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        provider,
        config: z.object({
          username: z.string().min(1),
          password: z.string().min(1),
          vergiNo: z.string().min(1),
          env: z.enum(['test', 'prod']),
          wsdlUrl: z.string().optional(),
        }),
        autoSyncEnabled: z.boolean().optional(),
        autoSyncCron: z.string().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      const config: CredentialConfig = {
        username: b.config.username,
        password: b.config.password,
        vergiNo: b.config.vergiNo,
        env: b.config.env,
        ...(b.config.wsdlUrl !== undefined ? { wsdlUrl: b.config.wsdlUrl } : {}),
      };
      try {
        const cred = await deps.saveCredential.execute({
          companyId: b.companyId,
          provider: b.provider,
          config,
          ...(b.autoSyncEnabled !== undefined ? { autoSyncEnabled: b.autoSyncEnabled } : {}),
          ...(b.autoSyncCron !== undefined ? { autoSyncCron: b.autoSyncCron } : {}),
          actorUserId: actor(c),
        });
        return c.json(cred.toJSON(), 201);
      } catch (err) {
        mapEInvoiceError(err);
      }
    },
  );

  app.post(
    '/einvoice/credentials/test',
    requireWrite,
    zValidator('json', z.object({ companyId: z.number().int().positive(), provider })),
    async (c) => {
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.testConnection.execute({ companyId: b.companyId, provider: b.provider }),
        );
      } catch (err) {
        mapEInvoiceError(err);
      }
    },
  );

  app.delete(
    '/einvoice/credentials',
    requireWrite,
    zValidator('query', companyIdQ.extend({ provider })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        await deps.deleteCredential.execute({ companyId: q.companyId, provider: q.provider });
        return c.json({ ok: true });
      } catch (err) {
        mapEInvoiceError(err);
      }
    },
  );

  // --- Party mapping ---
  app.get('/einvoice/parties/unmapped', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      return c.json({
        parties: await deps.listUnmappedParties.execute({ companyId: q.companyId }),
      });
    } catch (err) {
      mapEInvoiceError(err);
    }
  });

  app.post(
    '/einvoice/parties',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        vknTckn: z.string().min(1),
        displayName: z.string().nullable().optional(),
        cashflowCatId: z.number().int().positive().nullable().optional(),
        autoImport: z.boolean().optional(),
        notes: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const mapping = await deps.mapParty.execute({
          companyId: b.companyId,
          vknTckn: b.vknTckn,
          ...(b.displayName !== undefined ? { displayName: b.displayName } : {}),
          ...(b.cashflowCatId !== undefined ? { cashflowCatId: b.cashflowCatId } : {}),
          ...(b.autoImport !== undefined ? { autoImport: b.autoImport } : {}),
          ...(b.notes !== undefined ? { notes: b.notes } : {}),
        });
        return c.json(mapping.toJSON(), 201);
      } catch (err) {
        mapEInvoiceError(err);
      }
    },
  );

  // ===== FX ===============================================================
  app.get('/fx/rates', async (c) => {
    try {
      return c.json(await deps.getCurrentRates.execute());
    } catch (err) {
      mapEInvoiceError(err);
    }
  });

  app.post('/fx/rates/fetch', requireWrite, async (c) => {
    try {
      return c.json(await deps.fetchAndStoreRates.execute({}));
    } catch (err) {
      mapEInvoiceError(err);
    }
  });

  app.get('/fx/rates/at', zValidator('query', z.object({ currency, date: dateStr })), async (c) => {
    const q = c.req.valid('query');
    try {
      return c.json({ currency: q.currency, date: q.date, rate: await deps.getRateAt.execute(q) });
    } catch (err) {
      mapEInvoiceError(err);
    }
  });

  app.get('/fx/revaluations', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const list = await deps.listRevaluations.execute({ companyId: q.companyId });
      return c.json({ revaluations: list.map((r) => r.toJSON()) });
    } catch (err) {
      mapEInvoiceError(err);
    }
  });

  app.post(
    '/fx/revaluations',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        referenceDate: dateStr,
        valuationDate: dateStr,
        positions: z.array(
          z.object({
            label: z.string().min(1),
            currency: z.enum(['USD', 'EUR']),
            foreignAmountMajor: z.number(),
          }),
        ),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const reval = await deps.createRevaluation.execute({ ...b, actorUserId: actor(c) });
        return c.json(reval.toJSON(), 201);
      } catch (err) {
        mapEInvoiceError(err);
      }
    },
  );

  app.post(
    '/fx/revaluations/:id/post',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const reval = await deps.postRevaluation.execute({
          companyId: b.companyId,
          revaluationId: id,
        });
        return c.json(reval.toJSON());
      } catch (err) {
        mapEInvoiceError(err);
      }
    },
  );

  return app;
}
