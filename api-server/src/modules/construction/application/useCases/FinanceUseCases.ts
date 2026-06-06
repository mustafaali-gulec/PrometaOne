/**
 * Şantiye finans use-case'leri: gider, avans, kasa/banka + proje maliyet özeti
 * (bütçe vs gerçekleşen). Tüm yazımlar projeyi/varlığı doğrular.
 */
import {
  AdvanceNotFoundError,
  CashMovementNotFoundError,
  ExpenseNotFoundError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import { round2, type CurrencyCode } from '../../domain/valueObjects/Currency.js';
import {
  toAdvanceDto,
  toCashMovementDto,
  toExpenseDto,
  type AdvanceDto,
  type CashMovementDto,
  type ExpenseDto,
  type ProjectCostSummaryDto,
} from '../dto/FinanceDtos.js';
import type { Clock } from '../ports/Clock.js';
import type {
  AdvanceRepository,
  CashMovementRepository,
  ExpenseRepository,
} from '../ports/FinanceRepositories.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';

// ===== EXPENSES =============================================================
export interface CreateExpenseInput {
  companyId: number;
  projectId: number;
  boqLineId?: number | null | undefined;
  vendorId?: number | null | undefined;
  invoiceId?: number | null | undefined;
  category?: string | undefined;
  description?: string | null | undefined;
  amount: number;
  currency?: CurrencyCode | undefined;
  spentAt: string;
  createdBy?: number | null | undefined;
}

export class CreateExpenseUseCase {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: CreateExpenseInput): Promise<ExpenseDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const created = await this.expenses.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      boqLineId: input.boqLineId ?? null,
      vendorId: input.vendorId ?? null,
      invoiceId: input.invoiceId ?? null,
      category: input.category?.trim() || 'other',
      description: input.description?.trim() || null,
      amount: round2(input.amount),
      currency: input.currency ?? project.currency,
      spentAt: input.spentAt,
      createdBy: input.createdBy ?? null,
    });
    return toExpenseDto(created);
  }
}

export class ListExpensesUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}
  async execute(input: { companyId: number; projectId: number }): Promise<ExpenseDto[]> {
    const list = await this.expenses.listByProject(input.projectId, input.companyId);
    return list.map(toExpenseDto);
  }
}

export interface UpdateExpenseInput {
  companyId: number;
  expenseId: number;
  boqLineId?: number | null | undefined;
  vendorId?: number | null | undefined;
  invoiceId?: number | null | undefined;
  category?: string | undefined;
  description?: string | null | undefined;
  amount?: number | undefined;
  currency?: CurrencyCode | undefined;
  spentAt?: string | undefined;
}

export class UpdateExpenseUseCase {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: UpdateExpenseInput): Promise<ExpenseDto> {
    const e = await this.expenses.findById(input.expenseId, input.companyId);
    if (!e) throw new ExpenseNotFoundError(input.expenseId);
    const updated = e.update(
      {
        ...(input.boqLineId !== undefined ? { boqLineId: input.boqLineId } : {}),
        ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
        ...(input.invoiceId !== undefined ? { invoiceId: input.invoiceId } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amount !== undefined ? { amount: round2(input.amount) } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.spentAt !== undefined ? { spentAt: input.spentAt } : {}),
      },
      this.clock.now(),
    );
    await this.expenses.update(updated);
    return toExpenseDto(updated);
  }
}

export class DeleteExpenseUseCase {
  constructor(private readonly expenses: ExpenseRepository) {}
  async execute(input: { companyId: number; expenseId: number }): Promise<void> {
    const ok = await this.expenses.delete(input.expenseId, input.companyId);
    if (!ok) throw new ExpenseNotFoundError(input.expenseId);
  }
}

export class GetProjectCostSummaryUseCase {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly projects: ProjectRepository,
  ) {}
  async execute(input: { companyId: number; projectId: number }): Promise<ProjectCostSummaryDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const byCategory = await this.expenses.sumByCategory(input.projectId, input.companyId);
    const spentTotal = round2(byCategory.reduce((s, c) => s + c.amount, 0));
    return {
      projectId: input.projectId,
      budgetAmount: project.budgetAmount,
      currency: project.currency,
      spentTotal,
      variance: round2(project.budgetAmount - spentTotal),
      byCategory: byCategory.map((c) => ({ category: c.category, amount: c.amount })),
    };
  }
}

