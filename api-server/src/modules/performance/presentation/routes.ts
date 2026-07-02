/**
 * Performans (Performance) HTTP route'ları.
 *
 * Tüm endpoint'ler authMiddleware ile korunur; sync en az 'editor' rolü ister.
 * POST /sync full-state yansıtmadır: istemci blob'u (kaynak-of-truth)
 * şirketin tüm dönem+değerlendirmelerini gönderir; prune=true payload'da
 * olmayanları siler. İş kuralı yazmaz; use-case'leri çağırır.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../../middleware/auth.js';
import type {
  ListPerfCyclesUseCase,
  ListPerfReviewsUseCase,
  SyncPerformanceUseCase,
} from '../application/useCases/PerformanceUseCases.js';

import { mapPerformanceError } from './errorMapping.js';

export interface PerformanceRouterDeps {
  syncPerformance: SyncPerformanceUseCase;
  listPerfCycles: ListPerfCyclesUseCase;
  listPerfReviews: ListPerfReviewsUseCase;
}

// --- Schema fragmanları ---------------------------------------------------
const companyIdQ = z.object({ companyId: z.coerce.number().int().positive() });

const cycleStatus = z.enum(['draft', 'active', 'calibration', 'closed']);
const reviewStatus = z.enum([
  'self_pending',
  'self_submitted',
  'manager_pending',
  'completed',
  'acknowledged',
]);
const ratingKey = z.enum(['outstanding', 'exceeds', 'meets', 'partially', 'below']);

const isoDate = z.string().max(40).nullish();

const goal = z.object({
  id: z.string().min(1).max(60),
  title: z.string().max(300).default(''),
  description: z.string().max(2000).optional(),
  weight: z.number().min(0).max(100).optional(),
  selfScore: z.number().min(0).max(100).optional(),
  selfComment: z.string().max(2000).optional(),
  managerScore: z.number().min(0).max(100).optional(),
  managerComment: z.string().max(2000).optional(),
});

const competency = z.object({
  key: z.string().min(1).max(60),
  label: z.string().max(200).optional(),
  selfScore: z.number().min(0).max(100).optional(),
  selfComment: z.string().max(2000).optional(),
  managerScore: z.number().min(0).max(100).optional(),
  managerComment: z.string().max(2000).optional(),
});

const cycle = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  periodStart: isoDate,
  periodEnd: isoDate,
  status: cycleStatus,
  selfAssessment: z.boolean().optional(),
  competenciesEnabled: z.boolean().optional(),
  scaleMax: z.number().int().min(1).max(100).optional(),
  weightGoals: z.number().min(0).max(100).optional(),
  weightCompetencies: z.number().min(0).max(100).optional(),
  competencyDefs: z
    .array(z.object({ key: z.string().min(1).max(60), label: z.string().max(200).optional() }))
    .max(100)
    .optional(),
  createdBy: z.string().max(80).nullish(),
  activatedAt: isoDate,
  closedAt: isoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
});

const review = z.object({
  id: z.string().min(1).max(60),
  cycleId: z.string().min(1).max(60),
  employeeId: z.string().min(1).max(60),
  reviewerUserId: z.string().max(80).nullish(),
  status: reviewStatus,
  goals: z.array(goal).max(200).optional(),
  competencies: z.array(competency).max(100).optional(),
  selfOverallComment: z.string().max(8000).optional(),
  managerOverallComment: z.string().max(8000).optional(),
  selfSubmittedAt: isoDate,
  managerSubmittedAt: isoDate,
  managerUserId: z.string().max(80).nullish(),
  overallScore: z.number().min(0).max(100).optional(),
  ratingKey: ratingKey.nullish(),
  calibratedRatingKey: ratingKey.nullish(),
  acknowledgedAt: isoDate,
  acknowledgedBy: z.string().max(80).nullish(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export function createPerformanceRouter(deps: PerformanceRouterDeps): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  const requireWrite = requireRole('editor');

  app.post(
    '/sync',
    requireWrite,
    zValidator(
      'json',
      z.object({
        companyId: z.number().int().positive(),
        prune: z.boolean().optional(),
        cycles: z.array(cycle).max(500),
        reviews: z.array(review).max(20000),
      }),
    ),
    async (c) => {
      const b = c.req.valid('json');
      try {
        const result = await deps.syncPerformance.execute({
          companyId: b.companyId,
          prune: b.prune,
          cycles: b.cycles.map((x) => ({
            id: x.id,
            name: x.name,
            periodStart: x.periodStart ?? null,
            periodEnd: x.periodEnd ?? null,
            status: x.status,
            selfAssessment: x.selfAssessment ?? true,
            competenciesEnabled: x.competenciesEnabled ?? true,
            scaleMax: x.scaleMax ?? 5,
            weightGoals: x.weightGoals ?? 60,
            weightCompetencies: x.weightCompetencies ?? 40,
            competencyDefs: x.competencyDefs ?? [],
            createdBy: x.createdBy ?? null,
            activatedAt: x.activatedAt ?? null,
            closedAt: x.closedAt ?? null,
            createdAt: x.createdAt ?? null,
            updatedAt: x.updatedAt ?? null,
          })),
          reviews: b.reviews.map((x) => ({
            id: x.id,
            cycleId: x.cycleId,
            employeeId: x.employeeId,
            reviewerUserId: x.reviewerUserId ?? null,
            status: x.status,
            goals: x.goals ?? [],
            competencies: x.competencies ?? [],
            selfOverallComment: x.selfOverallComment ?? '',
            managerOverallComment: x.managerOverallComment ?? '',
            selfSubmittedAt: x.selfSubmittedAt ?? null,
            managerSubmittedAt: x.managerSubmittedAt ?? null,
            managerUserId: x.managerUserId ?? null,
            overallScore: x.overallScore ?? 0,
            ratingKey: x.ratingKey ?? null,
            calibratedRatingKey: x.calibratedRatingKey ?? null,
            acknowledgedAt: x.acknowledgedAt ?? null,
            acknowledgedBy: x.acknowledgedBy ?? null,
            createdAt: x.createdAt ?? null,
            updatedAt: x.updatedAt ?? null,
          })),
        });
        return c.json(result);
      } catch (err) {
        mapPerformanceError(err);
      }
    },
  );

  app.get('/cycles', zValidator('query', companyIdQ), async (c) => {
    const q = c.req.valid('query');
    try {
      const cycles = await deps.listPerfCycles.execute({ companyId: q.companyId });
      return c.json({ cycles });
    } catch (err) {
      mapPerformanceError(err);
    }
  });

  app.get(
    '/reviews',
    zValidator('query', companyIdQ.extend({ cycleId: z.string().max(60).optional() })),
    async (c) => {
      const q = c.req.valid('query');
      try {
        const reviews = await deps.listPerfReviews.execute({
          companyId: q.companyId,
          ...(q.cycleId !== undefined ? { cycleId: q.cycleId } : {}),
        });
        return c.json({ reviews });
      } catch (err) {
        mapPerformanceError(err);
      }
    },
  );

  return app;
}
