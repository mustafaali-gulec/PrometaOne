/**
 * Şantiye finans kalıcılık portları: gider, avans, kasa/banka.
 * Concrete: infrastructure/persistence/Pg{Expense,Advance,CashMovement}Repository.ts
 */
import type { Advance } from '../../domain/entities/Advance.js';
import type { CashMovement } from '../../domain/entities/CashMovement.js';
import type { Expense } from '../../domain/entities/Expense.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { ManualPaymentDto, PaymentListItemDto } from '../dto/FinanceDtos.js';

export interface NewExpenseInput {
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
}

export interface CategoryTotal {
  category: string;
  amount: number;
}

export interface ExpenseRepository {
  insert(input: NewExpenseInput): Promise<Expense>;
  update(expense: Expense): Promise<void>;
  delete(id: number, companyId: number): Promise<boolean>;
  findById(id: number, companyId: number): Promise<Expense | null>;
  listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Expense>>;
  sumByCategory(projectId: number, companyId: number): Promise<ReadonlyArray<CategoryTotal>>;
}

export interface NewAdvanceInput {
  companyId: number;
  projectId: number;
  vendorId: number | null;
  description: string | null;
  amount: number;
  offsetAmount: number;
  currency: CurrencyCode;
  givenAt: string;
  createdBy: number | null;
}

export interface AdvanceRepository {
  insert(input: NewAdvanceInput): Promise<Advance>;
  update(advance: Advance): Promise<void>;
  delete(id: number, companyId: number): Promise<boolean>;
  findById(id: number, companyId: number): Promise<Advance | null>;
  listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Advance>>;
}

export interface NewCashMovementInput {
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
}

export interface CashMovementRepository {
  insert(input: NewCashMovementInput): Promise<CashMovement>;
  update(movement: CashMovement): Promise<void>;
  delete(id: number, companyId: number): Promise<boolean>;
  findById(id: number, companyId: number): Promise<CashMovement | null>;
  listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<CashMovement>>;
}

export interface NewManualPaymentInput {
  companyId: number;
  projectId: number | null;
  payee: string | null;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  dueDate: string | null;
  status: 'planned' | 'paid';
  paidAt: string | null;
  method: string | null;
  createdBy: number | null;
}

export interface ManualPaymentPatch {
  payee: string | null;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  dueDate: string | null;
  status: 'planned' | 'paid';
  paidAt: string | null;
  method: string | null;
}

export interface PaymentRepository {
  listUnified(companyId: number, projectId: number | null): Promise<PaymentListItemDto[]>;
  insertManual(input: NewManualPaymentInput): Promise<ManualPaymentDto>;
  findManualById(id: number, companyId: number): Promise<ManualPaymentDto | null>;
  updateManual(
    id: number,
    companyId: number,
    patch: ManualPaymentPatch,
  ): Promise<ManualPaymentDto | null>;
  deleteManual(id: number, companyId: number): Promise<boolean>;
}
