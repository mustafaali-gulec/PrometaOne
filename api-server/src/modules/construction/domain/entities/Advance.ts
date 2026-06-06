/**
 * Advance — Avans (hakedişten mahsup edilebilir). Tablo: cs_advances. Immutable.
 */
import type { CurrencyCode } from '../valueObjects/Currency.js';

export interface AdvanceProps {
  id: number;
  companyId: number;
  projectId: number;
  vendorId: number | null;
  description: string | null;
  amount: number;
  offsetAmount: number;
  currency: CurrencyCode;
  givenAt: string;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdvanceUpdate {
  vendorId?: number | null;
  description?: string | null;
  amount?: number;
  offsetAmount?: number;
  currency?: CurrencyCode;
  givenAt?: string;
}

export class Advance {
  private constructor(private readonly props: Readonly<AdvanceProps>) {}

  static create(props: AdvanceProps): Advance {
    if (props.id <= 0) throw new Error('Advance.id pozitif olmalı');
    if (props.projectId <= 0) throw new Error('Advance.projectId pozitif olmalı');
    if (props.amount < 0 || props.offsetAmount < 0)
      throw new Error('Advance tutarı negatif olamaz');
    return new Advance(props);
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
  get vendorId(): number | null {
    return this.props.vendorId;
  }
  get description(): string | null {
    return this.props.description;
  }
  get amount(): number {
    return this.props.amount;
  }
  get offsetAmount(): number {
    return this.props.offsetAmount;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
  }
  get givenAt(): string {
    return this.props.givenAt;
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

  update(c: AdvanceUpdate, now: Date): Advance {
    const amount = c.amount !== undefined ? c.amount : this.props.amount;
    const offsetAmount = c.offsetAmount !== undefined ? c.offsetAmount : this.props.offsetAmount;
    if (amount < 0 || offsetAmount < 0) throw new Error('Advance tutarı negatif olamaz');
    return new Advance({
      ...this.props,
      vendorId: c.vendorId !== undefined ? c.vendorId : this.props.vendorId,
      description: c.description !== undefined ? c.description : this.props.description,
      amount,
      offsetAmount,
      currency: c.currency ?? this.props.currency,
      givenAt: c.givenAt ?? this.props.givenAt,
      updatedAt: now,
    });
  }

  toJSON(): Readonly<AdvanceProps> {
    return { ...this.props };
  }
}
