/**
 * PgInvoiceRepository + invoice_payments trigger + v_invoice_status integration test.
 *
 * Bu test, DB-tarafı davranışları doğrular (domain'de görünmez):
 *   - `invoice_payments` AFTER INSERT/DELETE trigger'ı invoices.paid_amount'u
 *     otomatik günceller (SUM(payments)).
 *   - `v_invoice_status` view'ı open/partial/paid/overdue durumunu üretir
 *     (InvoiceStatusPolicy ile birebir mantık).
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { CreateInvoiceUseCase } from '../../application/useCases/InvoiceUseCases.js';
import { InvoicePayment } from '../../domain/entities/InvoicePayment.js';
import { Money } from '../../domain/valueObjects/Money.js';
import { PgInvoicePaymentRepository } from '../../infrastructure/persistence/PgInvoicePaymentRepository.js';
import { PgInvoiceRepository } from '../../infrastructure/persistence/PgInvoiceRepository.js';
import { FixedClock } from '../fakes.js';

import {
  seedCompany,
  startFinancePgContainer,
  truncateAllFinanceTables,
  type FinancePgContext,
} from './setup.js';

describe('PgInvoiceRepository + trigger + view [integration]', () => {
  let ctx: FinancePgContext;
  const clock = new FixedClock();

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
  });

  async function paidAmount(invoiceId: number): Promise<string> {
    const r = await ctx.pool.query<{ paid_amount: string }>(
      `SELECT paid_amount FROM invoices WHERE id = $1`,
      [invoiceId],
    );
    return r.rows[0]!.paid_amount;
  }

  async function status(invoiceId: number): Promise<string> {
    const r = await ctx.pool.query<{ status: string }>(
      `SELECT status FROM v_invoice_status WHERE id = $1`,
      [invoiceId],
    );
    return r.rows[0]!.status;
  }

  it('trigger: ödeme INSERT edilince paid_amount otomatik artar', async () => {
    const invoices = new PgInvoiceRepository(ctx.pool);
    const payments = new PgInvoicePaymentRepository(ctx.pool);
    const inv = await new CreateInvoiceUseCase(invoices, clock).execute({
      companyId: 1,
      type: 'in',
      counterparty: 'Müşteri',
      dueDate: '2099-12-31',
      currency: 'TRY',
      subtotal: 1000,
      actorUserId: null,
    });
    const invoiceId = inv.id!;

    // paid_amount sadece trigger ile güncellenmeli — invoice.update çağırmıyoruz
    await payments.insert(
      InvoicePayment.create({
        id: null,
        invoiceId,
        amount: Money.fromMajor(500, 'TRY'),
        date: '2026-01-15',
        currency: 'TRY',
        bankAccountId: null,
        kasaAccountId: null,
        note: null,
        createdBy: null,
        createdAt: clock.now(),
      }),
    );

    assert.equal(await paidAmount(invoiceId), '500.00');
    assert.equal(await status(invoiceId), 'partial');
  });

  it('trigger: birden çok ödeme toplanır, DELETE sonrası geri düşer', async () => {
    const invoices = new PgInvoiceRepository(ctx.pool);
    const payments = new PgInvoicePaymentRepository(ctx.pool);
    const inv = await new CreateInvoiceUseCase(invoices, clock).execute({
      companyId: 1,
      type: 'in',
      counterparty: 'Müşteri',
      dueDate: '2099-12-31',
      currency: 'TRY',
      subtotal: 1000,
      kdvRate: 0,
      actorUserId: null,
    });
    const invoiceId = inv.id!;

    const p1 = await payments.insert(
      InvoicePayment.create({
        id: null,
        invoiceId,
        amount: Money.fromMajor(400, 'TRY'),
        date: '2026-01-10',
        currency: 'TRY',
        bankAccountId: null,
        kasaAccountId: null,
        note: null,
        createdBy: null,
        createdAt: clock.now(),
      }),
    );
    await payments.insert(
      InvoicePayment.create({
        id: null,
        invoiceId,
        amount: Money.fromMajor(600, 'TRY'),
        date: '2026-01-20',
        currency: 'TRY',
        bankAccountId: null,
        kasaAccountId: null,
        note: null,
        createdBy: null,
        createdAt: clock.now(),
      }),
    );

    // 400 + 600 = 1000 = total → paid
    assert.equal(await paidAmount(invoiceId), '1000.00');
    assert.equal(await status(invoiceId), 'paid');

    // ilk ödeme silinince trigger 1000 - 400 = 600'e düşürür
    await payments.remove(p1.id!);
    assert.equal(await paidAmount(invoiceId), '600.00');
    assert.equal(await status(invoiceId), 'partial');
  });

  it('view: ödeme yok + vade geçmiş → overdue, vade ileri → open', async () => {
    const invoices = new PgInvoiceRepository(ctx.pool);
    const overdueInv = await new CreateInvoiceUseCase(invoices, clock).execute({
      companyId: 1,
      type: 'out',
      counterparty: 'Tedarikçi',
      dueDate: '2020-01-01',
      currency: 'TRY',
      subtotal: 500,
      actorUserId: null,
    });
    const openInv = await new CreateInvoiceUseCase(invoices, clock).execute({
      companyId: 1,
      type: 'out',
      counterparty: 'Tedarikçi',
      dueDate: '2099-12-31',
      currency: 'TRY',
      subtotal: 500,
      actorUserId: null,
    });

    assert.equal(await status(overdueInv.id!), 'overdue');
    assert.equal(await status(openInv.id!), 'open');
  });
});
