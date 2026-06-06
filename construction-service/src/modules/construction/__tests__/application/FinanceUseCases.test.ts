/**
 * Şantiye finans use-case testleri (node:test) — gider/avans/kasa + maliyet özeti.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  CreateAdvanceUseCase,
  CreateCashMovementUseCase,
  CreateExpenseUseCase,
  DeleteExpenseUseCase,
  GetProjectCostSummaryUseCase,
  ListExpensesUseCase,
} from '../../application/useCases/FinanceUseCases.js';
import { CreateProjectUseCase } from '../../application/useCases/ProjectUseCases.js';
import {
  ExpenseNotFoundError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  InMemoryAdvanceRepository,
  InMemoryCashMovementRepository,
  InMemoryExpenseRepository,
  InMemoryProjectRepository,
} from '../fakes.js';

describe('FinanceUseCases', () => {
  let expenses: InMemoryExpenseRepository;
  let advances: InMemoryAdvanceRepository;
  let cash: InMemoryCashMovementRepository;
  let projects: InMemoryProjectRepository;

  beforeEach(() => {
    expenses = new InMemoryExpenseRepository();
    advances = new InMemoryAdvanceRepository();
    cash = new InMemoryCashMovementRepository();
    projects = new InMemoryProjectRepository();
  });

  async function makeProject(budget = 1000000): Promise<number> {
    const p = await new CreateProjectUseCase(projects).execute({
      companyId: 1,
      name: 'P',
      budgetAmount: budget,
    });
    return p.id;
  }

  it('proje yoksa gider eklenemez', async () => {
    await assert.rejects(
      () =>
        new CreateExpenseUseCase(expenses, projects).execute({
          companyId: 1,
          projectId: 999,
          amount: 100,
          spentAt: '2026-06-06',
        }),
      ProjectNotFoundError,
    );
  });

  it('gider ekler, listeler ve siler', async () => {
    const projectId = await makeProject();
    const create = new CreateExpenseUseCase(expenses, projects);
    const e = await create.execute({
      companyId: 1,
      projectId,
      category: 'malzeme',
      amount: 1500.5,
      spentAt: '2026-06-06',
    });
    assert.equal(e.category, 'malzeme');
    assert.equal(e.amount, 1500.5);
    const list = await new ListExpensesUseCase(expenses).execute({ companyId: 1, projectId });
    assert.equal(list.length, 1);
    await new DeleteExpenseUseCase(expenses).execute({ companyId: 1, expenseId: e.id });
    const after = await new ListExpensesUseCase(expenses).execute({ companyId: 1, projectId });
    assert.equal(after.length, 0);
  });

  it('bulunmayan gideri silmek ExpenseNotFoundError', async () => {
    await assert.rejects(
      () => new DeleteExpenseUseCase(expenses).execute({ companyId: 1, expenseId: 999 }),
      ExpenseNotFoundError,
    );
  });

  it('maliyet özeti: bütçe - harcanan + kategori kırılımı', async () => {
    const projectId = await makeProject(1000000);
    const create = new CreateExpenseUseCase(expenses, projects);
    await create.execute({
      companyId: 1,
      projectId,
      category: 'malzeme',
      amount: 300000,
      spentAt: '2026-06-01',
    });
    await create.execute({
      companyId: 1,
      projectId,
      category: 'iscilik',
      amount: 200000,
      spentAt: '2026-06-02',
    });
    await create.execute({
      companyId: 1,
      projectId,
      category: 'malzeme',
      amount: 100000,
      spentAt: '2026-06-03',
    });
    const sum = await new GetProjectCostSummaryUseCase(expenses, projects).execute({
      companyId: 1,
      projectId,
    });
    assert.equal(sum.budgetAmount, 1000000);
    assert.equal(sum.spentTotal, 600000);
    assert.equal(sum.variance, 400000);
    const malzeme = sum.byCategory.find((c) => c.category === 'malzeme');
    assert.equal(malzeme!.amount, 400000);
  });

  it('avans kalan (remaining) = amount - offset', async () => {
    const projectId = await makeProject();
    const a = await new CreateAdvanceUseCase(advances, projects).execute({
      companyId: 1,
      projectId,
      amount: 50000,
      offsetAmount: 20000,
      givenAt: '2026-06-06',
    });
    assert.equal(a.remaining, 30000);
  });

  it('kasa hareketi yön doğrulaması (+1/-1)', async () => {
    const projectId = await makeProject();
    const create = new CreateCashMovementUseCase(cash, projects);
    const m = await create.execute({
      companyId: 1,
      projectId,
      direction: -1,
      amount: 5000,
      movedAt: '2026-06-06',
    });
    assert.equal(m.direction, -1);
  });
});
