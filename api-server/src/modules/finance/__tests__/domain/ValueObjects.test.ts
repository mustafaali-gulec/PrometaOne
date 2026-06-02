/**
 * Finance temel value object testleri:
 * Currency, KdvRate, FiscalYear, MonthIndex, FlowDirection, CategorySection.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InvalidCurrencyError,
  InvalidFiscalYearError,
  InvalidKdvRateError,
  InvalidMonthIndexError,
} from '../../domain/errors/FinanceErrors.js';
import {
  ALL_CATEGORY_SECTIONS,
  isCategorySection,
  isPnlSection,
} from '../../domain/valueObjects/CategorySection.js';
import { ALL_CURRENCIES, isCurrency, toCurrency } from '../../domain/valueObjects/Currency.js';
import { FiscalYear } from '../../domain/valueObjects/FiscalYear.js';
import { ALL_FLOW_DIRECTIONS, isFlowDirection } from '../../domain/valueObjects/FlowDirection.js';
import { KdvRate } from '../../domain/valueObjects/KdvRate.js';
import { MonthIndex } from '../../domain/valueObjects/MonthIndex.js';

describe('Currency', () => {
  it('ALL_CURRENCIES = TRY/USD/EUR', () => {
    assert.deepEqual([...ALL_CURRENCIES], ['TRY', 'USD', 'EUR']);
  });
  it('isCurrency type guard', () => {
    assert.ok(isCurrency('TRY'));
    assert.ok(!isCurrency('GBP'));
    assert.ok(!isCurrency(42));
  });
  it('toCurrency geçersizde fırlatır', () => {
    assert.equal(toCurrency('EUR'), 'EUR');
    assert.throws(() => toCurrency('GBP'), InvalidCurrencyError);
  });
});

describe('KdvRate', () => {
  it('create 0–1 sınırları', () => {
    assert.equal(KdvRate.create(0).value, 0);
    assert.equal(KdvRate.create(1).value, 1);
    assert.equal(KdvRate.create(0.2).value, 0.2);
  });
  it('sınır dışı fırlatır', () => {
    assert.throws(() => KdvRate.create(-0.1), InvalidKdvRateError);
    assert.throws(() => KdvRate.create(1.5), InvalidKdvRateError);
    assert.throws(() => KdvRate.create(NaN), InvalidKdvRateError);
  });
  it('fromPercent + default + toPercent', () => {
    assert.equal(KdvRate.fromPercent(20).value, 0.2);
    assert.equal(KdvRate.default().value, 0.2);
    assert.equal(KdvRate.fromPercent(10).toPercent(), 10);
  });
});

describe('FiscalYear', () => {
  it('geçerli yıl', () => {
    assert.equal(FiscalYear.create(2026).value, 2026);
  });
  it('sınır dışı / non-integer fırlatır', () => {
    assert.throws(() => FiscalYear.create(1999), InvalidFiscalYearError);
    assert.throws(() => FiscalYear.create(2101), InvalidFiscalYearError);
    assert.throws(() => FiscalYear.create(2026.5), InvalidFiscalYearError);
  });
});

describe('MonthIndex', () => {
  it('0–11 geçerli, ay adı', () => {
    assert.equal(MonthIndex.create(0).nameTr(), 'Ocak');
    assert.equal(MonthIndex.create(11).nameTr(), 'Aralık');
  });
  it('sınır dışı fırlatır', () => {
    assert.throws(() => MonthIndex.create(-1), InvalidMonthIndexError);
    assert.throws(() => MonthIndex.create(12), InvalidMonthIndexError);
  });
  it('all() 12 ay döner', () => {
    const all = MonthIndex.all();
    assert.equal(all.length, 12);
    assert.equal(all[0]!.value, 0);
    assert.equal(all[11]!.value, 11);
  });
});

describe('FlowDirection', () => {
  it('in/out type guard', () => {
    assert.deepEqual([...ALL_FLOW_DIRECTIONS], ['in', 'out']);
    assert.ok(isFlowDirection('in'));
    assert.ok(!isFlowDirection('sideways'));
  });
});

describe('CategorySection', () => {
  it('4 bölüm', () => {
    assert.deepEqual(
      [...ALL_CATEGORY_SECTIONS],
      ['inflows', 'outflows', 'nonPnlOutflows', 'kasaCategories'],
    );
  });
  it('isCategorySection type guard', () => {
    assert.ok(isCategorySection('inflows'));
    assert.ok(!isCategorySection('foo'));
  });
  it('isPnlSection: yalnız inflows/outflows', () => {
    assert.ok(isPnlSection('inflows'));
    assert.ok(isPnlSection('outflows'));
    assert.ok(!isPnlSection('nonPnlOutflows'));
    assert.ok(!isPnlSection('kasaCategories'));
  });
});
