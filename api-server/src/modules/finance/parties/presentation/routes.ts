/**
 * Cari (party) HTTP route'ları — /v1/finance altına mount edilir.
 *
 * authMiddleware ile korunur; yazma (bulk-import) 'cfo' rolü ister.
 *   GET  /parties?companyId=             → şirketin cari kartları
 *   POST /parties/bulk-import            → Excel/CSV toplu içe aktarım
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard, requireRole } from '../../../../middleware/auth.js';
import type { BulkImportPartiesUseCase } from '../application/useCases/BulkImportPartiesUseCase.js';
import type { ListPartiesUseCase } from '../application/useCases/ListPartiesUseCase.js';

export interface PartiesRouterDeps {
  bulkImportParties: BulkImportPartiesUseCase;
  listParties: ListPartiesUseCase;
}

const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });

const partyItem = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  personType: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  data: z.record(z.unknown()).nullable().optional(),
});

const bulkImportBody = z.object({
  companyId: z.number().int().positive(),
  mode: z.enum(['merge', 'only_new', 'replace_all']),
  parties: z.array(partyItem).min(1).max(10000),
});

export function createPartiesRouter(deps: PartiesRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', companyScopeGuard);
  const requireWrite = requireRole('cfo');

  app.get('/parties', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    const parties = await deps.listParties.execute({ companyId: q.companyId });
    return c.json({ parties: parties.map((p) => p.toJSON()) });
  });

  app.post('/parties/bulk-import', requireWrite, zValidator('json', bulkImportBody), async (c) => {
    const b = c.req.valid('json');
    const result = await deps.bulkImportParties.execute({
      companyId: b.companyId,
      mode: b.mode,
      parties: b.parties.map((p) => ({
        ...(p.id !== undefined ? { id: p.id } : {}),
        code: p.code,
        name: p.name,
        type: p.type,
        ...(p.personType !== undefined ? { personType: p.personType } : {}),
        ...(p.taxId !== undefined ? { taxId: p.taxId } : {}),
        ...(p.status !== undefined ? { status: p.status } : {}),
        ...(p.data !== undefined ? { data: p.data } : {}),
      })),
    });
    return c.json(result, 201);
  });

  return app;
}
