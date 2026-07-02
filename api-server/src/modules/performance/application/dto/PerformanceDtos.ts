/**
 * Performans REST-sınır DTO'ları.
 *
 * Entity alanları zaten ISO string / primitive olduğundan DTO birebir
 * yansımadır; FE modules/performance model.ts tipleriyle el ile senkron
 * tutulur (paylaşılan paket yok).
 */
import type {
  PerfCompetencyDef,
  PerfCycle,
  PerfCycleStatus,
} from '../../domain/entities/PerfCycle.js';
import type {
  PerfCompetency,
  PerfGoal,
  PerfRatingKey,
  PerfReview,
  PerfReviewStatus,
} from '../../domain/entities/PerfReview.js';

export interface PerfCycleDto {
  id: string;
  companyId: number;
  name: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: PerfCycleStatus;
  selfAssessment: boolean;
  competenciesEnabled: boolean;
  scaleMax: number;
  weightGoals: number;
  weightCompetencies: number;
  competencyDefs: PerfCompetencyDef[];
  createdBy: string | null;
  activatedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PerfReviewDto {
  id: string;
  companyId: number;
  cycleId: string;
  employeeId: string;
  reviewerUserId: string | null;
  status: PerfReviewStatus;
  goals: PerfGoal[];
  competencies: PerfCompetency[];
  selfOverallComment: string;
  managerOverallComment: string;
  selfSubmittedAt: string | null;
  managerSubmittedAt: string | null;
  managerUserId: string | null;
  overallScore: number;
  ratingKey: PerfRatingKey | null;
  calibratedRatingKey: PerfRatingKey | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function toPerfCycleDto(cycle: PerfCycle): PerfCycleDto {
  return { ...cycle.toJSON() };
}

export function toPerfReviewDto(review: PerfReview): PerfReviewDto {
  return { ...review.toJSON() };
}

export interface SyncPerformanceResultDto {
  cyclesUpserted: number;
  reviewsUpserted: number;
  cyclesDeleted: number;
  reviewsDeleted: number;
}
