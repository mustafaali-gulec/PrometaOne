/**
 * ListApplicationsForCandidateUseCase — bir adayın başvuru geçmişi.
 */
import { toApplicationDto, type ApplicationDto } from '../dto/ApplicationDto.js';
import type { ApplicationRepository } from '../ports/ApplicationRepository.js';

export interface ListApplicationsForCandidateInput {
  companyId: number;
  candidateId: number;
}

export class ListApplicationsForCandidateUseCase {
  constructor(private readonly applications: ApplicationRepository) {}

  async execute(input: ListApplicationsForCandidateInput): Promise<ReadonlyArray<ApplicationDto>> {
    const list = await this.applications.listByCompany(input.companyId, {
      candidateId: input.candidateId,
    });
    return list.map(toApplicationDto);
  }
}
