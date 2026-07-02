// api-server test paketi node:test ile koşar (scripts/run-tests.mjs → tsx --test);
// vitest importu burada "Vitest failed to access its internal state" ile patlar.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ListPerfCyclesUseCase,
  ListPerfReviewsUseCase,
  SyncPerformanceUseCase,
} from '../application/useCases/PerformanceUseCases.js';
import type { PerfCycleProps } from '../domain/entities/PerfCycle.js';
import type { PerfReviewProps } from '../domain/entities/PerfReview.js';
import { PerformanceValidationError } from '../domain/errors/PerformanceErrors.js';

import { FakePerfCycleRepository, FakePerfReviewRepository } from './fakes.js';

const cycleInput = (
  over: Partial<Omit<PerfCycleProps, 'companyId'>> = {},
): Omit<PerfCycleProps, 'companyId'> => ({
  id: 'pc_1',
  name: '2026 Yıl Sonu',
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
  status: 'active',
  selfAssessment: true,
  competenciesEnabled: true,
  scaleMax: 5,
  weightGoals: 60,
  weightCompetencies: 40,
  competencyDefs: [{ key: 'quality' }],
  createdBy: 'admin',
  activatedAt: '2026-07-02T10:00:00.000Z',
  closedAt: null,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: null,
  ...over,
});

const reviewInput = (
  over: Partial<Omit<PerfReviewProps, 'companyId'>> = {},
): Omit<PerfReviewProps, 'companyId'> => ({
  id: 'pf_1',
  cycleId: 'pc_1',
  employeeId: 'emp_1',
  reviewerUserId: 'boss',
  status: 'self_pending',
  goals: [{ id: 'g1', title: 'Hedef', weight: 100, selfScore: 4 }],
  competencies: [{ key: 'quality', selfScore: 3 }],
  selfOverallComment: '',
  managerOverallComment: '',
  selfSubmittedAt: null,
  managerSubmittedAt: null,
  managerUserId: null,
  overallScore: 0,
  ratingKey: null,
  calibratedRatingKey: null,
  acknowledgedAt: null,
  acknowledgedBy: null,
  createdAt: '2026-07-02T10:00:00.000Z',
  updatedAt: null,
  ...over,
});

function makeSut() {
  const cycles = new FakePerfCycleRepository();
  const reviews = new FakePerfReviewRepository();
  return {
    cycles,
    reviews,
    sync: new SyncPerformanceUseCase(cycles, reviews),
    listCycles: new ListPerfCyclesUseCase(cycles),
    listReviews: new ListPerfReviewsUseCase(reviews),
  };
}

describe('SyncPerformanceUseCase', () => {
  it('inserts cycles and reviews', async () => {
    const sut = makeSut();
    const result = await sut.sync.execute({
      companyId: 1,
      cycles: [cycleInput()],
      reviews: [reviewInput()],
    });
    assert.deepEqual(result, {
      cyclesUpserted: 1,
      reviewsUpserted: 1,
      cyclesDeleted: 0,
      reviewsDeleted: 0,
    });
    const stored = await sut.listCycles.execute({ companyId: 1 });
    assert.equal(stored.length, 1);
    assert.equal(stored[0]!.name, '2026 Yıl Sonu');
  });

  it('updates on re-sync and prunes rows missing from payload', async () => {
    const sut = makeSut();
    await sut.sync.execute({
      companyId: 1,
      cycles: [cycleInput()],
      reviews: [reviewInput({ id: 'pf_1' }), reviewInput({ id: 'pf_2', employeeId: 'emp_2' })],
    });
    // pf_2 payload'dan düştü + pf_1 durumu ilerledi
    const result = await sut.sync.execute({
      companyId: 1,
      prune: true,
      cycles: [cycleInput({ status: 'calibration' })],
      reviews: [reviewInput({ id: 'pf_1', status: 'completed', overallScore: 4.2 })],
    });
    assert.equal(result.reviewsDeleted, 1);
    assert.equal(result.cyclesDeleted, 0);
    const reviews = await sut.listReviews.execute({ companyId: 1 });
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0]!.status, 'completed');
    assert.ok(Math.abs(reviews[0]!.overallScore - 4.2) < 1e-5);
    const cycles = await sut.listCycles.execute({ companyId: 1 });
    assert.equal(cycles[0]!.status, 'calibration');
  });

  it('prune does not touch other companies', async () => {
    const sut = makeSut();
    await sut.sync.execute({ companyId: 1, cycles: [cycleInput({ id: 'pc_a' })], reviews: [] });
    await sut.sync.execute({ companyId: 2, cycles: [cycleInput({ id: 'pc_b' })], reviews: [] });
    const result = await sut.sync.execute({ companyId: 1, prune: true, cycles: [], reviews: [] });
    assert.equal(result.cyclesDeleted, 1);
    assert.equal((await sut.listCycles.execute({ companyId: 2 })).length, 1);
  });

  it('rejects an invalid cycle status', async () => {
    const sut = makeSut();
    await assert.rejects(
      sut.sync.execute({
        companyId: 1,
        cycles: [cycleInput({ status: 'bogus' as never })],
        reviews: [],
      }),
      PerformanceValidationError,
    );
  });

  it('rejects an invalid date string', async () => {
    const sut = makeSut();
    await assert.rejects(
      sut.sync.execute({
        companyId: 1,
        cycles: [cycleInput({ periodStart: 'not-a-date' })],
        reviews: [],
      }),
      PerformanceValidationError,
    );
  });

  it('filters reviews by cycleId in list', async () => {
    const sut = makeSut();
    await sut.sync.execute({
      companyId: 1,
      cycles: [cycleInput({ id: 'pc_1' }), cycleInput({ id: 'pc_2', name: 'Ara Dönem' })],
      reviews: [
        reviewInput({ id: 'pf_1', cycleId: 'pc_1' }),
        reviewInput({ id: 'pf_2', cycleId: 'pc_2' }),
      ],
    });
    const only = await sut.listReviews.execute({ companyId: 1, cycleId: 'pc_2' });
    assert.equal(only.length, 1);
    assert.equal(only[0]!.id, 'pf_2');
  });
});
