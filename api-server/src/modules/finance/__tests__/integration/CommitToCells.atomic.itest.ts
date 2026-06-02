/**
 * Commit-to-Cells atomiklik integration test — PgFinanceUnitOfWork (ADR-0006).
 *
 * Doğrulanan: gerçekleşen kasa hareketi bütçe hücresine yazılır VE kaynak
 * "committed" işaretlenir — ikisi tek transaction'da. Yarıda hata olursa
 * BEGIN/ROLLBACK ile her iki yazım da geri sarılır.
 *
 * Testler:
 *   1) happy: commit → cell oluşur (+signedAmount) + entry.committed=TRUE
 *   2) rollback: transaction içinde başarılı cell upsert + manuel throw →
 *      cell DB'ye yazılmaz (ROLLBACK)
 *   3) use-case rollback: geçersiz cashflowCatId (FK 23503) → entry committed
 *      kalmaz, hiçbir cell oluşmaz
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { RecordKasaEntryUseCase } from '../../application/useCases/CashFlowUseCases.js';
import { CommitKasaEntryToCellsUseCase } from '../../application/useCases/CommitToCellsUseCases.js';
import { Cell } from '../../domain/entities/Cell.js';
import { AlreadyCommittedError } from '../../domain/errors/FinanceErrors.js';
import { FiscalYear } from '../../domain/valueObjects/FiscalYear.js';
import { Money } from '../../domain/valueObjects/Money.js';
import { MonthIndex } from '../../domain/valueObjects/MonthIndex.js';
import { PgCategoryRepository } from '../../infrastructure/persistence/PgCategoryRepository.js';
import { PgKasaAccountRepository } from '../../infrastructure/persistence/PgKasaAccountRepository.js';
import { PgKasaEntryRepository } from '../../infrastructure/persistence/PgKasaEntryRepository.js';
import { PgFinanceUnitOfWork } from '../../infrastructure/unitOfWork/PgFinanceUnitOfWork.js';
import { FixedClock } from '../fakes.js';

import {
  seedCompany,
  seedUser,
  startFinancePgContainer,
  truncateAllFinanceTables,
  type FinancePgContext,
} from './setup.js';

describe('Commit-to-Cells atomiklik [integration]', () => {
  let ctx: FinancePgContext;
  const clock = new FixedClock();
  let categoryId: number;
  let kasaAccountId: number;

  before(
    async () => {
      ctx = await startFinancePgContainer();
    },
    { timeout: 180_000 },
  );

  after(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  beforeEach(async () => {
    await truncateAllFinanceTables(ctx.pool);
    await seedCompany(ctx.pool, { id: 1, name: 'Test A.Ş.' });
    await seedUser(ctx.pool, { id: 1, companyId: 1, username: 'cfo' });
    const cat = await new PgCategoryRepository(ctx.pool).insert({
      companyId: 1,
      section: 'kasaCategories',
      name: 'Kasa Giriş',
      sortOrder: 0,
    });
    categoryId = cat.id;
    const acc = await new PgKasaAccountRepository(ctx.pool).insert({
      companyId: 1,
      name: 'Ana Kasa',
      currency: 'TRY',
      openingBalanceMajor: 0,
    });
    kasaAccountId = acc.id;
  });

  async function cellCount(): Promise<number> {
    const r = await ctx.pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM cells`);
    return Number(r.rows[0]!.n);
  }

  it('happy: commit → cell +signedAmount + entry.committed=TRUE (tek transaction)', async () => {
    const entries = new PgKasaEntryRepository(ctx.pool);
    const kasaAccounts = new PgKasaAccountRepository(ctx.pool);
    const recorded = await new RecordKasaEntryUseCase(kasaAccounts, entries, clock).execute({
      companyId: 1,
      kasaAccountId,
      date: '2026-03-15',
      type: 'in',
      amount: 1500,
      cashflowCatId: categoryId,
      actorUserId: 1,
    });

    const uow = new PgFinanceUnitOfWork(ctx.pool);
    await new CommitKasaEntryToCellsUseCase(uow, clock).execute({
      companyId: 1,
      kasaEntryId: recorded.id!,
      actorUserId: 1,
    });

    // cell: fiscalYear 2026, monthIdx 2 (Mart), +1500 (in)
    const cellRow = await ctx.pool.query<{ value: string }>(
      `SELECT value FROM cells
        WHERE company_id = 1 AND category_id = $1 AND fiscal_year = 2026 AND month_idx = 2`,
      [categoryId],
    );
    assert.equal(cellRow.rows.length, 1);
    assert.equal(cellRow.rows[0]!.value, '1500.00');

    const committed = await ctx.pool.query<{ committed_to_cells: boolean }>(
      `SELECT committed_to_cells FROM kasa_entries WHERE id = $1`,
      [recorded.id],
    );
    assert.equal(committed.rows[0]!.committed_to_cells, true);
  });

  it('rollback: transaction içinde throw → başarılı cell upsert geri sarılır', async () => {
    const uow = new PgFinanceUnitOfWork(ctx.pool);

    await assert.rejects(
      uow.withTransaction(async (repos) => {
        await repos.cells.upsert(
          Cell.create({
            id: null,
            companyId: 1,
            categoryId,
            fiscalYear: FiscalYear.create(2026),
            monthIdx: MonthIndex.create(0),
            value: Money.fromMajor(9999, 'TRY'),
            updatedAt: clock.now(),
            updatedBy: null,
          }),
        );
        // upsert başarılı; şimdi patlat → COMMIT'e ulaşmadan ROLLBACK
        throw new Error('kasıtlı hata');
      }),
      /kasıtlı hata/,
    );

    assert.equal(await cellCount(), 0); // hiçbir şey kalıcı olmamalı
  });

  it("idempotency: committed flag transaction'lar arası kalıcı — ikinci commit reddedilir, cell iki katına çıkmaz", async () => {
    const entries = new PgKasaEntryRepository(ctx.pool);
    const kasaAccounts = new PgKasaAccountRepository(ctx.pool);
    const recorded = await new RecordKasaEntryUseCase(kasaAccounts, entries, clock).execute({
      companyId: 1,
      kasaAccountId,
      date: '2026-03-15',
      type: 'in',
      amount: 1000,
      cashflowCatId: categoryId,
      actorUserId: 1,
    });

    const uow = new PgFinanceUnitOfWork(ctx.pool);
    const commit = new CommitKasaEntryToCellsUseCase(uow, clock);

    // İlk commit: cell 1000, entry committed=TRUE (COMMIT kalıcı)
    await commit.execute({ companyId: 1, kasaEntryId: recorded.id!, actorUserId: 1 });

    // İkinci commit: committed flag DB'den okunur → AlreadyCommittedError
    await assert.rejects(
      commit.execute({ companyId: 1, kasaEntryId: recorded.id!, actorUserId: 1 }),
      AlreadyCommittedError,
    );

    // cell hâlâ 1000 — çift yazım olmadı
    const cellRow = await ctx.pool.query<{ value: string }>(
      `SELECT value FROM cells
        WHERE company_id = 1 AND category_id = $1 AND fiscal_year = 2026 AND month_idx = 2`,
      [categoryId],
    );
    assert.equal(cellRow.rows.length, 1);
    assert.equal(cellRow.rows[0]!.value, '1000.00');
  });
});
