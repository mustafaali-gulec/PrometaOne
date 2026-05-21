/**
 * ListApplicationsForPositionUseCase — bir pozisyona gelen başvuruları döner.
 */
import type { RecruitmentStage } from '../../domain/valueObjects/RecruitmentStage.js';
import { toApplicationDto, type ApplicationDto } from '../dto/ApplicationDto.js';
import type { ApplicationRepository } from '../ports/ApplicationRepository.js';

export interface ListApplicationsForPositionInput {
  companyId: number;
  positionId: number;
  stage?: RecruitmentStage;
}

export class ListApplicationsForPositionUseCase {
  constructor(private readonly applications: ApplicationRepository) {}

  async execute(input: ListApplicationsForPositionInput): Promise<ReadonlyArray<ApplicationDto>> {
    const opts: { positionId: number; stage?: RecruitmentStage } = {
      positionId: input.positionId,
    };
    if (input.stage !== undefined) opts.stage = input.stage;
    const list = await this.applications.listByCompany(input.companyId, opts);
    return list.map(toApplicationDto);
  }
}
