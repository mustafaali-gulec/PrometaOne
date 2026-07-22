/**
 * Finance HTTP route'ları — Faz 5 / PR 6b.
 *
 * Tüm endpoint'ler authMiddleware ile korunur; yazma işlemleri 'cfo' rolü
 * ister (rol hiyerarşisi: editor < hr_manager < cfo < admin). companyId
 * body/query'den alınır; multi-tenant izolasyon repo'larda. Bu dosya
 * use-case'leri çağırır, iş kuralı yazmaz; hata mapping errorMapping.ts'de.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard, requireRole } from '../../../middleware/auth.js';
import type {
  ArchiveBankAccountUseCase,
  ArchiveKasaAccountUseCase,
  CreateBankAccountInput,
  CreateBankAccountUseCase,
  CreateKasaAccountInput,
  CreateKasaAccountUseCase,
  ListBankAccountsUseCase,
  ListKasaAccountsUseCase,
} from '../application/useCases/AccountUseCases.js';
import type { AdoptBlobFinanceKasaUseCase } from '../application/useCases/AdoptBlobFinanceKasaUseCase.js';
import type {
  BulkSetCellsInput,
  BulkSetCellsUseCase,
  GetBudgetMatrixUseCase,
  SetCellValueInput,
  SetCellValueUseCase,
} from '../application/useCases/BudgetMatrixUseCases.js';
import type {
  CreateTransferInput,
  CreateTransferUseCase,
  DeleteKasaEntryUseCase,
  GetCashPositionUseCase,
  ListKasaEntriesUseCase,
  ListTransfersUseCase,
  RecordKasaEntryInput,
  RecordKasaEntryUseCase,
  UpdateKasaEntryInput,
  UpdateKasaEntryUseCase,
} from '../application/useCases/CashFlowUseCases.js';
import type {
  ArchiveCategoryUseCase,
  CreateCategoryInput,
  CreateCategoryUseCase,
  ListCategoriesUseCase,
  RenameCategoryUseCase,
  ReorderCategoriesUseCase,
} from '../application/useCases/CategoryUseCases.js';
import type {
  CommitInvoiceToCellsUseCase,
  CommitKasaEntryToCellsUseCase,
  CommitTransferToCellsUseCase,
} from '../application/useCases/CommitToCellsUseCases.js';
import type {
  CreateInvoiceInput,
  CreateInvoiceUseCase,
  DeletePaymentUseCase,
  GetOverdueInvoicesUseCase,
  ListInvoicesUseCase,
  RecordPaymentInput,
  RecordPaymentUseCase,
} from '../application/useCases/InvoiceUseCases.js';

import { mapFinanceError } from './errorMapping.js';

export interface FinanceRouterDeps {
  // Budget
  createCategory: CreateCategoryUseCase;
  renameCategory: RenameCategoryUseCase;
  reorderCategories: ReorderCategoriesUseCase;
  archiveCategory: ArchiveCategoryUseCase;
  listCategories: ListCategoriesUseCase;
  getBudgetMatrix: GetBudgetMatrixUseCase;
  setCellValue: SetCellValueUseCase;
  bulkSetCells: BulkSetCellsUseCase;
  // Cash
  createBankAccount: CreateBankAccountUseCase;
  archiveBankAccount: ArchiveBankAccountUseCase;
  listBankAccounts: ListBankAccountsUseCase;
  createKasaAccount: CreateKasaAccountUseCase;
  archiveKasaAccount: ArchiveKasaAccountUseCase;
  listKasaAccounts: ListKasaAccountsUseCase;
  recordKasaEntry: RecordKasaEntryUseCase;
  listKasaEntries: ListKasaEntriesUseCase;
  updateKasaEntry: UpdateKasaEntryUseCase;
  deleteKasaEntry: DeleteKasaEntryUseCase;
  adoptBlobFinanceKasa: AdoptBlobFinanceKasaUseCase;
  createTransfer: CreateTransferUseCase;
  listTransfers: ListTransfersUseCase;
  getCashPosition: GetCashPositionUseCase;
  // Invoice
  createInvoice: CreateInvoiceUseCase;
  recordPayment: RecordPaymentUseCase;
  deletePayment: DeletePaymentUseCase;
  listInvoices: ListInvoicesUseCase;
  getOverdueInvoices: GetOverdueInvoicesUseCase;
  // Commit
  commitKasaEntry: CommitKasaEntryToCellsUseCase;
  commitTransfer: CommitTransferToCellsUseCase;
  commitInvoice: CommitInvoiceToCellsUseCase;
}

// --- Schema fragmanları ---------------------------------------------------
const currency = z.enum(['TRY', 'USD', 'EUR']);
const section = z.enum(['inflows', 'outflows', 'nonPnlOutflows', 'kasaCategories']);
const flow = z.enum(['in', 'out']);
const endpoint = z.enum(['bank', 'kasa']);
const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function createFinanceRouter(deps: FinanceRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', companyScopeGuard);
  const requireWrite = requireRole('cfo');

  const actor = (c: { get: (k: string) => unknown }): { userId: number | null } => {
    const auth = c.get('auth') as { userId?: number } | undefined;
    return { userId: auth?.userId ?? null };
  };

  // ===== BUDGET ===========================================================
  app.get(
    '/budget/matrix',
    zValidator(
      'query',
      companyIdQ.extend({ fiscalYear: z.coerce.number().int(), currency: currency.optional() }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const matrix = await deps.getBudgetMatrix.execute({
          companyId: q.companyId,
          fiscalYear: q.fiscalYear,
          ...(q.currency !== undefined ? { currency: q.currency } : {}),
        });
        return c.json(matrix);
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.get(
    '/categories',
    zValidator('query', companyIdQ.extend({ section: section.optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const categories = await deps.listCategories.execute({
          companyId: q.companyId,
          ...(q.section !== undefined ? { section: q.section } : {}),
        });
        return c.json({ categories });
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.post(
    '/categories',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        section,
        name: z.string().min(1).max(200),
        sortOrder: z.number().int().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createCategory.execute(b as CreateCategoryInput);
        return c.json(dto, 201);
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.patch(
    '/categories/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({ companyId: z.number().int().positive(), name: z.string().min(1).max(200) }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.renameCategory.execute({
          companyId: b.companyId,
          categoryId: id,
          name: b.name,
        });
        return c.json(dto);
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.post(
    '/categories/reorder',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        orderedIds: z.array(z.number().int().positive()),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        await deps.reorderCategories.execute(b);
        return c.json({ ok: true });
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.delete(
    '/categories/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.archiveCategory.execute({ companyId: q.companyId, categoryId: id });
        return c.json(dto);
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.post(
    '/cells',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        categoryId: z.number().int().positive(),
        fiscalYear: z.number().int(),
        monthIdx: z.number().int().min(0).max(11),
        value: z.number(),
        currency: currency.optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        await deps.setCellValue.execute({
          ...b,
          actorUserId: actor(c).userId,
        } as SetCellValueInput);
        return c.json({ ok: true });
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.post(
    '/cells/bulk',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        fiscalYear: z.number().int(),
        currency: currency.optional(),
        entries: z.array(
          z.object({
            categoryId: z.number().int().positive(),
            monthIdx: z.number().int().min(0).max(11),
            value: z.number(),
          }),
        ),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        await deps.bulkSetCells.execute({
          ...b,
          actorUserId: actor(c).userId,
        } as BulkSetCellsInput);
        return c.json({ ok: true });
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  // ===== CASH =============================================================
  app.get('/bank-accounts', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      return c.json({ accounts: await deps.listBankAccounts.execute({ companyId: q.companyId }) });
    } catch (err) {
      mapFinanceError(err);
    }
  });

  app.post(
    '/bank-accounts',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        bankId: z.number().int().positive(),
        name: z.string().min(1),
        iban: z.string().nullable().optional(),
        accountNo: z.string().nullable().optional(),
        currency,
        openingBalance: z.number().optional(),
        cashflowCatId: z.number().int().positive().nullable().optional(),
      }),
    ),
    async (c) => {
      try {
        return c.json(
          await deps.createBankAccount.execute(c.req.valid('json') as CreateBankAccountInput),
          201,
        );
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.delete(
    '/bank-accounts/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.archiveBankAccount.execute({ companyId: q.companyId, accountId: id }),
        );
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.get('/kasa-accounts', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      return c.json({ accounts: await deps.listKasaAccounts.execute({ companyId: q.companyId }) });
    } catch (err) {
      mapFinanceError(err);
    }
  });

  app.post(
    '/kasa-accounts',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1),
        currency,
        openingBalance: z.number().optional(),
      }),
    ),
    async (c) => {
      try {
        return c.json(
          await deps.createKasaAccount.execute(c.req.valid('json') as CreateKasaAccountInput),
          201,
        );
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.delete(
    '/kasa-accounts/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.archiveKasaAccount.execute({ companyId: q.companyId, accountId: id }),
        );
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.post(
    '/kasa-entries',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        kasaAccountId: z.number().int().positive(),
        date: dateStr,
        type: flow,
        amount: z.number().positive(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        cashflowCatId: z.number().int().positive().nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.recordKasaEntry.execute({
            ...b,
            actorUserId: actor(c).userId,
          } as RecordKasaEntryInput),
          201,
        );
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.get(
    '/kasa-entries',
    zValidator(
      'query',
      companyIdQ.extend({ kasaAccountId: z.coerce.number().int().positive().optional() }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const entries = await deps.listKasaEntries.execute({
          companyId: q.companyId,
          ...(q.kasaAccountId !== undefined ? { kasaAccountId: q.kasaAccountId } : {}),
        });
        return c.json({ entries });
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.patch(
    '/kasa-entries/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        kasaAccountId: z.number().int().positive().optional(),
        date: dateStr.optional(),
        type: flow.optional(),
        amount: z.number().positive().optional(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        cashflowCatId: z.number().int().positive().nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.updateKasaEntry.execute({ ...b, entryId: id } as UpdateKasaEntryInput),
        );
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.delete(
    '/kasa-entries/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.deleteKasaEntry.execute({ companyId: q.companyId, entryId: id }));
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  // ---------------------------------------------------------------------------
  // KASA BLOB DEVRALMA (tek seferlik, idempotent — yazma-cutover)
  // ---------------------------------------------------------------------------
  // Blob (promet:data) kasaAccounts/kasaEntries koleksiyonlarını client_id
  // (048) anahtarıyla devralır; ikinci çağrı dupe üretmez. Gövde blob alan
  // adlarıyla GEVŞEK gelir; normalizasyon use-case'te. kasaCategories BLOB'DA
  // KALIR (hareketler kategori ADI serbest metniyle referans verir). Emsal:
  // POST /v1/hr/recruiting/adopt-blob.
  app.post(
    '/kasa/adopt-blob',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.coerce.number().int().positive(),
        accounts: z.array(z.record(z.unknown())).optional(),
        entries: z.array(z.record(z.unknown())).optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        return c.json(await deps.adoptBlobFinanceKasa.execute(b));
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.get('/transfers', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      return c.json({ transfers: await deps.listTransfers.execute({ companyId: q.companyId }) });
    } catch (err) {
      mapFinanceError(err);
    }
  });

  app.post(
    '/transfers',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        date: dateStr,
        fromType: endpoint,
        fromId: z.number().int().positive(),
        toType: endpoint,
        toId: z.number().int().positive(),
        fromAmount: z.number().positive(),
        toAmount: z.number().positive(),
        fromCurrency: currency,
        toCurrency: currency,
        description: z.string().nullable().optional(),
        cashflowCatId: z.number().int().positive().nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.createTransfer.execute({
            ...b,
            actorUserId: actor(c).userId,
          } as CreateTransferInput),
          201,
        );
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.get(
    '/cash-position/:type/:id',
    zValidator('param', z.object({ type: endpoint, id: z.coerce.number().int().positive() })),
    zValidator('query', companyIdQ),
    async (c) => {
      const p = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.getCashPosition.execute({
            companyId: q.companyId,
            endpointType: p.type,
            accountId: p.id,
          }),
        );
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  // ===== INVOICE ==========================================================
  app.get(
    '/invoices',
    zValidator(
      'query',
      companyIdQ.extend({ type: flow.optional(), openOnly: z.coerce.boolean().optional() }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const invoices = await deps.listInvoices.execute({
          companyId: q.companyId,
          ...(q.type !== undefined ? { type: q.type } : {}),
          ...(q.openOnly !== undefined ? { openOnly: q.openOnly } : {}),
        });
        return c.json({ invoices });
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.get('/invoices/overdue', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      return c.json({
        invoices: await deps.getOverdueInvoices.execute({ companyId: q.companyId }),
      });
    } catch (err) {
      mapFinanceError(err);
    }
  });

  app.post(
    '/invoices',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        type: flow,
        invoiceNo: z.string().nullable().optional(),
        counterparty: z.string().min(1),
        issueDate: dateStr.nullable().optional(),
        dueDate: dateStr,
        currency,
        subtotal: z.number(),
        kdvRate: z.number().min(0).max(1).optional(),
        cashflowCatId: z.number().int().positive().nullable().optional(),
        note: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.createInvoice.execute({
            ...b,
            actorUserId: actor(c).userId,
          } as CreateInvoiceInput),
          201,
        );
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.post(
    '/invoices/:id/payments',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        amount: z.number().positive(),
        date: dateStr,
        bankAccountId: z.number().int().positive().nullable().optional(),
        kasaAccountId: z.number().int().positive().nullable().optional(),
        note: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        return c.json(
          await deps.recordPayment.execute({
            ...b,
            invoiceId: id,
            actorUserId: actor(c).userId,
          } as RecordPaymentInput),
          201,
        );
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.delete(
    '/payments/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.deletePayment.execute({ companyId: q.companyId, paymentId: id }));
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  // ===== COMMIT-TO-CELLS ==================================================
  app.post(
    '/kasa-entries/:id/commit',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        await deps.commitKasaEntry.execute({
          companyId: b.companyId,
          kasaEntryId: id,
          actorUserId: actor(c).userId,
        });
        return c.json({ ok: true });
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.post(
    '/transfers/:id/commit',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        await deps.commitTransfer.execute({
          companyId: b.companyId,
          transferId: id,
          actorUserId: actor(c).userId,
        });
        return c.json({ ok: true });
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  app.post(
    '/invoices/:id/commit',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        await deps.commitInvoice.execute({
          companyId: b.companyId,
          invoiceId: id,
          actorUserId: actor(c).userId,
        });
        return c.json({ ok: true });
      } catch (err) {
        mapFinanceError(err);
      }
    },
  );

  return app;
}
