/**
 * Reporting (Report Studio) HTTP route'ları — /v1/reports altına mount edilir.
 *
 * Tüm endpoint'ler authMiddleware ile korunur. YAZMA (tanım CRUD) ve AD-HOC HAM
 * SQL çalıştırma 'cfo' (veya üstü) ister; kayıtlı raporu çalıştırma / katalog /
 * listeleme her kimliği doğrulanmış kullanıcıya açıktır. companyId body/query'den
 * alınır; çok-kiracılı izolasyon repo'larda. İş kuralı yok — use-case çağırır.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { authMiddleware, companyScopeGuard, requireRole } from '../../../middleware/auth.js';
import { canRole } from '../../../types.js';
import {
  toReportDefinitionDto,
  toReportRunDto,
  toScheduledReportDto,
} from '../application/dto/ReportingDtos.js';
import type { CompileQueryUseCase } from '../application/useCases/CompileQuery.js';
import type { GetCatalogUseCase } from '../application/useCases/GetCatalog.js';
import type { ListReportRunsUseCase } from '../application/useCases/ListReportRuns.js';
import type {
  CreateReportDefinitionInput,
  CreateReportDefinitionUseCase,
  DeleteReportDefinitionUseCase,
  GetReportDefinitionUseCase,
  ListReportDefinitionsUseCase,
  UpdateReportDefinitionUseCase,
} from '../application/useCases/ReportDefinitionUseCases.js';
import type { RunReportUseCase } from '../application/useCases/RunReport.js';
import type {
  CreateScheduledReportUseCase,
  DeleteScheduledReportUseCase,
  ListScheduledReportsUseCase,
  UpdateScheduledReportUseCase,
} from '../application/useCases/ScheduledReportUseCases.js';
import { querySpecSchema, type QuerySpec } from '../domain/compiler/QuerySpec.js';
import type { ParamDef } from '../domain/params/ParamBinder.js';

import { mapReportingError } from './errorMapping.js';

export interface ReportingRouterDeps {
  getCatalog: GetCatalogUseCase;
  compileQuery: CompileQueryUseCase;
  runReport: RunReportUseCase;
  listDefinitions: ListReportDefinitionsUseCase;
  getDefinition: GetReportDefinitionUseCase;
  createDefinition: CreateReportDefinitionUseCase;
  updateDefinition: UpdateReportDefinitionUseCase;
  deleteDefinition: DeleteReportDefinitionUseCase;
  listRuns: ListReportRunsUseCase;
  listSchedules: ListScheduledReportsUseCase;
  createSchedule: CreateScheduledReportUseCase;
  updateSchedule: UpdateScheduledReportUseCase;
  deleteSchedule: DeleteScheduledReportUseCase;
}

const timeRe = /^[0-2]\d:[0-5]\d$/;
const scheduleCreateSchema = z.object({
  companyId: z.number().int().positive(),
  reportId: z.number().int().positive(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  timeOfDay: z.string().regex(timeRe).default('08:00'),
  recipients: z.array(z.string().email()).min(1),
  paramValues: z.record(z.unknown()).optional(),
  format: z.string().max(10).optional(),
  enabled: z.boolean().optional(),
});
const scheduleUpdateSchema = z.object({
  companyId: z.number().int().positive(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  timeOfDay: z.string().regex(timeRe).optional(),
  recipients: z.array(z.string().email()).min(1).optional(),
  paramValues: z.record(z.unknown()).optional(),
  format: z.string().max(10).optional(),
  enabled: z.boolean().optional(),
});

// --- zod şemaları ---
const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });

const paramDefSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(['date', 'number', 'text', 'select']),
  label: z.string().max(120).optional(),
  required: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.null()]).optional(),
  options: z
    .array(z.union([z.string(), z.object({ value: z.string(), label: z.string().optional() })]))
    .optional(),
});

const runSchema = z.object({
  companyId: z.number().int().positive(),
  reportId: z.number().int().positive().optional(),
  mode: z.enum(['sql', 'visual']).optional(),
  sql: z.string().max(20_000).optional(),
  spec: querySpecSchema.optional(),
  paramDefs: z.array(paramDefSchema).optional(),
  params: z.record(z.unknown()).optional(),
  preview: z.boolean().optional(),
});

const compileSchema = z.object({
  companyId: z.number().int().positive(),
  spec: querySpecSchema,
  paramDefs: z.array(paramDefSchema).optional(),
  params: z.record(z.unknown()).optional(),
});

const createSchema = z.object({
  companyId: z.number().int().positive(),
  folderId: z.number().int().positive().nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  groupLabel: z.string().max(120).nullable().optional(),
  mode: z.enum(['sql', 'visual']),
  sqlText: z.string().max(20_000).nullable().optional(),
  querySpec: querySpecSchema.optional(),
  params: z.array(paramDefSchema).optional(),
  vizConfig: z.record(z.unknown()).optional(),
  layoutConfig: z.record(z.unknown()).optional(),
  visibility: z.enum(['private', 'company', 'public']).optional(),
});

const updateSchema = createSchema.partial().extend({
  companyId: z.number().int().positive(),
});

interface Auth {
  userId: number;
  role: Parameters<typeof canRole>[0];
}

export function createReportingRouter(deps: ReportingRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', companyScopeGuard);
  const requireWrite = requireRole('cfo');

  const auth = (c: { get: (k: string) => unknown }): Auth => {
    const a = c.get('auth') as { userId?: number; role?: Auth['role'] } | undefined;
    return { userId: a?.userId ?? 0, role: a?.role ?? 'viewer' };
  };

  // ===== Katalog =====
  app.get('/catalog', async (c) => {
    try {
      return c.json(await deps.getCatalog.execute());
    } catch (err) {
      mapReportingError(err);
    }
  });

  // ===== Çalıştır (kayıtlı id VEYA ad-hoc) =====
  app.post('/run', zValidator('json', runSchema), async (c) => {
    const b = c.req.valid('json');
    const a = auth(c);
    // Ad-hoc ham SQL → cfo gerekli (kayıtlı rapor çalıştırma herkese açık).
    const isAdhocSql = b.reportId === undefined && (b.mode ?? 'sql') === 'sql';
    if (isAdhocSql && !canRole(a.role, 'cfo')) {
      throw new HTTPException(403, { message: 'Ham SQL çalıştırma yetkisi gerekli (cfo)' });
    }
    try {
      const result = await deps.runReport.execute({
        companyId: b.companyId,
        runBy: a.userId || null,
        ...(b.reportId !== undefined ? { reportId: b.reportId } : {}),
        ...(b.mode !== undefined ? { mode: b.mode } : {}),
        ...(b.sql !== undefined ? { sql: b.sql } : {}),
        ...(b.spec !== undefined ? { spec: b.spec } : {}),
        ...(b.paramDefs !== undefined ? { paramDefs: b.paramDefs as ParamDef[] } : {}),
        ...(b.params !== undefined ? { params: b.params } : {}),
      });
      return c.json(result);
    } catch (err) {
      mapReportingError(err);
    }
  });

  // ===== Önizleme (küçük satır sınırı) — ad-hoc, cfo =====
  app.post('/preview', requireWrite, zValidator('json', runSchema), async (c) => {
    const b = c.req.valid('json');
    const a = auth(c);
    try {
      const result = await deps.runReport.execute({
        companyId: b.companyId,
        runBy: a.userId || null,
        preview: true,
        ...(b.reportId !== undefined ? { reportId: b.reportId } : {}),
        ...(b.mode !== undefined ? { mode: b.mode } : {}),
        ...(b.sql !== undefined ? { sql: b.sql } : {}),
        ...(b.spec !== undefined ? { spec: b.spec } : {}),
        ...(b.paramDefs !== undefined ? { paramDefs: b.paramDefs as ParamDef[] } : {}),
        ...(b.params !== undefined ? { params: b.params } : {}),
      });
      return c.json(result);
    } catch (err) {
      mapReportingError(err);
    }
  });

  // ===== Görsel spec → SQL derle (çalıştırmadan, canlı önizleme) =====
  app.post('/compile', zValidator('json', compileSchema), async (c) => {
    const b = c.req.valid('json');
    try {
      return c.json(
        await deps.compileQuery.execute({
          companyId: b.companyId,
          spec: b.spec as QuerySpec,
          ...(b.paramDefs !== undefined ? { paramDefs: b.paramDefs as ParamDef[] } : {}),
          ...(b.params !== undefined ? { params: b.params } : {}),
        }),
      );
    } catch (err) {
      mapReportingError(err);
    }
  });

  // ===== Rapor tanımı CRUD =====
  app.get('/definitions', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const defs = await deps.listDefinitions.execute({ companyId: q.companyId });
      return c.json({ reports: defs.map(toReportDefinitionDto) });
    } catch (err) {
      mapReportingError(err);
    }
  });

  app.get(
    '/definitions/:id',
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        const def = await deps.getDefinition.execute({ reportId: id, companyId: q.companyId });
        return c.json(toReportDefinitionDto(def));
      } catch (err) {
        mapReportingError(err);
      }
    },
  );

  app.post('/definitions', requireWrite, zValidator('json', createSchema), async (c) => {
    const b = c.req.valid('json');
    const a = auth(c);
    try {
      const def = await deps.createDefinition.execute({
        ...(b as unknown as CreateReportDefinitionInput),
        createdBy: a.userId || null,
      });
      return c.json(toReportDefinitionDto(def), 201);
    } catch (err) {
      mapReportingError(err);
    }
  });

  app.put(
    '/definitions/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', updateSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const b = c.req.valid('json');
      try {
        const def = await deps.updateDefinition.execute({
          ...(b as Record<string, unknown>),
          reportId: id,
          companyId: b.companyId,
        });
        return c.json(toReportDefinitionDto(def));
      } catch (err) {
        mapReportingError(err);
      }
    },
  );

  app.delete(
    '/definitions/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(
          await deps.deleteDefinition.execute({ reportId: id, companyId: q.companyId }),
        );
      } catch (err) {
        mapReportingError(err);
      }
    },
  );

  // ===== Çalıştırma denetimi =====
  app.get(
    '/runs',
    zValidator(
      'query',
      companyIdQ.extend({ limit: z.coerce.number().int().positive().max(1000).optional() }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const runs = await deps.listRuns.execute({
          companyId: q.companyId,
          ...(q.limit !== undefined ? { limit: q.limit } : {}),
        });
        return c.json({ runs: runs.map(toReportRunDto) });
      } catch (err) {
        mapReportingError(err);
      }
    },
  );

  // ===== Zamanlanmış raporlar (P5) =====
  app.get(
    '/schedules',
    zValidator(
      'query',
      companyIdQ.extend({ reportId: z.coerce.number().int().positive().optional() }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const list = await deps.listSchedules.execute({
          companyId: q.companyId,
          ...(q.reportId !== undefined ? { reportId: q.reportId } : {}),
        });
        return c.json({ schedules: list.map(toScheduledReportDto) });
      } catch (err) {
        mapReportingError(err);
      }
    },
  );

  app.post('/schedules', requireWrite, zValidator('json', scheduleCreateSchema), async (c) => {
    const b = c.req.valid('json');
    const a = auth(c);
    try {
      const s = await deps.createSchedule.execute({
        companyId: b.companyId,
        reportId: b.reportId,
        frequency: b.frequency,
        dayOfWeek: b.dayOfWeek ?? null,
        dayOfMonth: b.dayOfMonth ?? null,
        timeOfDay: b.timeOfDay,
        recipients: b.recipients,
        paramValues: b.paramValues ?? {},
        format: b.format ?? 'xlsx',
        enabled: b.enabled ?? true,
        createdBy: a.userId || null,
      });
      return c.json(toScheduledReportDto(s), 201);
    } catch (err) {
      mapReportingError(err);
    }
  });

  app.put(
    '/schedules/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('json', scheduleUpdateSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { companyId, ...fields } = c.req.valid('json');
      try {
        const s = await deps.updateSchedule.execute({
          id,
          companyId,
          ...fields,
        } as Parameters<UpdateScheduledReportUseCase['execute']>[0]);
        if (!s) throw new HTTPException(404, { message: 'Zamanlama bulunamadı' });
        return c.json(toScheduledReportDto(s));
      } catch (err) {
        mapReportingError(err);
      }
    },
  );

  app.delete(
    '/schedules/:id',
    requireWrite,
    zValidator('param', idParam),
    zValidator('query', companyIdQ),
    async (c) => {
      const { id } = c.req.valid('param');
      const q = c.req.valid('query');
      try {
        return c.json(await deps.deleteSchedule.execute({ id, companyId: q.companyId }));
      } catch (err) {
        mapReportingError(err);
      }
    },
  );

  return app;
}
