/**
 * ApplicationDto — REST response için.
 */
import type { Application } from '../../domain/entities/Application.js';
import type { RecruitmentStage } from '../../domain/valueObjects/RecruitmentStage.js';

export interface ApplicationDto {
  id: number;
  companyId: number;
  candidateId: number;
  positionId: number;
  stage: RecruitmentStage;
  stageChangedAt: string;
  stageChangedBy: number | null;
  rejectionReason: string | null;
  salaryExpectation: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toApplicationDto(a: Application): ApplicationDto {
  return {
    id: a.id,
    companyId: a.companyId,
    candidateId: a.candidateId,
    positionId: a.positionId,
    stage: a.stage,
    stageChangedAt: a.stageChangedAt.toISOString(),
    stageChangedBy: a.stageChangedBy,
    rejectionReason: a.rejectionReason,
    salaryExpectation: a.salaryExpectation,
    notes: a.notes,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

/** Recruitment dashboard için stage başına sayım. */
export interface RecruitmentFunnelDto {
  positionId: number | null;
  counts: Partial<Record<RecruitmentStage, number>>;
}
