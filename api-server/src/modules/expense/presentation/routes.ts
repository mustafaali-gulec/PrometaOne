/**
 * Gider/Masraf (Expense) HTTP route'ları.
 *
 * Tüm endpoint'ler authMiddleware ile korunur; yazma işlemleri en az 'editor'
 * rolü ister (rol hiyerarşisi: editor < hr_manager < cfo < admin). companyId
 * body/query'den alınır; multi-tenant izolasyon repo'larda. İş kuralı yazmaz;
 * use-case'leri çağırır, hata mapping errorMapping.ts'de.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard, requireRole } from '../../../middleware/auth.js';
import type {
  BulkUpsertExpenseCardsUseCase,
  CreateExpenseCardUseCase,
  DeactivateExpenseCardUseCase,
  DeleteExpenseCardUseCase,
  ListExpenseCardsUseCase,
  UpdateExpenseCardUseCase,
} from '../application/useCases/ExpenseCardUseCases.js';
import type { ParseKasaImportUseCase } from '../application/useCases/KasaImportUseCases.js';

import { mapExpenseError } from './errorMapping.js';

export interface ExpenseRouterDeps {
  createExpenseCard: CreateExpenseCardUseCase;
  listExpenseCards: ListExpenseCardsUseCase;
  updateExpenseCard: UpdateExpenseCardUseCase;
  deactivateExpenseCard: DeactivateExpenseCardUseCase;
  deleteExpenseCard: DeleteExpenseCardUseCase;
  bulkUpsertExpenseCards: BulkUpsertExpenseCardsUseCase;
  parseKasaImport: ParseKasaImportUseCase;
}

// --- Schema fragmanları ---------------------------------------------------
const direction = z.enum(['in', 'out']);
const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });
/** Sıkı query-boolean — z.coerce.boolean() "false" string'ini true yapar
 *  (Boolean("false")===true tuzağı); burada yalnız 'true'/'false' kabul edilir. */
const boolQ = z.enum(['true', 'false']).transform((v) => v === 'true');

const bulkCard = z.object({
  code: z.string().max(40).nullable().optional(),
  name: z.string().min(1).max(300),
  category: z.string().max(120).optional(),
  direction: direction.optional(),
});

/** Gider kartı ek öznitelikleri — bilinmeyen anahtarlar elenir. */
const attributes = z.object({
  kdvRate: z.number().min(0).max(100).optional(),
  tevkifatCode: z.string().max(20).optional(),
  taxDeductible: z.boolean().optional(),
  costCenter: z.string().max(120).optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', '']).optional(),
  currency: z.string().max(8).optional(),
  defaultAmount: z.number().min(0).optional(),
  monthlyBudget: z.number().min(0).optional(),
  recurring: z.boolean().optional(),
  vendor: z.string().max(200).optional(),
});

const genericColumnMap = z.object({
  headerRowIndex: z.number().int().nonnegative(),
  date: z.number().int().nonnegative(),
  description: z.number().int().nonnegative(),
  type: z.number().int().nonnegative().optional(),
  amount: z.number().int().nonnegative().optional(),
  amountIn: z.number().int().nonnegative().optional(),
  amountOut: z.number().int().nonnegative().optional(),
  category: z.number().int().nonnegative().optional(),
  invoiceNo: z.number().int().nonnegative().optional(),
});

const kasaSheets = z
  .array(
    z.object({
      name: z.string(),
      rows: z.array(z.array(z.string())).max(5000),
    }),
  )
  .max(400);

export function createExpenseRouter(deps: ExpenseRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', companyScopeGuard);
  const requireWrite = requireRole('editor');

  const actorId = (c: { get: (k: string) => unknown }): number | null => {
    const auth = c.get('auth') as { userId?: number } | undefined;
    return auth?.userId ?? null;
  };

  // ===== EXPENSE CARDS (Gider Kartları) ===================================
  app.get(
    '/cards',
    zValidator(
      'query',
      companyIdQ.extend({
        includeInactive: boolQ.optional(),
        search: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const cards = await deps.listExpenseCards.execute({
          companyId: q.companyId,
          ...(q.includeInactive !== undefined ? { includeInactive: q.includeInactive } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
        });
        return c.json({ cards });
      } catch (err) {
        mapExpenseError(err);
      }
    },
  );

  app.post(
    '/cards',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        code: z.string().max(40).optional(),
        name: z.string().min(1).max(300),
        category: z.string().max(120).optional(),
        direction: direction.optional(),
        defaultAccountCode: z.string().max(40).nullable().optional(),
        note: z.string().max(4000).nullable().optional(),
        attributes: attributes.optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createExpenseCard.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapExpenseError(err);
      }
    },
  );

  app.patch(
    '/cards/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300).optional(),
        category: z.string().max(120).optional(),
        direction: direction.optional(),
        defaultAccountCode: z.string().max(40).nullable().optional(),
        note: z.string().max(4000).nullable().optional(),
        attributes: attributes.optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateExpenseCard.execute({ cardId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapExpenseError(err);
      }
    },
  );

  // Öndeğer: pasifleştir (soft). `hard=true` → kalıcı sil. Kural: yalnız
  // İŞLEM GÖRMEMİŞ kartlar kalıcı silinir — kasa hareketleri app-state
  // blob'unda olduğundan bu kontrol FE'de yapılır (backend göremez).
  app.delete(
    '/cards/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ.extend({ hard: boolQ.optional() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const { companyId, hard } = c.req.valid('query');
      try {
        if (hard === true) {
          await deps.deleteExpenseCard.execute({ companyId, cardId: id });
          return c.body(null, 204);
        }
        const dto = await deps.deactivateExpenseCard.execute({ companyId, cardId: id });
        return c.json(dto);
      } catch (err) {
        mapExpenseError(err);
      }
    },
  );

  app.post(
    '/cards/bulk-upsert',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        cards: z.array(bulkCard).max(2000),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const result = await deps.bulkUpsertExpenseCards.execute({
          companyId: b.companyId,
          actorUserId: actorId(c),
          cards: b.cards,
        });
        return c.json(result);
      } catch (err) {
        mapExpenseError(err);
      }
    },
  );

  // ===== KASA IMPORT (Excel parse) ========================================
  app.post(
    '/kasa-import/parse',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        formatId: z.enum(['can_tekel_daily', 'generic']),
        year: z.number().int().min(1900).max(3000).optional(),
        sheets: kasaSheets,
        columnMap: genericColumnMap.optional(),
      }),
    ),
    (c) => {
      const b = c.req.valid('json');
      try {
        const result = deps.parseKasaImport.execute({
          companyId: b.companyId,
          formatId: b.formatId,
          ...(b.year !== undefined ? { year: b.year } : {}),
          sheets: b.sheets,
          ...(b.columnMap !== undefined ? { columnMap: b.columnMap } : {}),
        });
        return c.json(result);
      } catch (err) {
        mapExpenseError(err);
      }
    },
  );

  return app;
}
