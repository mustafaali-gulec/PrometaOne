/**
 * Construction (Şantiye) HTTP route'ları — Faz SF-1: Projeler & Sözleşmeler.
 *
 * Tüm endpoint'ler authMiddleware ile korunur; yazma işlemleri en az 'editor'
 * rolü ister. companyId body/query'den alınır; multi-tenant izolasyon repo'larda.
 * İş kuralı yazmaz; use-case'leri çağırır, hata mapping errorMapping.ts'de.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../../middleware/auth.js';
import type {
  CreateContractUseCase,
  ListContractsUseCase,
  UpdateContractUseCase,
} from '../application/useCases/ContractUseCases.js';
import type {
  ChangeProjectStatusUseCase,
  CreateProjectUseCase,
  DeactivateProjectUseCase,
  ListProjectsUseCase,
  UpdateProjectUseCase,
} from '../application/useCases/ProjectUseCases.js';

import { mapConstructionError } from './errorMapping.js';

export interface ConstructionRouterDeps {
  createProject: CreateProjectUseCase;
  listProjects: ListProjectsUseCase;
  updateProject: UpdateProjectUseCase;
  changeProjectStatus: ChangeProjectStatusUseCase;
  deactivateProject: DeactivateProjectUseCase;
  createContract: CreateContractUseCase;
  listContracts: ListContractsUseCase;
  updateContract: UpdateContractUseCase;
}

// --- Schema fragmanları ---------------------------------------------------
const currency = z.enum(['TRY', 'USD', 'EUR']);
const projectType = z.enum(['private', 'public_tender']);
const projectStatus = z.enum(['planning', 'active', 'suspended', 'completed', 'closed']);
const contractParty = z.enum(['employer', 'subcontractor']);
const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const tenderSchema = z
  .object({
    ikn: z.string().max(40).nullable().optional(),
    procedure: z.string().max(60).nullable().optional(),
    approxCost: z.number().nonnegative().nullable().optional(),
    tenderDate: dateStr.nullable().optional(),
    workIncreasePct: z.number().nonnegative().optional(),
    perfBondPct: z.number().nonnegative().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .nullable();

export function createConstructionRouter(deps: ConstructionRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  const requireWrite = requireRole('editor');

  const actorId = (c: { get: (k: string) => unknown }): number | null => {
    const auth = c.get('auth') as { userId?: number } | undefined;
    return auth?.userId ?? null;
  };

  // ===== PROJECTS (Projeler) ==============================================
  app.get(
    '/projects',
    zValidator(
      'query',
      companyIdQ.extend({
        includeInactive: z.coerce.boolean().optional(),
        status: projectStatus.optional(),
        projectType: projectType.optional(),
        search: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listProjects.execute({
          companyId: q.companyId,
          ...(q.includeInactive !== undefined ? { includeInactive: q.includeInactive } : {}),
          ...(q.status !== undefined ? { status: q.status } : {}),
          ...(q.projectType !== undefined ? { projectType: q.projectType } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
        });
        return c.json({ projects: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/projects',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300),
        code: z.string().max(40).optional(),
        projectType: projectType.optional(),
        orgUnitId: z.number().int().positive().nullable().optional(),
        managerUserId: z.number().int().positive().nullable().optional(),
        location: z.string().max(500).nullable().optional(),
        startDate: dateStr.nullable().optional(),
        plannedEnd: dateStr.nullable().optional(),
        budgetAmount: z.number().nonnegative().optional(),
        currency: currency.optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createProject.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/projects/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        name: z.string().min(1).max(300).optional(),
        projectType: projectType.optional(),
        orgUnitId: z.number().int().positive().nullable().optional(),
        managerUserId: z.number().int().positive().nullable().optional(),
        location: z.string().max(500).nullable().optional(),
        startDate: dateStr.nullable().optional(),
        plannedEnd: dateStr.nullable().optional(),
        budgetAmount: z.number().nonnegative().optional(),
        currency: currency.optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateProject.execute({ projectId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/projects/:id/status',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', z.object({ companyId: z.number().int().positive(), status: projectStatus })),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.changeProjectStatus.execute({
          projectId: id,
          companyId: b.companyId,
          status: b.status,
        });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.delete(
    '/projects/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const dto = await deps.deactivateProject.execute({ projectId: id, companyId: q.companyId });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  // ===== CONTRACTS (Sözleşmeler + İhale) ==================================
  app.get(
    '/contracts',
    zValidator(
      'query',
      companyIdQ.extend({
        projectId: z.coerce.number().int().positive().optional(),
        partyKind: contractParty.optional(),
        search: z.string().optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listContracts.execute({
          companyId: q.companyId,
          ...(q.projectId !== undefined ? { projectId: q.projectId } : {}),
          ...(q.partyKind !== undefined ? { partyKind: q.partyKind } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
        });
        return c.json({ contracts: list });
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.post(
    '/contracts',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        partyKind: contractParty,
        vendorId: z.number().int().positive().nullable().optional(),
        contractNo: z.string().max(60).optional(),
        title: z.string().min(1).max(300),
        amount: z.number().nonnegative().optional(),
        currency: currency.optional(),
        signDate: dateStr.nullable().optional(),
        startDate: dateStr.nullable().optional(),
        endDate: dateStr.nullable().optional(),
        retentionPct: z.number().nonnegative().optional(),
        advancePct: z.number().nonnegative().optional(),
        priceDiffOn: z.boolean().optional(),
        tender: tenderSchema.optional(),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const dto = await deps.createContract.execute({ ...b, createdBy: actorId(c) });
        return c.json(dto, 201);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  app.patch(
    '/contracts/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        title: z.string().min(1).max(300).optional(),
        vendorId: z.number().int().positive().nullable().optional(),
        amount: z.number().nonnegative().optional(),
        currency: currency.optional(),
        signDate: dateStr.nullable().optional(),
        startDate: dateStr.nullable().optional(),
        endDate: dateStr.nullable().optional(),
        retentionPct: z.number().nonnegative().optional(),
        advancePct: z.number().nonnegative().optional(),
        priceDiffOn: z.boolean().optional(),
        tender: tenderSchema.optional(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const dto = await deps.updateContract.execute({ contractId: id, ...b });
        return c.json(dto);
      } catch (err) {
        mapConstructionError(err);
      }
    },
  );

  return app;
}
