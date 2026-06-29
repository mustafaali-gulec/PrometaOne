/**
 * Purchasing (Satınalma) HTTP route'ları.
 *
 * Tüm endpoint'ler authMiddleware ile korunur; yazma işlemleri en az 'editor'
 * rolü ister (rol hiyerarşisi: editor < hr_manager < cfo < admin). companyId
 * body/query'den alınır; multi-tenant izolasyon repo'larda. İş kuralı yazmaz;
 * use-case'leri çağırır, hata mapping errorMapping.ts'de.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../../middleware/auth.js';
import type {
  ChangePoStatusUseCase,
  CreatePurchaseOrderUseCase,
  ListPurchaseOrdersUseCase,
  UpdatePurchaseOrderUseCase,
} from '../application/useCases/PurchaseOrderUseCases.js';
import type {
  ChangePrStatusUseCase,
  CreatePurchaseRequestUseCase,
  DeletePurchaseRequestUseCase,
  ListPurchaseRequestsUseCase,
  UpdatePurchaseRequestUseCase,
} from '../application/useCases/PurchaseRequestUseCases.js';
import type {
  CreateVendorUseCase,
  DeactivateVendorUseCase,
  ListVendorsUseCase,
  UpdateVendorUseCase,
} from '../application/useCases/VendorUseCases.js';

import { mapPurchasingError } from './errorMapping.js';

export interface PurchasingRouterDeps {
  createVendor: CreateVendorUseCase;
  listVendors: ListVendorsUseCase;
  updateVendor: UpdateVendorUseCase;
  deactivateVendor: DeactivateVendorUseCase;
  createPurchaseRequest: CreatePurchaseRequestUseCase;
  listPurchaseRequests: ListPurchaseRequestsUseCase;
  updatePurchaseRequest: UpdatePurchaseRequestUseCase;
  deletePurchaseRequest: DeletePurchaseRequestUseCase;
  changePrStatus: ChangePrStatusUseCase;
  createPurchaseOrder: CreatePurchaseOrderUseCase;
  listPurchaseOrders: ListPurchaseOrdersUseCase;
  updatePurchaseOrder: UpdatePurchaseOrderUseCase;
  changePoStatus: ChangePoStatusUseCase;
}

// --- Schema fragmanları ---------------------------------------------------
const currency = z.enum(['TRY', 'USD', 'EUR']);
const personType = z.enum(['real', 'legal']);
const cariClass = z.enum(['satici', 'alici']);
const prStatus = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'ordered',
  'received',
  'closed',
]);
const poStatus = z.enum([
  'draft',
  'ordered',
  'partial',
  'received',
  'closed',
  'cancelled',
  'invoiced',
]);
const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const prItem = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().nonnegative().default(1),
  unitPrice: z.number().nonnegative().default(0),
  note: z.string().max(2000).nullable().optional(),
});
const poLine = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().nonnegative().default(1),
  unitPrice: z.number().nonnegative().default(0),
  receivedQty: z.number().nonnegative().optional(),
});

export function createPurchasingRouter(deps: PurchasingRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  const requireWrite = requireRole('editor');

  const actorId = (c: { get: (k: string) => unknown }): number | null => {
    const auth = c.get('auth') as { userId?: number } | undefined;
    return auth?.userId ?? null;
  };

  // ===== VENDORS (Tedarikçiler / cari) ====================================
  app.get(
    '/vendors',
    zValidator(
      'query',
      companyIdQ.extend({
        includeInactive: z.coerce.boolean().optional(),
        search: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listVendors.execute({
          companyId: q.companyId,
          ...(q.includeInactive !== undefined ? { includeInactive: q.includeInactive } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
        });
        return c.json({ vendors: list });
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  app.post(
    '/vendors',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300),
        code: z.string().max(40).optional(),
        taxId: z.string().max(20).nullable().optional(),
        personType: personType.optional(),
        cariClass: cariClass.optional(),
        taxOffice: z.string().max(120).nullable().optional(),
        address: z.string().max(2000).nullable().optional(),
        accountCode: z.string().max(40).nullable().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createVendor.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  app.patch(
    '/vendors/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300).optional(),
        taxId: z.string().max(20).nullable().optional(),
        personType: personType.optional(),
        cariClass: cariClass.optional(),
        taxOffice: z.string().max(120).nullable().optional(),
        address: z.string().max(2000).nullable().optional(),
        accountCode: z.string().max(40).nullable().optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateVendor.execute({ vendorId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  app.delete(
    '/vendors/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      try {
        const dto = await deps.deactivateVendor.execute({ companyId, vendorId: id });
        return c.json(dto);
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  // ===== PURCHASE REQUESTS (Talepler) =====================================
  app.get(
    '/requests',
    zValidator(
      'query',
      companyIdQ.extend({
        status: prStatus.optional(),
        requesterUserId: z.coerce.number().int().positive().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listPurchaseRequests.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
          ...(q.requesterUserId !== undefined ? { requesterUserId: q.requesterUserId } : {}),
        });
        return c.json({ requests: list });
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  app.post(
    '/requests',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        departmentId: z.number().int().positive().nullable().optional(),
        category: z.string().max(40).optional(),
        priority: z.string().max(20).optional(),
        currency: currency.optional(),
        justification: z.string().max(4000).nullable().optional(),
        requiredBy: dateStr.nullable().optional(),
        items: z.array(prItem).min(1),
        submit: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createPurchaseRequest.execute({
          ...b,
          requesterUserId: actorId(c),
        });
        return c.json(dto, 201);
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  app.patch(
    '/requests/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        category: z.string().max(40).optional(),
        priority: z.string().max(20).optional(),
        currency: currency.optional(),
        justification: z.string().max(4000).nullable().optional(),
        requiredBy: dateStr.nullable().optional(),
        items: z.array(prItem).min(1).optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updatePurchaseRequest.execute({ prId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  app.delete(
    '/requests/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const { companyId } = c.req.valid('query');
      try {
        await deps.deletePurchaseRequest.execute({ companyId, prId: id });
        return c.body(null, 204);
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  app.post(
    '/requests/:id/status',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: z.number().int().positive(), status: prStatus })),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.changePrStatus.execute({
          companyId: b.companyId,
          prId: id,
          status: b.status,
        });
        return c.json(dto);
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  // ===== PURCHASE ORDERS (Siparişler) =====================================
  app.get(
    '/orders',
    zValidator(
      'query',
      companyIdQ.extend({
        status: poStatus.optional(),
        vendorId: z.coerce.number().int().positive().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listPurchaseOrders.execute({
          companyId: q.companyId,
          ...(q.status !== undefined ? { status: q.status } : {}),
          ...(q.vendorId !== undefined ? { vendorId: q.vendorId } : {}),
        });
        return c.json({ orders: list });
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  app.post(
    '/orders',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        // bigint id'ler JSON'da string olarak gelebilir → coerce
        vendorId: z.coerce.number().int().positive(),
        prId: z.coerce.number().int().positive().nullable().optional(),
        currency: currency.optional(),
        note: z.string().max(4000).nullable().optional(),
        lines: z.array(poLine).optional(),
        markOrdered: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createPurchaseOrder.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  app.patch(
    '/orders/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        currency: currency.optional(),
        note: z.string().max(4000).nullable().optional(),
        lines: z.array(poLine).min(1).optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updatePurchaseOrder.execute({ poId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  app.post(
    '/orders/:id/status',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: z.number().int().positive(), status: poStatus })),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.changePoStatus.execute({
          companyId: b.companyId,
          poId: id,
          status: b.status,
        });
        return c.json(dto);
      } catch (err) {
        mapPurchasingError(err);
      }
    },
  );

  return app;
}