// ===== ADVANCES =============================================================
export interface CreateAdvanceInput {
  companyId: number;
  projectId: number;
  vendorId?: number | null | undefined;
  description?: string | null | undefined;
  amount: number;
  offsetAmount?: number | undefined;
  currency?: CurrencyCode | undefined;
  givenAt: string;
  createdBy?: number | null | undefined;
}

export class CreateAdvanceUseCase {
  constructor(
    private readonly advances: AdvanceRepository,
    private readonly projects: ProjectRepository,
  ) {}
  async execute(input: CreateAdvanceInput): Promise<AdvanceDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const created = await this.advances.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      vendorId: input.vendorId ?? null,
      description: input.description?.trim() || null,
      amount: round2(input.amount),
      offsetAmount: round2(input.offsetAmount ?? 0),
      currency: input.currency ?? project.currency,
      givenAt: input.givenAt,
      createdBy: input.createdBy ?? null,
    });
    return toAdvanceDto(created);
  }
}

export class ListAdvancesUseCase {
  constructor(private readonly advances: AdvanceRepository) {}
  async execute(input: { companyId: number; projectId: number }): Promise<AdvanceDto[]> {
    const list = await this.advances.listByProject(input.projectId, input.companyId);
    return list.map(toAdvanceDto);
  }
}

export interface UpdateAdvanceInput {
  companyId: number;
  advanceId: number;
  vendorId?: number | null | undefined;
  description?: string | null | undefined;
  amount?: number | undefined;
  offsetAmount?: number | undefined;
  currency?: CurrencyCode | undefined;
  givenAt?: string | undefined;
}

export class UpdateAdvanceUseCase {
  constructor(
    private readonly advances: AdvanceRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: UpdateAdvanceInput): Promise<AdvanceDto> {
    const a = await this.advances.findById(input.advanceId, input.companyId);
    if (!a) throw new AdvanceNotFoundError(input.advanceId);
    const updated = a.update(
      {
        ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amount !== undefined ? { amount: round2(input.amount) } : {}),
        ...(input.offsetAmount !== undefined ? { offsetAmount: round2(input.offsetAmount) } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.givenAt !== undefined ? { givenAt: input.givenAt } : {}),
      },
      this.clock.now(),
    );
    await this.advances.update(updated);
    return toAdvanceDto(updated);
  }
}

export class DeleteAdvanceUseCase {
  constructor(private readonly advances: AdvanceRepository) {}
  async execute(input: { companyId: number; advanceId: number }): Promise<void> {
    const ok = await this.advances.delete(input.advanceId, input.companyId);
    if (!ok) throw new AdvanceNotFoundError(input.advanceId);
  }
}

// ===== CASH MOVEMENTS =======================================================
export interface CreateCashMovementInput {
  companyId: number;
  projectId: number;
  direction: number;
  accountRef?: string | null | undefined;
  description?: string | null | undefined;
  amount: number;
  currency?: CurrencyCode | undefined;
  movedAt: string;
  relatedProgressId?: number | null | undefined;
  createdBy?: number | null | undefined;
}

export class CreateCashMovementUseCase {
  constructor(
    private readonly cash: CashMovementRepository,
    private readonly projects: ProjectRepository,
  ) {}
  async execute(input: CreateCashMovementInput): Promise<CashMovementDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const created = await this.cash.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      direction: input.direction,
      accountRef: input.accountRef?.trim() || null,
      description: input.description?.trim() || null,
      amount: round2(input.amount),
      currency: input.currency ?? project.currency,
      movedAt: input.movedAt,
      relatedProgressId: input.relatedProgressId ?? null,
      createdBy: input.createdBy ?? null,
    });
    return toCashMovementDto(created);
  }
}

export class ListCashMovementsUseCase {
  constructor(private readonly cash: CashMovementRepository) {}
  async execute(input: { companyId: number; projectId: number }): Promise<CashMovementDto[]> {
    const list = await this.cash.listByProject(input.projectId, input.companyId);
    return list.map(toCashMovementDto);
  }
}

export class DeleteCashMovementUseCase {
  constructor(private readonly cash: CashMovementRepository) {}
  async execute(input: { companyId: number; movementId: number }): Promise<void> {
    const ok = await this.cash.delete(input.movementId, input.companyId);
    if (!ok) throw new CashMovementNotFoundError(input.movementId);
  }
}
