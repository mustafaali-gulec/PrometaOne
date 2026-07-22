/**
 * AdoptHrRecruiting DTO'ları — blob (promet:data) işe alım çekirdeğinin
 * (hrPositions + hrCandidates + hrApplications) tek seferlik, idempotent
 * devralınması (POST /v1/hr/recruiting/adopt-blob). Emsal: AdoptHrOrgDtos.
 *
 * Girdi blob alan adlarıyla GEVŞEK gelir (appstate/domain/HrProjection.ts'te
 * doğrulanmış eşlemeden):
 *   positions    ← hrPositions    = { id:"pos_...", title, departmentId, status
 *                                     (open|on_hold|filled|closed), headcount,
 *                                     brutMinSalary, brutMaxSalary,
 *                                     jobDescription, requirements, location }
 *   candidates   ← hrCandidates   = { id:"cand_...", firstName, lastName,
 *                                     email?, phone?, source?
 *                                     (CANDIDATE_SOURCES), notes?, cvUrl? }
 *   applications ← hrApplications = { id:"app_...", candidateId, positionId,
 *                                     stage (RECRUITMENT_STAGES), notes?,
 *                                     salaryExpectation?, createdAt, updatedAt }
 *
 * Enum eşlemeleri HrProjection'daki haritalarla yapılır (TEK KAYNAK):
 * POSITION_STATUS_MAP / CANDIDATE_SOURCE_MAP / APPLICATION_STAGE_MAP
 * (cv_review/phone_screen→screening, technical/hr_interview/reference→
 * interview, offer/hired/rejected/withdrawn→aynı).
 *
 * Şemada kolonu olmayan blob alanları taşınmaz (positions.requirements/
 * location, candidateId/positionId'siz ilan-inbox başvuruları düşer).
 */
import type { CandidateSource } from '../../domain/valueObjects/CandidateSource.js';
import type { PositionStatus } from '../../domain/valueObjects/PositionStatus.js';
import type { RecruitmentStage } from '../../domain/valueObjects/RecruitmentStage.js';

// ===== Girdi (gevşek blob kayıtları) ========================================

export interface AdoptHrRecruitingInput {
  companyId: number;
  positions?: ReadonlyArray<Record<string, unknown>> | undefined;
  candidates?: ReadonlyArray<Record<string, unknown>> | undefined;
  applications?: ReadonlyArray<Record<string, unknown>> | undefined;
}

// ===== Normalize satırlar (repository sözleşmesi) ===========================

export interface NormalizedAdoptPosition {
  clientId: string;
  title: string;
  description: string | null;
  status: PositionStatus;
  headcountTarget: number;
  minSalary: number | null;
  maxSalary: number | null;
  /**
   * Blob departman referansı — hrDepartments MEZUN olduğundan eski "dept_..."
   * client-id'si VEYA önbellekten gelen SAYISAL sunucu id'si olabilir. Repo
   * DB'deki geçerli kümeyle (client_id haritası + sayısal id doğrulaması)
   * çözer; çözülemezse NULL (nullable FK).
   */
  departmentRef: string | null;
}

export interface NormalizedAdoptCandidate {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: CandidateSource;
  cvUrl: string | null;
  notes: string | null;
}

export interface NormalizedAdoptApplication {
  clientId: string;
  /**
   * Blob hrCandidates/hrPositions id'si — repo önce BU çağrının idMap'inden,
   * sonra DB'deki client_id'lerden (önceki adopt), en son geçerli SAYISAL
   * sunucu id'sinden çözer; çözülemezse satır düşer (NOT NULL FK'lar) —
   * transaction bozulmaz.
   */
  candidateRef: string;
  positionRef: string;
  stage: RecruitmentStage;
  stageChangedAt: string | null;
  rejectionReason: string | null;
  salaryExpectation: number | null;
  notes: string | null;
}

// ===== Sonuç ================================================================

export interface AdoptHrRecruitingResultDto {
  adopted: { positions: number; candidates: number; applications: number };
  /** clientId → serverId (positions/candidates/applications SERIAL id). */
  idMap: {
    positions: Record<string, number>;
    candidates: Record<string, number>;
    applications: Record<string, number>;
  };
}
