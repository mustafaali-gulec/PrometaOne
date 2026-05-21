/**
 * SubmitApplicationUseCase — bir Candidate'in bir Position'a başvurusunu kaydeder.
 *
 * Kontroller:
 *   - Candidate var ve aynı şirkette
 *   - Position var ve aynı şirkette
 *   - Position'ın status'u 'open' olmalı (closed/draft pozisyona başvuru reddedilir)
 *   - Aynı candidate'in aynı pozisyona aktif başvurusu olmamalı (DB UNIQUE
 *     fırlatırsa CandidateAlreadyAppliedToPositionError'a çevir)
 */
import { toApplicationDto, type ApplicationDto } from '../dto/ApplicationDto.js';
import {
  CandidateAlreadyAppliedToPositionError,
  CandidateNotFoundError,
  PositionNotFoundError,
  PositionNotOpenError,
} from '../errors/HrErrors.js';
import type { ApplicationRepository } from '../ports/ApplicationRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { CandidateRepository } from '../ports/CandidateRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { PositionRepository } from '../ports/PositionRepository.js';

export interface SubmitApplicationInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  candidateId: number;
  positionId: number;
  salaryExpectation?: number | null;
  notes?: string | null;
}

export class SubmitApplicationUseCase {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly candidates: CandidateRepository,
    private readonly positions: PositionRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: SubmitApplicationInput): Promise<ApplicationDto> {
    const candidate = await this.candidates.findById(input.candidateId, input.companyId);
    if (!candidate) {
      throw new CandidateNotFoundError(input.candidateId);
    }

    const position = await this.positions.findById(input.positionId, input.companyId);
    if (!position) {
      throw new PositionNotFoundError(input.positionId);
    }
    if (!position.isOpen()) {
      throw new PositionNotOpenError(position.id);
    }

    try {
      const created = await this.applications.insert({
        companyId: input.companyId,
        candidateId: input.candidateId,
        positionId: input.positionId,
        stage: 'new',
        stageChangedBy: input.actorUserId,
        rejectionReason: null,
        salaryExpectation: input.salaryExpectation ?? null,
        notes: input.notes ?? null,
      });

      await this.audit.log({
        actorUserId: input.actorUserId,
        actorUsername: input.actorUsername,
        companyId: input.companyId,
        action: 'hr.application.submitted',
        details: {
          id: created.id,
          candidateId: created.candidateId,
          positionId: created.positionId,
        },
        at: this.clock.now(),
      });

      return toApplicationDto(created);
    } catch (err) {
      // PG UNIQUE constraint (uq_applications_active_unique) → typed error
      if (err instanceof Error && (err as Error & { code?: string }).code === '23505') {
        throw new CandidateAlreadyAppliedToPositionError(input.candidateId, input.positionId);
      }
      throw err;
    }
  }
}
