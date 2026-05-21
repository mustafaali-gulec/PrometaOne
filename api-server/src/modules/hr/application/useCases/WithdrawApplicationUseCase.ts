/**
 * WithdrawApplicationUseCase — Application stage'ini 'withdrawn'a taşır.
 * Genelde candidate'ın talebi üzerine — actor başvuruyu çeker.
 */
import { toApplicationDto, type ApplicationDto } from '../dto/ApplicationDto.js';
import { ApplicationNotFoundError } from '../errors/HrErrors.js';
import type { ApplicationRepository } from '../ports/ApplicationRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface WithdrawApplicationInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  applicationId: number;
  note?: string;
}

export class WithdrawApplicationUseCase {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: WithdrawApplicationInput): Promise<ApplicationDto> {
    const existing = await this.applications.findById(input.applicationId, input.companyId);
    if (!existing) {
      throw new ApplicationNotFoundError(input.applicationId);
    }

    const withdrawn = existing.transitionTo('withdrawn', this.clock.now(), input.actorUserId);
    await this.applications.update(withdrawn);

    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.application.withdrawn',
      details: {
        applicationId: existing.id,
        fromStage: existing.stage,
        note: input.note ?? null,
      },
      at: this.clock.now(),
    });

    return toApplicationDto(withdrawn);
  }
}
