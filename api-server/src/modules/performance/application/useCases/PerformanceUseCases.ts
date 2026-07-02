/**
 * Performans use-case'leri.
 *
 * SyncPerformance full-state yansıtmadır: istemci (App.jsx blob'u,
 * kaynak-of-truth) şirketin TÜM dönem+değerlendirmelerini gönderir; upsert +
 * (prune=true ise) payload'da olmayanların silinmesi. Sıra önemli: önce
 * dönemler (FK), sonra değerlendirmeler; prune'da önce değerlendirmeler,
 * sonra dönemler (cascade zaten kapsar ama sayım doğru kalsın diye açık).
 */
import { PerfCycle, type PerfCycleProps } from '../../domain/entities/PerfCycle.js';
import { PerfReview, type PerfReviewProps } from '../../domain/entities/PerfReview.js';
import {
  toPerfCycleDto,
  toPerfReviewDto,
  type PerfCycleDto,
  type PerfReviewDto,
  type SyncPerformanceResultDto,
} from '../dto/PerformanceDtos.js';
import type { PerfCycleRepository, PerfReviewRepository } from '../ports/PerformanceRepository.js';

export interface SyncPerformanceInput {
  companyId: number;
  cycles: Omit<PerfCycleProps, 'companyId'>[];
  reviews: Omit<PerfReviewProps, 'companyId'>[];
  prune?: boolean | undefined;
}

export class SyncPerformanceUseCase {
  constructor(
    private readonly cycles: PerfCycleRepository,
    private readonly reviews: PerfReviewRepository,
  ) {}

  async execute(input: SyncPerformanceInput): Promise<SyncPerformanceResultDto> {
    const cycleEntities = input.cycles.map((c) =>
      PerfCycle.create({ ...c, companyId: input.companyId }),
    );
    const reviewEntities = input.reviews.map((r) =>
      PerfReview.create({ ...r, companyId: input.companyId }),
    );

    const cyclesUpserted = await this.cycles.upsertMany(cycleEntities);
    const reviewsUpserted = await this.reviews.upsertMany(reviewEntities);

    let cyclesDeleted = 0;
    let reviewsDeleted = 0;
    if (input.prune === true) {
      reviewsDeleted = await this.reviews.pruneExcept(
        input.companyId,
        reviewEntities.map((r) => r.id),
      );
      cyclesDeleted = await this.cycles.pruneExcept(
        input.companyId,
        cycleEntities.map((c) => c.id),
      );
    }

    return { cyclesUpserted, reviewsUpserted, cyclesDeleted, reviewsDeleted };
  }
}

export interface ListPerfCyclesInput {
  companyId: number;
}

export class ListPerfCyclesUseCase {
  constructor(private readonly cycles: PerfCycleRepository) {}

  async execute(input: ListPerfCyclesInput): Promise<PerfCycleDto[]> {
    const list = await this.cycles.list(input.companyId);
    return list.map(toPerfCycleDto);
  }
}

export interface ListPerfReviewsInput {
  companyId: number;
  cycleId?: string | undefined;
}

export class ListPerfReviewsUseCase {
  constructor(private readonly reviews: PerfReviewRepository) {}

  async execute(input: ListPerfReviewsInput): Promise<PerfReviewDto[]> {
    const list = await this.reviews.list(input.companyId, input.cycleId);
    return list.map(toPerfReviewDto);
  }
}
