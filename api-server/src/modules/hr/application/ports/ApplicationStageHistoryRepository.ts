/**
 * ApplicationStageHistoryRepository — Application stage geçişlerinin
 * audit trail'i.
 *
 * Concrete: infrastructure/persistence/PgApplicationStageHistoryRepository.ts (PR 4).
 *
 * NOT: 012_hr.sql migration'ında stage history'yi otomatik dolduran bir
 * DB trigger var. Ama domain ihtiyaçları için (örn. stage'ler arası ortalama
 * süre raporları) bu interface üzerinden de explicit yazılabilir.
 */
import type { RecruitmentStage } from '../../domain/valueObjects/RecruitmentStage.js';

export interface ApplicationStageHistoryEntry {
  id: number;
  applicationId: number;
  fromStage: RecruitmentStage | null;
  toStage: RecruitmentStage;
  changedBy: number | null;
  changedAt: Date;
  note: string | null;
}

export interface ApplicationStageHistoryRepository {
  /**
   * Bir application için stage history'sini kronolojik (en eski önce) döner.
   */
  findByApplication(applicationId: number): Promise<ReadonlyArray<ApplicationStageHistoryEntry>>;

  /**
   * Explicit history kaydı oluşturur. Trigger zaten otomatik kaydetse de
   * domain'in açık bir not ekleme ihtiyacı olabilir.
   */
  record(input: NewApplicationStageHistoryInput): Promise<ApplicationStageHistoryEntry>;
}

export interface NewApplicationStageHistoryInput {
  applicationId: number;
  fromStage: RecruitmentStage | null;
  toStage: RecruitmentStage;
  changedBy: number | null;
  changedAt: Date;
  note: string | null;
}
