/**
 * CashMovement — Şantiye kasa/banka hareketi. Tablo: cs_cash_movements.
 * direction: +1 tahsilat, -1 tediye. Immutable.
 */
import type { CurrencyCode } from '../valueObjects/Currency.js';

export interface CashMovementProps {
  id: number;
  companyId: number;
  projectId: number;
  direction: number;
  accountRef: string | null;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  movedAt: string;
  relatedProgressId: number | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CashMovementUpdate {
  direction?: number;
  accountRef?: string | null;
  description?: string | null;
  amount?: number;
  currency?: CurrencyCode;
  movedAt?: string;
  relatedProgressId?: number | null;
}

export class CashMovement {
  private constructor(private readonly props: Readonly<CashMovementProps>) {}

  static create(props: CashMovementProps): CashMovement {
    if (props.id <= 0) throw new Error('CashMovement.id pozitif olmalı');
    if (props.projectId <= 0) throw new Error('CashMovement.projectId pozitif olmalı');
    if (props.amount < 0) throw new Error('CashMovement.amount negatif olamaz');
    if (props.direction !== 1 && props.direction !== -1) {
      throw new Error('CashMovement.direction +1 veya -1 olmalı');
    }
    return new CashMovement(props);
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
  get direction(): number {
    return this.props.direction;
  }
  get accountRef(): string | null {
    return this.props.accountRef;
  }
  get description(): string | null {
    return this.props.description;
  }
  get amount(): number {
    return this.props.amount;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
  }
  get movedAt(): string {
    return this.props.movedAt;
  }
  get relatedProgressId(): number | null {
    return this.props.relatedProgressId;
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

  update(c: CashMovementUpdate, now: Date): CashMovement {
    const amount = c.amount !== undefined ? c.amount : this.props.amount;
    if (amount < 0) throw new Error('CashMovement.amount negatif olamaz');
    const direction = c.direction !== undefined ? c.direction : this.props.direction;
    if (direction !== 1 && direction !== -1) throw new Error('CashMovement.direction +1/-1 olmalı');
    return new CashMovement({
      ...this.props,
      direction,
      accountRef: c.accountRef !== undefined ? c.accountRef : this.props.accountRef,
      description: c.description !== undefined ? c.description : this.props.description,
      amount,
      currency: c.currency ?? this.props.currency,
      movedAt: c.movedAt ?? this.props.movedAt,
      relatedProgressId:
        c.relatedProgressId !== undefined ? c.relatedProgressId : this.props.relatedProgressId,
      updatedAt: now,
    });
  }

  toJSON(): Readonly<CashMovementProps> {
    return { ...this.props };
  }
}
