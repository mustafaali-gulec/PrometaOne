/**
 * ApplicationStageHistoryDto — REST response için.
 */
import type { RecruitmentStage } from '../../domain/valueObjects/RecruitmentStage.js';
import type { ApplicationStageHistoryEntry } from '../ports/ApplicationStageHistoryRepository.js';

export interface ApplicationStageHistoryDto {
  id: number;
  applicationId: number;
  fromStage: RecruitmentStage | null;
  toStage: RecruitmentStage;
  changedBy: number | null;
  changedAt: string;
  note: string | null;
}

export function toApplicationStageHistoryDto(
  entry: ApplicationStageHistoryEntry,
): ApplicationStageHistoryDto {
  return {
    id: entry.id,
    applicationId: entry.applicationId,
    fromStage: entry.fromStage,
    toStage: entry.toStage,
    changedBy: entry.changedBy,
    changedAt: entry.changedAt.toISOString(),
    note: entry.note,
  };
}
