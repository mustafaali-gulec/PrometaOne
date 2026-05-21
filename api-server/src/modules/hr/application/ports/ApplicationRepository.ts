/**
 * ApplicationRepository — port.
 *
 * Concrete: infrastructure/persistence/PgApplicationRepository.ts (PR 4'te).
 *
 * Önemli: insert() bir Candidate'in aynı Position'a aktif başvurusu varsa
 * UNIQUE constraint hatası (PG kodu '23505') fırlatır. Use-case bunu yakalar
 * ve CandidateAlreadyAppliedToPositionError'a dönüştürür.
 */
import type { Application } from '../../domain/entities/Application.js';
import type { RecruitmentStage } from '../../domain/valueObjects/RecruitmentStage.js';

export interface ApplicationRepository {
  insert(input: NewApplicationInput): Promise<Application>;

  update(application: Application): Promise<void>;

  findById(id: number, companyId: number): Promise<Application | null>;

  listByCompany(
    companyId: number,
    options?: {
      positionId?: number;
      candidateId?: number;
      stage?: RecruitmentStage;
    },
  ): Promise<ReadonlyArray<Application>>;

  /**
   * Recruitment dashboard için stage başına sayım.
   * positionId verilirse o pozisyona daraltır.
   */
  countByStage(
    companyId: number,
    options?: { positionId?: number },
  ): Promise<ReadonlyMap<RecruitmentStage, number>>;

  /** Bu candidate'in aktif (terminal olmayan) bir başvurusu var mı? */
  hasActiveApplicationsForCandidate(candidateId: number, companyId: number): Promise<boolean>;
}

export interface NewApplicationInput {
  companyId: number;
  candidateId: number;
  positionId: number;
  stage: RecruitmentStage;
  stageChangedBy: number | null;
  rejectionReason: string | null;
  salaryExpectation: number | null;
  notes: string | null;
}
