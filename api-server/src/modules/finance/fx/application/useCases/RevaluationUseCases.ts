/**
 * Kur farkı değerleme use-case'leri: Create, Post, List.
 *
 * CreateRevaluation: referans + değerleme tarihindeki USD/EUR kurlarını
 * repository'den okur, RevaluationCalculator ile gain/loss hesaplar, kaydeder
 * (posted=false). PostRevaluation: muhasebeleştirir.
 */
import type { Clock } from '../../../application/ports/Clock.js';
import { Money } from '../../../domain/valueObjects/Money.js';
import { Revaluation } from '../../domain/entities/Revaluation.js';
import { RateNotAvailableError, RevaluationNotFoundError } from '../../domain/errors/FxErrors.js';
import {
  RevaluationCalculator,
  type RevaluationPosition,
} from '../../domain/services/RevaluationCalculator.js';
import type { ExchangeRateRepository, RevaluationRepository } from '../ports/FxPorts.js';

export interface CreateRevaluationInput {
  companyId: number;
  referenceDate: string;
  valuationDate: string;
  /** Döviz pozisyonları: { label, currency: 'USD'|'EUR', foreignAmountMajor }. */
  positions: ReadonlyArray<{ label: string; currency: 'USD' | 'EUR'; foreignAmountMajor: number }>;
  actorUserId: number | null;
}

export class CreateRevaluationUseCase {
  constructor(
    private readonly revaluations: RevaluationRepository,
    private readonly rates: ExchangeRateRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateRevaluationInput): Promise<Revaluation> {
    const [usd1, usd2, eur1, eur2] = await Promise.all([
      this.rateAt('USD', input.referenceDate),
      this.rateAt('USD', input.valuationDate),
      this.rateAt('EUR', input.referenceDate),
      this.rateAt('EUR', input.valuationDate),
    ]);

    const positions: RevaluationPosition[] = input.positions.map((p) => ({
      label: p.label,
      currency: p.currency,
      foreignAmount: Money.fromMajor(p.foreignAmountMajor, p.currency),
    }));

    const result = RevaluationCalculator.compute(positions, { usd1, usd2, eur1, eur2 });

    const revaluation = Revaluation.fromResult({
      companyId: input.companyId,
      referenceDate: input.referenceDate,
      valuationDate: input.valuationDate,
      rates: { usd1, usd2, eur1, eur2 },
      result,
      createdBy: input.actorUserId,
      createdAt: this.clock.now(),
    });

    return this.revaluations.insert(revaluation);
  }

  private async rateAt(currency: 'USD' | 'EUR', date: string): Promise<number> {
    const r = await this.rates.getAt(currency, date);
    if (r === null) {
      throw new RateNotAvailableError(currency, date);
    }
    return r.rate;
  }
}

export class PostRevaluationUseCase {
  constructor(
    private readonly revaluations: RevaluationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { companyId: number; revaluationId: number }): Promise<Revaluation> {
    const found = await this.revaluations.findById(input.revaluationId, input.companyId);
    if (!found) {
      throw new RevaluationNotFoundError(input.revaluationId);
    }
    const posted = found.post(this.clock.now());
    await this.revaluations.update(posted);
    return posted;
  }
}

export class ListRevaluationsUseCase {
  constructor(private readonly revaluations: RevaluationRepository) {}

  execute(input: { companyId: number }): Promise<ReadonlyArray<Revaluation>> {
    return this.revaluations.listByCompany(input.companyId);
  }
}
