/**
 * Revaluation — bir kur farkı değerleme snapshot'ı (revaluations tablosu, 006).
 *
 * RevaluationCalculator çıktısını + referans/değerleme tarihleri + kurları +
 * muhasebeleşme (posted) durumunu tutar. Immutable; post() yeni instance döner.
 */
import type { Money } from '../../../domain/valueObjects/Money.js';
import { InvalidExchangeRateError } from '../errors/FxErrors.js';
import type {
  RevaluationLineResult,
  RevaluationResult,
} from '../services/RevaluationCalculator.js';

export interface RevaluationProps {
  id: number | null;
  companyId: number;
  referenceDate: string;
  valuationDate: string;
  usdRate1: number;
  usdRate2: number;
  eurRate1: number;
  eurRate2: number;
  gainTotal: Money;
  lossTotal: Money;
  net: Money;
  details: ReadonlyArray<RevaluationLineResult>;
  posted: boolean;
  postedAt: Date | null;
  createdBy: number | null;
  createdAt: Date;
}

export class Revaluation {
  private constructor(private readonly props: RevaluationProps) {}

  static create(props: RevaluationProps): Revaluation {
    if (props.valuationDate < props.referenceDate) {
      throw new InvalidExchangeRateError(
        `değerleme tarihi (${props.valuationDate}) referans tarihinden (${props.referenceDate}) önce olamaz`,
      );
    }
    return new Revaluation({ ...props });
  }

  /** Hesaplama sonucundan yeni (kaydedilmemiş) değerleme kurar. */
  static fromResult(input: {
    companyId: number;
    referenceDate: string;
    valuationDate: string;
    rates: { usd1: number; usd2: number; eur1: number; eur2: number };
    result: RevaluationResult;
    createdBy: number | null;
    createdAt: Date;
  }): Revaluation {
    return Revaluation.create({
      id: null,
      companyId: input.companyId,
      referenceDate: input.referenceDate,
      valuationDate: input.valuationDate,
      usdRate1: input.rates.usd1,
      usdRate2: input.rates.usd2,
      eurRate1: input.rates.eur1,
      eurRate2: input.rates.eur2,
      gainTotal: input.result.gainTotal,
      lossTotal: input.result.lossTotal,
      net: input.result.net,
      details: input.result.lines,
      posted: false,
      postedAt: null,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
    });
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get net(): Money {
    return this.props.net;
  }
  get posted(): boolean {
    return this.props.posted;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }

  withId(id: number): Revaluation {
    return new Revaluation({ ...this.props, id });
  }

  /** Muhasebeleştir (idempotent: zaten posted ise aynı instance). */
  post(now: Date): Revaluation {
    if (this.props.posted) return this;
    return new Revaluation({ ...this.props, posted: true, postedAt: now });
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      referenceDate: this.props.referenceDate,
      valuationDate: this.props.valuationDate,
      usdRate1: this.props.usdRate1,
      usdRate2: this.props.usdRate2,
      eurRate1: this.props.eurRate1,
      eurRate2: this.props.eurRate2,
      gainTotal: this.props.gainTotal.toDecimalString(),
      lossTotal: this.props.lossTotal.toDecimalString(),
      net: this.props.net.toDecimalString(),
      details: this.props.details,
      posted: this.props.posted,
      postedAt: this.props.postedAt ? this.props.postedAt.toISOString() : null,
    };
  }
}
