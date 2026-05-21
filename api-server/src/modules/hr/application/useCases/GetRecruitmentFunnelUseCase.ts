/**
 * GetRecruitmentFunnelUseCase — pozisyon bazlı (veya genel) stage huni sayımı.
 *
 * Dashboard / RecruitmentFunnel UI bileşeni için kaynak.
 */
import type { RecruitmentStage } from '../../domain/valueObjects/RecruitmentStage.js';
import type { RecruitmentFunnelDto } from '../dto/ApplicationDto.js';
import type { ApplicationRepository } from '../ports/ApplicationRepository.js';

export interface GetRecruitmentFunnelInput {
  companyId: number;
  positionId?: number;
}

export class GetRecruitmentFunnelUseCase {
  constructor(private readonly applications: ApplicationRepository) {}

  async execute(input: GetRecruitmentFunnelInput): Promise<RecruitmentFunnelDto> {
    const opts: { positionId?: number } = {};
    if (input.positionId !== undefined) opts.positionId = input.positionId;
    const map = await this.applications.countByStage(input.companyId, opts);
    const counts: Partial<Record<RecruitmentStage, number>> = {};
    for (const [stage, n] of map) {
      counts[stage] = n;
    }
    return {
      positionId: input.positionId ?? null,
      counts,
    };
  }
}
