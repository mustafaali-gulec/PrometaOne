import { describe, it, expect } from 'vitest';

import {
  ratingKeyFromScore,
  goalsAvg,
  competenciesAvg,
  computeOverall,
  buildReview,
  effectiveRating,
  perfCompScorePercent,
  type PerfCycle,
} from '../model';

const cycle = (over: Partial<PerfCycle> = {}): PerfCycle => ({
  id: 'c1',
  name: 'Test',
  status: 'active',
  selfAssessment: true,
  competenciesEnabled: true,
  scaleMax: 5,
  weightGoals: 60,
  weightCompetencies: 40,
  ...over,
});

describe('ratingKeyFromScore', () => {
  it('maps score/scaleMax ratio to bands', () => {
    expect(ratingKeyFromScore(5, 5)).toBe('outstanding'); // 1.0
    expect(ratingKeyFromScore(4, 5)).toBe('exceeds'); // 0.8
    expect(ratingKeyFromScore(3, 5)).toBe('meets'); // 0.6
    expect(ratingKeyFromScore(2, 5)).toBe('partially'); // 0.4
    expect(ratingKeyFromScore(1, 5)).toBe('below'); // 0.2
  });
  it('returns null for no score', () => {
    expect(ratingKeyFromScore(0, 5)).toBeNull();
  });
  it('respects a custom scale', () => {
    expect(ratingKeyFromScore(9, 10)).toBe('outstanding'); // 0.9
    expect(ratingKeyFromScore(6, 10)).toBe('meets'); // 0.6
  });
});

describe('goalsAvg', () => {
  it('is weighted by goal.weight (manager scores)', () => {
    const goals = [
      { id: 'g1', title: 'A', weight: 75, managerScore: 4, selfScore: 5 },
      { id: 'g2', title: 'B', weight: 25, managerScore: 2, selfScore: 1 },
    ];
    // (4*75 + 2*25) / 100 = 3.5
    expect(goalsAvg(goals, true)).toBeCloseTo(3.5, 5);
    // self: (5*75 + 1*25)/100 = 4.0
    expect(goalsAvg(goals, false)).toBeCloseTo(4.0, 5);
  });
  it('treats missing weights as equal', () => {
    const goals = [
      { id: 'g1', title: 'A', managerScore: 4 },
      { id: 'g2', title: 'B', managerScore: 2 },
    ];
    expect(goalsAvg(goals, true)).toBeCloseTo(3, 5);
  });
  it('ignores unscored goals', () => {
    const goals = [
      { id: 'g1', title: 'A', managerScore: 4 },
      { id: 'g2', title: 'B', managerScore: 0 },
    ];
    expect(goalsAvg(goals, true)).toBeCloseTo(4, 5);
  });
});

describe('competenciesAvg', () => {
  it('averages scored competencies', () => {
    const comps = [
      { key: 'a', managerScore: 4 },
      { key: 'b', managerScore: 2 },
      { key: 'c', managerScore: 0 },
    ];
    expect(competenciesAvg(comps, true)).toBeCloseTo(3, 5);
  });
});

describe('computeOverall', () => {
  it('blends goals and competencies by cycle weights', () => {
    const review = buildReview(cycle(), { id: 'e1' }, null);
    review.goals = [{ id: 'g1', title: 'A', weight: 100, managerScore: 4 }];
    review.competencies = [{ key: 'a', managerScore: 2 }];
    // goals=4 (w60), comps=2 (w40) -> (4*60 + 2*40)/100 = 3.2
    expect(computeOverall(review, cycle(), true)).toBeCloseTo(3.2, 5);
  });
  it('uses only goals when competencies disabled', () => {
    const c = cycle({ competenciesEnabled: false });
    const review = buildReview(c, { id: 'e1' }, null);
    review.goals = [{ id: 'g1', title: 'A', weight: 100, managerScore: 5 }];
    expect(computeOverall(review, c, true)).toBeCloseTo(5, 5);
  });
  it('re-weights when one component is unscored', () => {
    const review = buildReview(cycle(), { id: 'e1' }, null);
    review.goals = [{ id: 'g1', title: 'A', weight: 100, managerScore: 4 }];
    review.competencies = [{ key: 'a', managerScore: 0 }]; // unscored
    // only goals count -> 4
    expect(computeOverall(review, cycle(), true)).toBeCloseTo(4, 5);
  });
});

describe('buildReview', () => {
  it('starts self_pending when self-assessment is on', () => {
    const r = buildReview(cycle({ selfAssessment: true }), { id: 'e1' }, 'boss');
    expect(r.status).toBe('self_pending');
    expect(r.reviewerUserId).toBe('boss');
    expect(r.competencies.length).toBe(6); // default set
  });
  it('starts manager_pending and no competencies when disabled', () => {
    const r = buildReview(
      cycle({ selfAssessment: false, competenciesEnabled: false }),
      { id: 'e1' },
      null,
    );
    expect(r.status).toBe('manager_pending');
    expect(r.competencies.length).toBe(0);
    expect(r.reviewerUserId).toBeNull();
  });
});

describe('perfCompScorePercent', () => {
  it('normalizes overall score to 0-100 by scale', () => {
    const review = buildReview(cycle(), { id: 'e1' }, null);
    review.overallScore = 4.87; // 4.87/5 -> 97.4
    expect(perfCompScorePercent(review, cycle())).toBeCloseTo(97.4, 5);
    review.overallScore = 3.07;
    expect(perfCompScorePercent(review, cycle())).toBeCloseTo(61.4, 5);
  });
  it('returns null when unscored', () => {
    const review = buildReview(cycle(), { id: 'e1' }, null);
    expect(perfCompScorePercent(review, cycle())).toBeNull();
  });
  it('uses calibrated band midpoint when calibration differs', () => {
    const review = buildReview(cycle(), { id: 'e1' }, null);
    review.overallScore = 4.87; // derived: outstanding
    review.calibratedRatingKey = 'exceeds'; // aşağı kalibre -> band ortası 80
    expect(perfCompScorePercent(review, cycle())).toBeCloseTo(80, 5);
    review.calibratedRatingKey = 'outstanding'; // derived ile aynı -> ham skor
    expect(perfCompScorePercent(review, cycle())).toBeCloseTo(97.4, 5);
  });
  it('respects a custom scale', () => {
    const c = cycle({ scaleMax: 10 });
    const review = buildReview(c, { id: 'e1' }, null);
    review.overallScore = 7.5; // 7.5/10 -> 75
    expect(perfCompScorePercent(review, c)).toBeCloseTo(75, 5);
  });
});

describe('effectiveRating', () => {
  it('prefers the calibrated rating', () => {
    const review = buildReview(cycle(), { id: 'e1' }, null);
    review.overallScore = 3; // -> meets
    review.ratingKey = 'meets';
    review.calibratedRatingKey = 'exceeds';
    expect(effectiveRating(review, cycle())).toBe('exceeds');
  });
  it('falls back to derived rating from score', () => {
    const review = buildReview(cycle(), { id: 'e1' }, null);
    review.overallScore = 4.6; // 0.92 -> outstanding
    expect(effectiveRating(review, cycle())).toBe('outstanding');
  });
});
