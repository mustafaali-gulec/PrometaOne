/**
 * Expense — Şantiye gideri. Tablo: cs_expenses (026_cs_finance.sql). Immutable.
 */
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
}

export interface ExpenseUpdate {
  boqLineId?: number | null;
  vendorId?: number | null;
  invoiceId?: number | null;
  category?: string;
  description?: string | null;
  amount?: number;
  currency?: CurrencyCode;
  spentAt?: string;
}

export class Expense {
  private constructor(private readonly props: Readonly<ExpenseProps>) {}

  static create(props: ExpenseProps): Expense {
    if (props.id <= 0) throw new Error('Expense.id pozitif olmalı');
    if (props.projectId <= 0) throw new Error('Expense.projectId pozitif olmalı');
    if (props.amount < 0) throw new Error('Expense.amount negatif olamaz');
    return new Expense(props);
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
    });
  }

  toJSON(): Readonly<ExpenseProps> {
    return { ...this.props };
  }
}
