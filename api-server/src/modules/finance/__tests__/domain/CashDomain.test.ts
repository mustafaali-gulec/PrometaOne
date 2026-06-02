/**
 * Cash domain testleri: BankAccount, KasaAccount, KasaEntry, Transfer,
 * CashPositionCalculator.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BankAccount } from '../../domain/entities/BankAccount.js';
import { KasaAccount } from '../../domain/entities/KasaAccount.js';
import { KasaEntry, type KasaEntryProps } from '../../domain/entities/KasaEntry.js';
import { Transfer, type TransferProps } from '../../domain/entities/Transfer.js';
import { CashPositionCalculator } from '../../domain/services/CashPositionCalculator.js';
import { Money } from '../../domain/valueObjects/Money.js';

const NOW = new Date('2026-01-01T00:00:00Z');

describe('BankAccount', () => {
  it('geçerli oluşur', () => {
    const a = BankAccount.create({
      id: 1,
      companyId: 100,
      bankId: 5,
      name: 'Vadesiz TRY',
      iban: 'TR00',
      accountNo: '123',
      currency: 'TRY',
      openingBalance: Money.fromMajor(1000, 'TRY'),
      cashflowCatId: null,
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(a.openingBalance.toDecimalString(), '1000.00');
  });

  it('openingBalance currency hesap currency ile eşleşmeli', () => {
    assert.throws(() =>
      BankAccount.create({
        id: 1,
        companyId: 100,
        bankId: 5,
        name: 'X',
        iban: null,
        accountNo: null,
        currency: 'TRY',
        openingBalance: Money.fromMajor(1000, 'USD'),
        cashflowCatId: null,
        active: true,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  });

  it('rename + archive', () => {
    const a = BankAccount.create({
      id: 1,
      companyId: 100,
      bankId: 5,
      name: 'Eski',
      iban: null,
      accountNo: null,
      currency: 'TRY',
      openingBalance: Money.zero('TRY'),
      cashflowCatId: null,
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(a.rename('Yeni', NOW).name, 'Yeni');
    assert.equal(a.archive(NOW).active, false);
  });
});

describe('KasaAccount', () => {
  it('geçerli oluşur + currency uyumu', () => {
    const k = KasaAccount.create({
      id: 1,
      companyId: 100,
      name: 'Merkez Kasa',
      currency: 'TRY',
      openingBalance: Money.fromMajor(500, 'TRY'),
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(k.openingBalance.toDecimalString(), '500.00');
  });
});

function kasaEntry(overrides: Partial<KasaEntryProps> = {}): KasaEntry {
  return KasaEntry.create({
    id: 1,
    kasaAccountId: 1,
    date: '2026-01-15',
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
    ...overrides,
  });
}

describe('KasaEntry', () => {
  it('amount pozitif olmalı', () => {
    assert.throws(() => kasaEntry({ amount: Money.fromMajor(-5, 'TRY') }));
    assert.throws(() => kasaEntry({ amount: Money.zero('TRY') }));
  });

  it('signedAmount: in → +, out → −', () => {
    assert.equal(kasaEntry({ type: 'in' }).signedAmount().toDecimalString(), '100.00');
    assert.equal(kasaEntry({ type: 'out' }).signedAmount().toDecimalString(), '-100.00');
  });

  it('markCommitted idempotent', () => {
    const e = kasaEntry({ committedToCells: false });
    const c = e.markCommitted(NOW);
    assert.ok(c.committedToCells);
    assert.equal(c.markCommitted(NOW), c); // ikinci çağrı no-op
  });
});

function transfer(overrides: Partial<TransferProps> = {}): Transfer {
  return Transfer.create({
    id: 1,
    companyId: 100,
    date: '2026-01-15',
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
    ...overrides,
  });
}

describe('Transfer', () => {
  it('geçerli transfer', () => {
    const t = transfer();
    assert.ok(t.isFrom('bank', 1));
    assert.ok(t.isTo('kasa', 2));
  });

  it('aynı hesaba transfer yasak', () => {
    assert.throws(() => transfer({ fromType: 'bank', fromId: 1, toType: 'bank', toId: 1 }));
  });

  it('farklı tip aynı id serbest (bank#1 → kasa#1)', () => {
    const t = transfer({ fromType: 'bank', fromId: 1, toType: 'kasa', toId: 1 });
    assert.ok(t.isFrom('bank', 1));
    assert.ok(t.isTo('kasa', 1));
  });

  it('multi-currency: from TRY, to USD ayrı tutar', () => {
    const t = transfer({
      fromAmount: Money.fromMajor(35000, 'TRY'),
      toAmount: Money.fromMajor(1000, 'USD'),
    });
    assert.equal(t.fromAmount.currency, 'TRY');
    assert.equal(t.toAmount.currency, 'USD');
  });

  it('negatif/sıfır tutar yasak', () => {
    assert.throws(() => transfer({ fromAmount: Money.zero('TRY') }));
    assert.throws(() => transfer({ toAmount: Money.fromMajor(-1, 'TRY') }));
  });
});

describe('CashPositionCalculator', () => {
  it('sadece opening balance', () => {
    const balance = CashPositionCalculator.compute({
      currency: 'TRY',
      openingBalance: Money.fromMajor(1000, 'TRY'),
    });
    assert.equal(balance.toDecimalString(), '1000.00');
  });

  it('kasa girişleri/çıkışları + transferler', () => {
    const balance = CashPositionCalculator.compute({
      currency: 'TRY',
      openingBalance: Money.fromMajor(1000, 'TRY'),
      kasaEntries: [
        kasaEntry({ type: 'in', amount: Money.fromMajor(500, 'TRY') }),
        kasaEntry({ type: 'out', amount: Money.fromMajor(200, 'TRY') }),
      ],
      incomingTransfers: [transfer({ toAmount: Money.fromMajor(300, 'TRY') })],
      outgoingTransfers: [transfer({ fromAmount: Money.fromMajor(100, 'TRY') })],
    });
    // 1000 + 500 - 200 + 300 - 100 = 1500
    assert.equal(balance.toDecimalString(), '1500.00');
  });

  it('para birimi uyuşmazlığı fırlatır (koruma)', () => {
    assert.throws(() =>
      CashPositionCalculator.compute({
        currency: 'TRY',
        openingBalance: Money.fromMajor(1000, 'TRY'),
        incomingTransfers: [transfer({ toAmount: Money.fromMajor(100, 'USD') })],
      }),
    );
  });
});
