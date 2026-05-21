/**
 * UpdateCandidateUseCase — Candidate'ın profil bilgilerini günceller.
 */
import type { CandidateSource } from '../../domain/valueObjects/CandidateSource.js';
import { PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';
import { toCandidateDto, type CandidateDto } from '../dto/CandidateDto.js';
import { CandidateNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { CandidateRepository } from '../ports/CandidateRepository.js';
import type { Clock } from '../ports/Clock.js';

export interface UpdateCandidateInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  source?: CandidateSource;
  cvUrl?: string | null;
  notes?: string | null;
}

export class UpdateCandidateUseCase {
  constructor(
    private readonly candidates: CandidateRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: UpdateCandidateInput): Promise<CandidateDto> {
    const existing = await this.candidates.findById(input.id, input.companyId);
    if (!existing) {
      throw new CandidateNotFoundError(input.id);
    }

    const updates: Parameters<typeof existing.updateProfile>[0] = {};
    if (input.firstName !== undefined) updates.firstName = input.firstName;
    if (input.lastName !== undefined) updates.lastName = input.lastName;
    if (input.email !== undefined) updates.email = input.email;
    if (input.phone !== undefined) {
      updates.phone = input.phone === null ? null : PhoneNumber.create(input.phone);
    }
    if (input.source !== undefined) updates.source = input.source;
    if (input.cvUrl !== undefined) updates.cvUrl = input.cvUrl;
    if (input.notes !== undefined) updates.notes = input.notes;

    const updated = existing.updateProfile(updates, this.clock.now());
    if (updated === existing) {
      return toCandidateDto(existing);
    }

    await this.candidates.update(updated);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.candidate.updated',
      details: { id: updated.id },
      at: this.clock.now(),
    });

    return toCandidateDto(updated);
  }
}
