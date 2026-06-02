/**
 * Invoice domain testleri: Invoice, InvoicePayment, InvoiceStatusPolicy.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Invoice, type InvoiceProps } from '../../domain/entities/Invoice.js';
import { InvoicePayment } from '../../domain/entities/InvoicePayment.js';
import { InvoiceStatusPolicy } from '../../domain/services/InvoiceStatusPolicy.js';
import { KdvCalculator } from '../../domain/services/KdvCalculator.js';
import { KdvRate } from '../../domain/valueObjects/KdvRate.js';
import { Money } from '../../domain/valueObjects/Money.js';

const NOW = new Date('2026-01-01T00:00:00Z');

/** %20 KDV ile subtotal'dan tutarlı bir fatura kurar. */
function makeInvoice(overrides: Partial<InvoiceProps> = {}): Invoice {
  const subtotal = overrides.subtotal ?? Money.fromMajor(100, 'TRY');
  const rate = overrides.kdvRate ?? KdvRate.default();
  const totals = KdvCalculator.fromSubtotal(subtotal, rate);
  return Invoice.create({
    id: 1,
    companyId: 100,
    type: 'in',
    invoiceNo: 'FT-001',
    counterparty: 'ACME A.Ş.',
    issueDate: '2026-01-01',
    dueDate: '2026-02-01',
    currency: 'TRY',
    subtotal: totals.subtotal,
    kdvRate: rate,
    kdv: totals.kdv,
    total: totals.total,
    paidAmount: Money.zero('TRY'),
    cashflowCatId: null,
    committedToCells: false,
    committedAt: null,
    note: null,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

describe('Invoice', () => {
  it('geçerli fatura: total = subtotal + kdv', () => {
    const inv = makeInvoice();
    assert.equal(inv.subtotal.toDecimalString(), '100.00');
    assert.equal(inv.kdv.toDecimalString(), '20.00');
    assert.equal(inv.total.toDecimalString(), '120.00');
    assert.equal(inv.remaining().toDecimalString(), '120.00');
  });

  it('total != subtotal + kdv ise fırlatır', () => {
    assert.throws(() =>
      Invoice.create({
        id: 1,
        companyId: 100,
        type: 'in',
        invoiceNo: null,
        counterparty: 'X',
        issueDate: null,
        dueDate: '2026-02-01',
        currency: 'TRY',
        subtotal: Money.fromMajor(100, 'TRY'),
        kdvRate: KdvRate.default(),
        kdv: Money.fromMajor(20, 'TRY'),
        total: Money.fromMajor(999, 'TRY'), // tutarsız
        paidAmount: Money.zero('TRY'),
        cashflowCatId: null,
        committedToCells: false,
        committedAt: null,
        note: null,
        createdBy: null,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  });

  it('currency tutarsızlığı fırlatır', () => {
    assert.throws(() => makeInvoice({ paidAmount: Money.fromMajor(10, 'USD') }));
  });

  it('applyPayment: paidAmount artar, remaining düşer', () => {
    const inv = makeInvoice().applyPayment(Money.fromMajor(50, 'TRY'), NOW);
    assert.equal(inv.paidAmount.toDecimalString(), '50.00');
    assert.equal(inv.remaining().toDecimalString(), '70.00');
  });

  it('applyPayment: total aşımı fırlatır', () => {
    assert.throws(() => makeInvoice().applyPayment(Money.fromMajor(200, 'TRY'), NOW));
  });

  it('removePayment: paidAmount düşer, negatife inmez', () => {
    const inv = makeInvoice().applyPayment(Money.fromMajor(50, 'TRY'), NOW);
    const back = inv.removePayment(Money.fromMajor(80, 'TRY'), NOW);
    assert.equal(back.paidAmount.toDecimalString(), '0.00'); // clamp
  });

  it('remaining negatife düşmez (fazla ödeme tolerans)', () => {
    const inv = makeInvoice().applyPayment(Money.fromMajor(120, 'TRY'), NOW);
    assert.equal(inv.remaining().toDecimalString(), '0.00');
  });
});

describe('InvoicePayment', () => {
  it('geçerli ödeme', () => {
    const p = InvoicePayment.create({
      id: 1,
      invoiceId: 5,
      amount: Money.fromMajor(50, 'TRY'),
      date: '2026-01-15',
      currency: 'TRY',
      bankAccountId: 3,
      kasaAccountId: null,
      note: null,
      createdBy: null,
      createdAt: NOW,
    });
    assert.equal(p.amount.toDecimalString(), '50.00');
    assert.equal(p.bankAccountId, 3);
  });

  it('hem banka hem kasa bağı yasak', () => {
    assert.throws(() =>
      InvoicePayment.create({
        id: 1,
        invoiceId: 5,
        amount: Money.fromMajor(50, 'TRY'),
        date: '2026-01-15',
        currency: 'TRY',
        bankAccountId: 3,
        kasaAccountId: 4,
        note: null,
        createdBy: null,
        createdAt: NOW,
      }),
    );
  });

  it('negatif/sıfır tutar yasak', () => {
    assert.throws(() =>
      InvoicePayment.create({
        id: 1,
        invoiceId: 5,
        amount: Money.zero('TRY'),
        date: '2026-01-15',
        currency: 'TRY',
        bankAccountId: null,
        kasaAccountId: null,
        note: null,
        createdBy: null,
        createdAt: NOW,
      }),
    );
  });
});

describe('InvoiceStatusPolicy', () => {
  it('open: hiç ödeme yok, vade gelmemiş', () => {
    const inv = makeInvoice({ dueDate: '2026-02-01' });
    assert.equal(InvoiceStatusPolicy.status(inv, '2026-01-15'), 'open');
  });

  it('overdue: hiç ödeme yok, vade geçmiş', () => {
    const inv = makeInvoice({ dueDate: '2026-01-10' });
    assert.equal(InvoiceStatusPolicy.status(inv, '2026-01-15'), 'overdue');
  });

  it('partial: kısmi ödeme (vade geçse bile partial)', () => {
    const inv = makeInvoice({ dueDate: '2026-01-10' }).applyPayment(
      Money.fromMajor(50, 'TRY'),
      NOW,
    );
    assert.equal(InvoiceStatusPolicy.status(inv, '2026-01-15'), 'partial');
  });

  it('paid: tam ödeme', () => {
    const inv = makeInvoice().applyPayment(Money.fromMajor(120, 'TRY'), NOW);
    assert.equal(InvoiceStatusPolicy.status(inv, '2026-01-15'), 'paid');
  });

  it('paid: 1 kuruş tolerans (119.99 → paid)', () => {
    const inv = makeInvoice().applyPayment(Money.fromMajor(119.99, 'TRY'), NOW);
    assert.equal(InvoiceStatusPolicy.status(inv, '2026-01-15'), 'paid');
  });
});
