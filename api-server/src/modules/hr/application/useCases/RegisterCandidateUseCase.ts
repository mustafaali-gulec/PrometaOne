/**
 * RegisterCandidateUseCase — yeni Candidate'ı havuza kaydeder.
 *
 * Phone (varsa) PhoneNumber tarafından normalize edilir.
 */
import type { CandidateSource } from '../../domain/valueObjects/CandidateSource.js';
import { PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';
import { toCandidateDto, type CandidateDto } from '../dto/CandidateDto.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { CandidateRepository } from '../ports/CandidateRepository.js';
import type { Clock } from '../ports/Clock.js';

export interface RegisterCandidateInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  source?: CandidateSource;
  cvUrl?: string | null;
  notes?: string | null;
}

export class RegisterCandidateUseCase {
  constructor(
    private readonly candidates: CandidateRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: RegisterCandidateInput): Promise<CandidateDto> {
    let normalizedPhone: string | null = null;
    if (input.phone !== undefined && input.phone !== null) {
      normalizedPhone = PhoneNumber.create(input.phone).value;
    }

    const created = await this.candidates.insert({
      companyId: input.companyId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      phone: normalizedPhone,
      source: input.source ?? 'direct',
      cvUrl: input.cvUrl ?? null,
      notes: input.notes ?? null,
    });

    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.candidate.registered',
      details: {
        id: created.id,
        fullName: created.fullName,
        source: created.source,
      },
      at: this.clock.now(),
    });

    return toCandidateDto(created);
  }
}
