/**
 * Expense — Şantiye gideri. Tablo: cs_expenses (026_cs_finance.sql). Immutable.
 */
import { FxInfo } from '../../../../shared/fx/FxInfo.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';

export interface ExpenseProps {
  id: number;
  companyId: number;
  projectId: number;
  boqLineId: number | null;
  vendorId: number | null;
  invoiceId: number | null;
  category: string;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  spentAt: string;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  /** DÖVİZ (004): dövizli giderde kayıt anında DONDURULAN kur. */
  fx?: FxInfo;
  /** amount'ın TRY karşılığı; kur bilinmiyorsa null. */
  amountTRY?: number | null;
}

/** fx alanları çözülmüş iç gösterim. */
type ResolvedExpenseProps = ExpenseProps & { fx: FxInfo; amountTRY: number | null };

export interface ExpenseUpdate {
  boqLineId?: number | null;
  vendorId?: number | null;
  invoiceId?: number | null;
  category?: string;
  description?: string | null;
  amount?: number;
  currency?: CurrencyCode;
  spentAt?: string;
  fxRate?: number | null;
  fxRateSource?: string | null;
  fxRateDate?: string | null;
}

export class Expense {
  private constructor(private readonly props: Readonly<ResolvedExpenseProps>) {}

  static create(props: ExpenseProps): Expense {
    if (props.id <= 0) throw new Error('Expense.id pozitif olmalı');
    if (props.projectId <= 0) throw new Error('Expense.projectId pozitif olmalı');
    if (props.amount < 0) throw new Error('Expense.amount negatif olamaz');
    // fx verilmezse: TRY ise dövizsiz, değilse "kur bilinmiyor" (rate=null).
    const fx = props.fx ?? FxInfo.fromInput({ currency: props.currency });
    const amountTRY = props.amountTRY !== undefined ? props.amountTRY : fx.toTRY(props.amount);
    return new Expense({ ...props, fx, amountTRY });
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get projectId(): number {
    return this.props.projectId;
  }
  get boqLineId(): number | null {
    return this.props.boqLineId;
  }
  get vendorId(): number | null {
    return this.props.vendorId;
  }
  get invoiceId(): number | null {
    return this.props.invoiceId;
  }
  get category(): string {
    return this.props.category;
  }
  get description(): string | null {
    return this.props.description;
  }
  get amount(): number {
    return this.props.amount;
  }
  /** DÖVİZ (004): kayda dondurulmuş kur bilgisi. */
  get fx(): FxInfo {
    return this.props.fx;
  }
  /** amount'ın TRY karşılığı; kur bilinmiyorsa null. */
  get amountTRY(): number | null {
    return this.props.amountTRY;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
  }
  get spentAt(): string {
    return this.props.spentAt;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(c: ExpenseUpdate, now: Date): Expense {
    const amount = c.amount !== undefined ? c.amount : this.props.amount;
    if (amount < 0) throw new Error('Expense.amount negatif olamaz');
    // DÖVİZ: kur alanı gelmediyse kaydın DONDURULMUŞ kuru korunur.
    const fx = FxInfo.fromInput({
      currency: c.currency ?? this.props.currency,
      fxRate: c.fxRate !== undefined ? c.fxRate : this.props.fx.rate,
      fxRateSource: c.fxRateSource !== undefined ? c.fxRateSource : this.props.fx.source,
      fxRateDate: c.fxRateDate !== undefined ? c.fxRateDate : this.props.fx.rateDate,
    });
    return new Expense({
      ...this.props,
      boqLineId: c.boqLineId !== undefined ? c.boqLineId : this.props.boqLineId,
      vendorId: c.vendorId !== undefined ? c.vendorId : this.props.vendorId,
      invoiceId: c.invoiceId !== undefined ? c.invoiceId : this.props.invoiceId,
      category: c.category ?? this.props.category,
      description: c.description !== undefined ? c.description : this.props.description,
      amount,
      currency: c.currency ?? this.props.currency,
      spentAt: c.spentAt ?? this.props.spentAt,
      updatedAt: now,
      fx,
      amountTRY: fx.toTRY(amount),
    });
  }

  toJSON(): Omit<Readonly<ExpenseProps>, 'fx'> & {
    currency: CurrencyCode;
    fxRate: number | null;
    fxRateSource: string | null;
    fxRateDate: string | null;
    amountTRY: number | null;
  } {
    const { fx, ...rest } = this.props;
    return { ...rest, ...fx.toJSON(), currency: this.props.currency };
  }
}
