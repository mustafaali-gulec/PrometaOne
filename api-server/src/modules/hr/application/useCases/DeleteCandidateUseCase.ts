/**
 * DeleteCandidateUseCase — Candidate'ı havuzdan kaldırır.
 *
 * Aktif başvurusu varsa CandidateHasActiveApplicationsError fırlatır
 * (terminal stage'lerdeki application'lar tarihsel iz olarak kalır,
 * yine de application FK ON DELETE RESTRICT — DB tarafında garanti).
 */
import { CandidateHasActiveApplicationsError, CandidateNotFoundError } from '../errors/HrErrors.js';
import type { ApplicationRepository } from '../ports/ApplicationRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { CandidateRepository } from '../ports/CandidateRepository.js';
import type { Clock } from '../ports/Clock.js';

export interface DeleteCandidateInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
}

export class DeleteCandidateUseCase {
  constructor(
    private readonly candidates: CandidateRepository,
    private readonly applications: ApplicationRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: DeleteCandidateInput): Promise<void> {
    const c = await this.candidates.findById(input.id, input.companyId);
    if (!c) {
      throw new CandidateNotFoundError(input.id);
    }

    const hasActive = await this.applications.hasActiveApplicationsForCandidate(
      c.id,
      input.companyId,
    );
    if (hasActive) {
      throw new CandidateHasActiveApplicationsError(c.id);
    }

    await this.candidates.remove(c.id, input.companyId);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.candidate.deleted',
      details: { id: c.id, fullName: c.fullName },
      at: this.clock.now(),
    });
  }
}
