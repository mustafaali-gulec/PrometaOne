/**
 * Invoice use-case testleri.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  CreateInvoiceUseCase,
  DeletePaymentUseCase,
  GetOverdueInvoicesUseCase,
  ListInvoicesUseCase,
  RecordPaymentUseCase,
} from '../../application/useCases/InvoiceUseCases.js';
import {
  InvoiceNotFoundError,
  InvoicePaymentNotFoundError,
} from '../../domain/errors/FinanceErrors.js';
import {
  FixedClock,
  InMemoryInvoicePaymentRepository,
  InMemoryInvoiceRepository,
} from '../fakes.js';

describe('Invoice use-cases', () => {
  let invoices: InMemoryInvoiceRepository;
  let payments: InMemoryInvoicePaymentRepository;
  // Bugün = 2026-06-01 (FixedClock varsayılanı 2026-01-01 — overdue testleri için ayrı clock).
  let clock: FixedClock;

  beforeEach(() => {
    invoices = new InMemoryInvoiceRepository();
    payments = new InMemoryInvoicePaymentRepository();
    clock = new FixedClock(new Date('2026-06-01T00:00:00Z'));
  });

  function createUC() {
    return new CreateInvoiceUseCase(invoices, clock);
  }

  describe('CreateInvoiceUseCase', () => {
    it('happy: %20 KDV ile fatura — subtotal 100 → total 120', async () => {
      const dto = await createUC().execute({
        companyId: 100,
        type: 'in',
        counterparty: 'ACME',
        dueDate: '2026-07-01',
        currency: 'TRY',
        subtotal: 100,
        actorUserId: 7,
      });
      assert.equal(dto.subtotal, '100.00');
      assert.equal(dto.kdv, '20.00');
      assert.equal(dto.total, '120.00');
      assert.equal(dto.remaining, '120.00');
      assert.equal(dto.status, 'open');
    });

    it('happy: custom KDV oranı %10', async () => {
      const dto = await createUC().execute({
        companyId: 100,
        type: 'out',
        counterparty: 'X',
        dueDate: '2026-07-01',
        currency: 'TRY',
        subtotal: 100,
        kdvRate: 0.1,
        actorUserId: null,
      });
      assert.equal(dto.kdv, '10.00');
      assert.equal(dto.total, '110.00');
    });
  });

  describe('RecordPaymentUseCase', () => {
    it('happy: kısmi ödeme → partial', async () => {
      const inv = await createUC().execute({
        companyId: 100,
        type: 'in',
        counterparty: 'A',
        dueDate: '2026-07-01',
        currency: 'TRY',
        subtotal: 100,
        actorUserId: null,
      });
      const result = await new RecordPaymentUseCase(invoices, payments, clock).execute({
        companyId: 100,
        invoiceId: inv.id!,
        amount: 50,
        date: '2026-06-15',
        bankAccountId: 3,
        actorUserId: null,
      });
      assert.equal(result.invoice.paidAmount, '50.00');
      assert.equal(result.invoice.remaining, '70.00');
      assert.equal(result.invoice.status, 'partial');
      assert.equal(result.payment.amount, '50.00');
    });

    it('happy: tam ödeme → paid', async () => {
      const inv = await createUC().execute({
        companyId: 100,
        type: 'in',
        counterparty: 'A',
        dueDate: '2026-07-01',
        currency: 'TRY',
        subtotal: 100,
        actorUserId: null,
      });
      const result = await new RecordPaymentUseCase(invoices, payments, clock).execute({
        companyId: 100,
        invoiceId: inv.id!,
        amount: 120,
        date: '2026-06-15',
        actorUserId: null,
      });
      assert.equal(result.invoice.status, 'paid');
      assert.equal(result.invoice.remaining, '0.00');
    });

    it("edge: ödeme total'i aşamaz", async () => {
      const inv = await createUC().execute({
        companyId: 100,
        type: 'in',
        counterparty: 'A',
        dueDate: '2026-07-01',
        currency: 'TRY',
        subtotal: 100,
        actorUserId: null,
      });
      await assert.rejects(
        new RecordPaymentUseCase(invoices, payments, clock).execute({
          companyId: 100,
          invoiceId: inv.id!,
          amount: 500,
          date: '2026-06-15',
          actorUserId: null,
        }),
      );
    });

    it('edge: olmayan fatura → InvoiceNotFoundError', async () => {
      await assert.rejects(
        new RecordPaymentUseCase(invoices, payments, clock).execute({
          companyId: 100,
          invoiceId: 999,
          amount: 50,
          date: '2026-06-15',
          actorUserId: null,
        }),
        InvoiceNotFoundError,
      );
    });

    it('edge: multi-tenant — başka şirket faturasına ödeme yapamaz', async () => {
      const inv = await createUC().execute({
        companyId: 100,
        type: 'in',
        counterparty: 'A',
        dueDate: '2026-07-01',
        currency: 'TRY',
        subtotal: 100,
        actorUserId: null,
      });
      await assert.rejects(
        new RecordPaymentUseCase(invoices, payments, clock).execute({
          companyId: 200,
          invoiceId: inv.id!,
          amount: 50,
          date: '2026-06-15',
          actorUserId: null,
        }),
        InvoiceNotFoundError,
      );
    });
  });

  describe('DeletePaymentUseCase', () => {
    it('happy: ödeme silinince paidAmount düşer', async () => {
      const inv = await createUC().execute({
        companyId: 100,
        type: 'in',
        counterparty: 'A',
        dueDate: '2026-07-01',
        currency: 'TRY',
        subtotal: 100,
        actorUserId: null,
      });
      const rec = await new RecordPaymentUseCase(invoices, payments, clock).execute({
        companyId: 100,
        invoiceId: inv.id!,
        amount: 50,
        date: '2026-06-15',
        actorUserId: null,
      });
      const updated = await new DeletePaymentUseCase(invoices, payments, clock).execute({
        companyId: 100,
        paymentId: rec.payment.id!,
      });
      assert.equal(updated.paidAmount, '0.00');
      assert.equal(updated.status, 'open');
    });

    it('edge: olmayan ödeme → InvoicePaymentNotFoundError', async () => {
      await assert.rejects(
        new DeletePaymentUseCase(invoices, payments, clock).execute({
          companyId: 100,
          paymentId: 999,
        }),
        InvoicePaymentNotFoundError,
      );
    });
  });

  describe('ListInvoicesUseCase + GetOverdueInvoices', () => {
    it('type filtresi + status hesabı', async () => {
      await createUC().execute({
        companyId: 100,
        type: 'in',
        counterparty: 'AR',
        dueDate: '2026-07-01',
        currency: 'TRY',
        subtotal: 100,
        actorUserId: null,
      });
      await createUC().execute({
        companyId: 100,
        type: 'out',
        counterparty: 'AP',
        dueDate: '2026-07-01',
        currency: 'TRY',
        subtotal: 200,
        actorUserId: null,
      });
      const incoming = await new ListInvoicesUseCase(invoices, clock).execute({
        companyId: 100,
        type: 'in',
      });
      assert.equal(incoming.length, 1);
      assert.equal(incoming[0]!.counterparty, 'AR');
    });

    it('GetOverdueInvoices: vadesi geçmiş + ödenmemiş', async () => {
      // dueDate 2026-05-01 < today 2026-06-01 → overdue
      await createUC().execute({
        companyId: 100,
        type: 'in',
        counterparty: 'Geç',
        dueDate: '2026-05-01',
        currency: 'TRY',
        subtotal: 100,
        actorUserId: null,
      });
      // dueDate 2026-07-01 > today → open (overdue değil)
      await createUC().execute({
        companyId: 100,
        type: 'in',
        counterparty: 'Erken',
        dueDate: '2026-07-01',
        currency: 'TRY',
        subtotal: 100,
        actorUserId: null,
      });
      const overdue = await new GetOverdueInvoicesUseCase(invoices, clock).execute({
        companyId: 100,
      });
      assert.equal(overdue.length, 1);
      assert.equal(overdue[0]!.counterparty, 'Geç');
      assert.equal(overdue[0]!.status, 'overdue');
    });
  });
});
