/**
 * CashflowCommitPolicy domain servis testleri.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Invoice } from '../../domain/entities/Invoice.js';
import { KasaEntry } from '../../domain/entities/KasaEntry.js';
import { Transfer } from '../../domain/entities/Transfer.js';
import { CashflowCommitPolicy } from '../../domain/services/CashflowCommitPolicy.js';
import { KdvCalculator } from '../../domain/services/KdvCalculator.js';
import { KdvRate } from '../../domain/valueObjects/KdvRate.js';
import { Money } from '../../domain/valueObjects/Money.js';

const NOW = new Date('2026-01-01T00:00:00Z');

describe('CashflowCommitPolicy', () => {
  describe('forKasaEntry', () => {
    it('cashflowCatId yoksa null', () => {
      const entry = KasaEntry.create({
        id: 1,
        kasaAccountId: 1,
        date: '2026-03-15',
        type: 'in',
        amount: Money.fromMajor(100, 'TRY'),
        description: null,
        category: null,
        cashflowCatId: null,
        committedToCells: false,
        committedAt: null,
        createdBy: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
      assert.equal(CashflowCommitPolicy.forKasaEntry(entry), null);
    });

    it('in girişi → +amount, Mart (monthIdx 2)', () => {
      const entry = KasaEntry.create({
        id: 1,
        kasaAccountId: 1,
        date: '2026-03-15',
        type: 'in',
        amount: Money.fromMajor(100, 'TRY'),
        description: null,
        category: null,
        cashflowCatId: 42,
        committedToCells: false,
        committedAt: null,
        createdBy: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
      const delta = CashflowCommitPolicy.forKasaEntry(entry)!;
      assert.equal(delta.categoryId, 42);
      assert.equal(delta.fiscalYear, 2026);
      assert.equal(delta.monthIdx, 2); // Mart
      assert.equal(delta.amount.toDecimalString(), '100.00');
    });

    it('out çıkışı → −amount', () => {
      const entry = KasaEntry.create({
        id: 1,
        kasaAccountId: 1,
        date: '2026-01-10',
        type: 'out',
        amount: Money.fromMajor(250, 'TRY'),
        description: null,
        category: null,
        cashflowCatId: 7,
        committedToCells: false,
        committedAt: null,
        createdBy: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
      const delta = CashflowCommitPolicy.forKasaEntry(entry)!;
      assert.equal(delta.amount.toDecimalString(), '-250.00');
      assert.equal(delta.monthIdx, 0); // Ocak
    });
  });

  describe('forTransfer', () => {
    it('cashflowCatId varsa fromAmount, ay tarihten', () => {
      const t = Transfer.create({
        id: 1,
        companyId: 100,
        date: '2026-06-01',
        fromType: 'bank',
        fromId: 1,
        toType: 'kasa',
        toId: 2,
        fromAmount: Money.fromMajor(1000, 'TRY'),
        toAmount: Money.fromMajor(1000, 'TRY'),
        description: null,
        cashflowCatId: 5,
        committedToCells: false,
        committedAt: null,
        createdBy: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
      const delta = CashflowCommitPolicy.forTransfer(t)!;
      assert.equal(delta.categoryId, 5);
      assert.equal(delta.monthIdx, 5); // Haziran
      assert.equal(delta.amount.toDecimalString(), '1000.00');
    });

    it('cashflowCatId yoksa null', () => {
      const t = Transfer.create({
        id: 1,
        companyId: 100,
        date: '2026-06-01',
        fromType: 'bank',
        fromId: 1,
        toType: 'kasa',
        toId: 2,
        fromAmount: Money.fromMajor(1000, 'TRY'),
        toAmount: Money.fromMajor(1000, 'TRY'),
        description: null,
        cashflowCatId: null,
        committedToCells: false,
        committedAt: null,
        createdBy: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
      assert.equal(CashflowCommitPolicy.forTransfer(t), null);
    });
  });

  describe('forInvoice', () => {
    function invoice(type: 'in' | 'out', catId: number | null): Invoice {
      const totals = KdvCalculator.fromSubtotal(Money.fromMajor(100, 'TRY'), KdvRate.default());
      return Invoice.create({
        id: 1,
        companyId: 100,
        type,
        invoiceNo: null,
        counterparty: 'X',
        issueDate: null,
        dueDate: '2026-09-30',
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

    it('type in → +total, dueDate ayı (Eylül = 8)', () => {
      const delta = CashflowCommitPolicy.forInvoice(invoice('in', 9))!;
      assert.equal(delta.amount.toDecimalString(), '120.00');
      assert.equal(delta.monthIdx, 8); // Eylül
      assert.equal(delta.categoryId, 9);
    });

    it('type out → −total', () => {
      const delta = CashflowCommitPolicy.forInvoice(invoice('out', 9))!;
      assert.equal(delta.amount.toDecimalString(), '-120.00');
    });

    it('cashflowCatId yoksa null', () => {
      assert.equal(CashflowCommitPolicy.forInvoice(invoice('in', null)), null);
    });
  });
});
