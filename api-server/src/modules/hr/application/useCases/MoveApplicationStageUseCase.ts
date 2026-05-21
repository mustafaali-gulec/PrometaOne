/**
 * MoveApplicationStageUseCase — Application stage'ini bir sonraki aşamaya taşır.
 *
 * Hedef stage 'hired', 'rejected', 'withdrawn' olabilir; ancak 'hired' için
 * HireFromApplicationUseCase kullanılması ÖNERİLİR (Employee tarafına yansıma için).
 * Bu use-case sadece stage geçişini uygular — Employee oluşturmaz.
 */
import type { RecruitmentStage } from '../../domain/valueObjects/RecruitmentStage.js';
import { toApplicationDto, type ApplicationDto } from '../dto/ApplicationDto.js';
import { ApplicationNotFoundError } from '../errors/HrErrors.js';
import type { ApplicationRepository } from '../ports/ApplicationRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';

export interface MoveApplicationStageInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  applicationId: number;
  newStage: RecruitmentStage;
  rejectionReason?: string | null;
}

export class MoveApplicationStageUseCase {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: MoveApplicationStageInput): Promise<ApplicationDto> {
    const existing = await this.applications.findById(input.applicationId, input.companyId);
    if (!existing) {
      throw new ApplicationNotFoundError(input.applicationId);
    }

    const transitioned = existing.transitionTo(
      input.newStage,
      this.clock.now(),
      input.actorUserId,
      {
        rejectionReason: input.rejectionReason ?? null,
      },
    );
    if (transitioned === existing) {
      return toApplicationDto(existing);
    }

    await this.applications.update(transitioned);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.application.stage_moved',
      details: {
        applicationId: existing.id,
        fromStage: existing.stage,
        toStage: input.newStage,
      },
      at: this.clock.now(),
    });

    return toApplicationDto(transitioned);
  }
}
