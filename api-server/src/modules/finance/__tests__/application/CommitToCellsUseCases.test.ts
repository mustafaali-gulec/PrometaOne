/**
 * Commit-to-Cells use-case testleri — UoW atomik commit + rollback.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { FinanceTransactionalRepositories } from '../../application/ports/FinanceUnitOfWork.js';
import {
  CommitInvoiceToCellsUseCase,
  CommitKasaEntryToCellsUseCase,
} from '../../application/useCases/CommitToCellsUseCases.js';
import { Invoice } from '../../domain/entities/Invoice.js';
import { KasaEntry } from '../../domain/entities/KasaEntry.js';
import {
  AlreadyCommittedError,
  CommitNotApplicableError,
} from '../../domain/errors/FinanceErrors.js';
import { KdvCalculator } from '../../domain/services/KdvCalculator.js';
import { KdvRate } from '../../domain/valueObjects/KdvRate.js';
import { Money } from '../../domain/valueObjects/Money.js';
import {
  FixedClock,
  InMemoryCategoryRepository,
  InMemoryCellRepository,
  InMemoryFinanceUnitOfWork,
  InMemoryInvoicePaymentRepository,
  InMemoryInvoiceRepository,
  InMemoryKasaEntryRepository,
  InMemoryTransferRepository,
} from '../fakes.js';

const NOW = new Date('2026-03-15T00:00:00Z');

describe('Commit-to-Cells use-cases', () => {
  let categories: InMemoryCategoryRepository;
  let cells: InMemoryCellRepository;
  let kasaEntries: InMemoryKasaEntryRepository;
  let transfers: InMemoryTransferRepository;
  let invoices: InMemoryInvoiceRepository;
  let invoicePayments: InMemoryInvoicePaymentRepository;
  let repos: FinanceTransactionalRepositories;
  let uow: InMemoryFinanceUnitOfWork;
  let clock: FixedClock;

  beforeEach(() => {
    categories = new InMemoryCategoryRepository();
    cells = new InMemoryCellRepository();
    kasaEntries = new InMemoryKasaEntryRepository();
    transfers = new InMemoryTransferRepository();
    invoices = new InMemoryInvoiceRepository();
    invoicePayments = new InMemoryInvoicePaymentRepository();
    repos = { categories, cells, kasaEntries, transfers, invoices, invoicePayments };
    uow = new InMemoryFinanceUnitOfWork(repos);
    clock = new FixedClock(NOW);
  });

  function makeKasaEntry(overrides: Partial<Parameters<typeof KasaEntry.create>[0]> = {}) {
    return KasaEntry.create({
      id: null,
      kasaAccountId: 1,
      date: '2026-03-15',
      type: 'in',
      amount: Money.fromMajor(1000, 'TRY'),
      description: null,
      category: null,
      cashflowCatId: 42,
      committedToCells: false,
      committedAt: null,
      createdBy: null,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    });
  }

  describe('CommitKasaEntryToCellsUseCase', () => {
    it('happy: cell oluşur (Mart) + entry committed işaretlenir', async () => {
      const entry = await kasaEntries.insert(makeKasaEntry());
      await new CommitKasaEntryToCellsUseCase(uow, clock).execute({
        companyId: 100,
        kasaEntryId: entry.id!,
        actorUserId: 7,
      });

      const cell = await cells.findOne(100, 42, 2026, 2); // Mart = 2
      assert.ok(cell);
      assert.equal(cell.value.toDecimalString(), '1000.00');

      const updated = await kasaEntries.findById(entry.id!);
      assert.ok(updated!.committedToCells);
    });

    it('happy: mevcut cell üstüne ekler (delta)', async () => {
      const e1 = await kasaEntries.insert(makeKasaEntry({ amount: Money.fromMajor(1000, 'TRY') }));
      const e2 = await kasaEntries.insert(makeKasaEntry({ amount: Money.fromMajor(500, 'TRY') }));
      const uc = new CommitKasaEntryToCellsUseCase(uow, clock);
      await uc.execute({ companyId: 100, kasaEntryId: e1.id!, actorUserId: null });
      await uc.execute({ companyId: 100, kasaEntryId: e2.id!, actorUserId: null });

      const cell = await cells.findOne(100, 42, 2026, 2);
      assert.equal(cell!.value.toDecimalString(), '1500.00'); // 1000 + 500
    });

    it('edge: cashflowCatId yok → CommitNotApplicableError', async () => {
      const entry = await kasaEntries.insert(makeKasaEntry({ cashflowCatId: null }));
      await assert.rejects(
        new CommitKasaEntryToCellsUseCase(uow, clock).execute({
          companyId: 100,
          kasaEntryId: entry.id!,
          actorUserId: null,
        }),
        CommitNotApplicableError,
      );
    });

    it('edge: zaten committed → AlreadyCommittedError', async () => {
      const entry = await kasaEntries.insert(makeKasaEntry({ committedToCells: true }));
      await assert.rejects(
        new CommitKasaEntryToCellsUseCase(uow, clock).execute({
          companyId: 100,
          kasaEntryId: entry.id!,
          actorUserId: null,
        }),
        AlreadyCommittedError,
      );
    });

    it('ATOMIK rollback: entry.update hata fırlatırsa cell geri alınır', async () => {
      const entry = await kasaEntries.insert(makeKasaEntry());
      // entry.update'i geçici olarak patlat — applyDelta(cell upsert) SONRASI
      const original = kasaEntries.update.bind(kasaEntries);
      kasaEntries.update = () => Promise.reject(new Error('DB patladı'));

      await assert.rejects(
        new CommitKasaEntryToCellsUseCase(uow, clock).execute({
          companyId: 100,
          kasaEntryId: entry.id!,
          actorUserId: null,
        }),
        /DB patladı/,
      );

      // ROLLBACK: cell oluşmamış olmalı (commit öncesi yoktu)
      const cell = await cells.findOne(100, 42, 2026, 2);
      assert.equal(cell, null, "UoW rollback cell'i geri almalıydı");

      // entry hala committed değil
      kasaEntries.update = original;
      const after = await kasaEntries.findById(entry.id!);
      assert.equal(after!.committedToCells, false);
    });
  });

  describe('CommitInvoiceToCellsUseCase', () => {
    function makeInvoice(type: 'in' | 'out', catId: number | null) {
      const totals = KdvCalculator.fromSubtotal(Money.fromMajor(100, 'TRY'), KdvRate.default());
      return Invoice.create({
        id: null,
        companyId: 100,
        type,
        invoiceNo: null,
        counterparty: 'X',
        issueDate: null,
        dueDate: '2026-03-31',
        currency: 'TRY',
        subtotal: totals.subtotal,
        kdvRate: KdvRate.default(),
        kdv: totals.kdv,
        total: totals.total,
        paidAmount: Money.zero('TRY'),
        cashflowCatId: catId,
        committedToCells: false,
        committedAt: null,
        note: null,
        createdBy: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
    }

    it("happy: type in → +total cell'e işlenir (Mart)", async () => {
      const inv = await invoices.insert(makeInvoice('in', 50));
      await new CommitInvoiceToCellsUseCase(uow, clock).execute({
        companyId: 100,
        invoiceId: inv.id!,
        actorUserId: null,
      });
      const cell = await cells.findOne(100, 50, 2026, 2);
      assert.equal(cell!.value.toDecimalString(), '120.00');

      const updated = await invoices.findById(inv.id!, 100);
      assert.ok(updated!.committedToCells);
    });

    it('happy: type out → −total', async () => {
      const inv = await invoices.insert(makeInvoice('out', 60));
      await new CommitInvoiceToCellsUseCase(uow, clock).execute({
        companyId: 100,
        invoiceId: inv.id!,
        actorUserId: null,
      });
      const cell = await cells.findOne(100, 60, 2026, 2);
      assert.equal(cell!.value.toDecimalString(), '-120.00');
    });
  });
});
