/**
 * Şantiye finans DTO'ları — gider, avans, kasa/banka + proje maliyet özeti.
 */
import type { Advance } from '../../domain/entities/Advance.js';
import type { CashMovement } from '../../domain/entities/CashMovement.js';
import type { Expense } from '../../domain/entities/Expense.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';

export interface ExpenseDto {
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
  createdAt: string;
  updatedAt: string;
}

export interface AdvanceDto {
  id: number;
  companyId: number;
  projectId: number;
  vendorId: number | null;
  description: string | null;
  amount: number;
  offsetAmount: number;
  remaining: number;
  currency: CurrencyCode;
  givenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashMovementDto {
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
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCostSummaryDto {
  projectId: number;
  budgetAmount: number;
  currency: CurrencyCode;
  spentTotal: number;
  variance: number; // budget - spent
  byCategory: Array<{ category: string; amount: number }>;
}

export function toExpenseDto(e: Expense): ExpenseDto {
  const j = e.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    boqLineId: j.boqLineId,
    vendorId: j.vendorId,
    invoiceId: j.invoiceId,
    category: j.category,
    description: j.description,
    amount: j.amount,
    currency: j.currency,
    spentAt: j.spentAt,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export function toAdvanceDto(a: Advance): AdvanceDto {
  const j = a.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    vendorId: j.vendorId,
    description: j.description,
    amount: j.amount,
    offsetAmount: j.offsetAmount,
    remaining: Math.round((j.amount - j.offsetAmount + Number.EPSILON) * 100) / 100,
    currency: j.currency,
    givenAt: j.givenAt,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export type PaymentStatus = 'planned' | 'paid';
export type PaymentSource = 'manual' | 'hakedis' | 'expense' | 'advance';

export interface ManualPaymentDto {
  id: number;
  companyId: number;
  projectId: number | null;
  payee: string | null;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  dueDate: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  method: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentListItemDto {
  source: PaymentSource;
  sourceId: number; // kaynak satır id
  paymentId: number | null; // manuel ise cs_payments.id (edit/delete için), değilse null
  projectId: number | null;
  payee: string | null;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  date: string | null; // ISO 'YYYY-MM-DD'
  dueDate: string | null;
  method: string | null;
}

export function toCashMovementDto(m: CashMovement): CashMovementDto {
  const j = m.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    direction: j.direction,
    accountRef: j.accountRef,
    description: j.description,
    amount: j.amount,
    currency: j.currency,
    movedAt: j.movedAt,
    relatedProgressId: j.relatedProgressId,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}
