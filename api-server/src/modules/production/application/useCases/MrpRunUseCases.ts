/**
 * MRP koşu listeleme use-case'i (geçmiş snapshot'lar).
 */
import { toMrpRunSummaryDto, type MrpRunSummaryDto } from '../dto/MrpDtos.js';
import type { MrpRunRepository } from '../ports/MrpRunRepository.js';

export interface ListMrpRunsInput {
  companyId: number;
  limit?: number;
}

export class ListMrpRunsUseCase {
  constructor(private readonly runs: MrpRunRepository) {}

  async execute(input: ListMrpRunsInput): Promise<MrpRunSummaryDto[]> {
    const list = await this.runs.listByCompany(input.companyId, {
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
    });
    return list.map(toMrpRunSummaryDto);
  }
}
