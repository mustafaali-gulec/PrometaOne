/**
 * Commit-to-Cells use-case'leri (Faz 5 / PR 5) — UoW yoğun.
 *
 * Gerçekleşen kasa hareketi / transfer / fatura, bütçe matrisindeki ilgili
 * (kategori × ay) hücresine eklenir VE kaynak "committed" işaretlenir —
 * ikisi tek transaction'da (FinanceUnitOfWork). Yarıda hata olursa hem cell
 * hem committed flag geri sarılır (atomik).
 */
import { Cell } from '../../domain/entities/Cell.js';
import {
  AlreadyCommittedError,
  CommitNotApplicableError,
  InvoiceNotFoundError,
  KasaEntryNotFoundError,
  TransferNotFoundError,
} from '../../domain/errors/FinanceErrors.js';
import {
  CashflowCommitPolicy,
  type CellDelta,
} from '../../domain/services/CashflowCommitPolicy.js';
import { FiscalYear } from '../../domain/valueObjects/FiscalYear.js';
import { MonthIndex } from '../../domain/valueObjects/MonthIndex.js';
import type { CellRepository } from '../ports/CellRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { FinanceTransactionalRepositories } from '../ports/FinanceUnitOfWork.js';
import type { FinanceUnitOfWork } from '../ports/FinanceUnitOfWork.js';

/**
 * Bir CellDelta'yı mevcut hücreye ekler (yoksa oluşturur). Aynı transaction
 * içinde çağrılır.
 */
async function applyDelta(
  cells: CellRepository,
  companyId: number,
  delta: CellDelta,
  actorUserId: number | null,
  now: Date,
): Promise<void> {
  const existing = await cells.findOne(
    companyId,
    delta.categoryId,
    delta.fiscalYear,
    delta.monthIdx,
  );
  if (existing) {
    await cells.upsert(existing.setValue(existing.value.plus(delta.amount), now, actorUserId));
  } else {
    await cells.upsert(
      Cell.create({
        id: null,
        companyId,
        categoryId: delta.categoryId,
        fiscalYear: FiscalYear.create(delta.fiscalYear),
        monthIdx: MonthIndex.create(delta.monthIdx),
        value: delta.amount,
        updatedAt: now,
        updatedBy: actorUserId,
      }),
    );
  }
}

export class CommitKasaEntryToCellsUseCase {
  constructor(
    private readonly uow: FinanceUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    kasaEntryId: number;
    actorUserId: number | null;
  }): Promise<void> {
    const now = this.clock.now();
    await this.uow.withTransaction(async (repos: FinanceTransactionalRepositories) => {
      const entry = await repos.kasaEntries.findById(input.kasaEntryId);
      if (!entry) {
        throw new KasaEntryNotFoundError(input.kasaEntryId);
      }
      if (entry.committedToCells) {
        throw new AlreadyCommittedError('kasaEntry', input.kasaEntryId);
      }
      const delta = CashflowCommitPolicy.forKasaEntry(entry);
      if (!delta) {
        throw new CommitNotApplicableError('kasa hareketinde nakit akış kategorisi yok');
      }
      await applyDelta(repos.cells, input.companyId, delta, input.actorUserId, now);
      await repos.kasaEntries.update(entry.markCommitted(now));
    });
  }
}

export class CommitTransferToCellsUseCase {
  constructor(
    private readonly uow: FinanceUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    transferId: number;
    actorUserId: number | null;
  }): Promise<void> {
    const now = this.clock.now();
    await this.uow.withTransaction(async (repos) => {
      const transfer = await repos.transfers.findById(input.transferId, input.companyId);
      if (!transfer) {
        throw new TransferNotFoundError(input.transferId);
      }
      if (transfer.committedToCells) {
        throw new AlreadyCommittedError('transfer', input.transferId);
      }
      const delta = CashflowCommitPolicy.forTransfer(transfer);
      if (!delta) {
        throw new CommitNotApplicableError('transferde nakit akış kategorisi yok');
      }
      await applyDelta(repos.cells, input.companyId, delta, input.actorUserId, now);
      await repos.transfers.update(transfer.markCommitted(now));
    });
  }
}

export class CommitInvoiceToCellsUseCase {
  constructor(
    private readonly uow: FinanceUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    invoiceId: number;
    actorUserId: number | null;
  }): Promise<void> {
    const now = this.clock.now();
    await this.uow.withTransaction(async (repos) => {
      const invoice = await repos.invoices.findById(input.invoiceId, input.companyId);
      if (!invoice) {
        throw new InvoiceNotFoundError(input.invoiceId);
      }
      if (invoice.committedToCells) {
        throw new AlreadyCommittedError('invoice', input.invoiceId);
      }
      const delta = CashflowCommitPolicy.forInvoice(invoice);
      if (!delta) {
        throw new CommitNotApplicableError('faturada nakit akış kategorisi yok');
      }
      await applyDelta(repos.cells, input.companyId, delta, input.actorUserId, now);
      await repos.invoices.update(invoice.markCommitted(now));
    });
  }
}
