/**
 * RejectApplicationUseCase — Application stage'ini 'rejected'a taşır.
 *
 * MoveApplicationStageUseCase ile temelde aynı, ama daha açıklayıcı bir
 * use-case (REST route'unda /reject endpoint'i için).
 */
import { toApplicationDto, type ApplicationDto } from '../dto/ApplicationDto.js';
import { ApplicationNotFoundError } from '../errors/HrErrors.js';
import type { ApplicationRepository } from '../ports/ApplicationRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface RejectApplicationInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  applicationId: number;
  reason: string;
}

export class RejectApplicationUseCase {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: RejectApplicationInput): Promise<ApplicationDto> {
    const existing = await this.applications.findById(input.applicationId, input.companyId);
    if (!existing) {
      throw new ApplicationNotFoundError(input.applicationId);
    }

    const rejected = existing.transitionTo('rejected', this.clock.now(), input.actorUserId, {
      rejectionReason: input.reason,
    });
    await this.applications.update(rejected);

    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.application.rejected',
      details: {
        applicationId: existing.id,
        fromStage: existing.stage,
        reason: input.reason,
      },
      at: this.clock.now(),
    });

    return toApplicationDto(rejected);
  }
}
