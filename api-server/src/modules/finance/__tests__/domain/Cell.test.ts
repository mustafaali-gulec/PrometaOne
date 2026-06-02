/**
 * Cell entity testleri.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Cell, type CellProps } from '../../domain/entities/Cell.js';
import { FiscalYear } from '../../domain/valueObjects/FiscalYear.js';
import { Money } from '../../domain/valueObjects/Money.js';
import { MonthIndex } from '../../domain/valueObjects/MonthIndex.js';

const NOW = new Date('2026-01-01T00:00:00Z');

function makeProps(overrides: Partial<CellProps> = {}): CellProps {
  return {
    id: 1,
    companyId: 100,
    categoryId: 10,
    fiscalYear: FiscalYear.create(2026),
    monthIdx: MonthIndex.create(0),
    value: Money.fromMajor(1000, 'TRY'),
    updatedAt: NOW,
    updatedBy: null,
    ...overrides,
  };
}

describe('Cell', () => {
  describe('create()', () => {
    it('geçerli props', () => {
      const c = Cell.create(makeProps());
      assert.equal(c.value.toDecimalString(), '1000.00');
      assert.equal(c.fiscalYear.value, 2026);
      assert.equal(c.monthIdx.value, 0);
    });
    it('id=null kabul (yeni hücre)', () => {
      assert.equal(Cell.create(makeProps({ id: null })).id, null);
    });
    it('id <= 0 fırlatır', () => {
      assert.throws(() => Cell.create(makeProps({ id: 0 })));
    });
    it('categoryId <= 0 fırlatır', () => {
      assert.throws(() => Cell.create(makeProps({ categoryId: -1 })));
    });
  });

  describe('setValue()', () => {
    it('yeni değerle yeni instance + updatedBy', () => {
      const c = Cell.create(makeProps());
      const r = c.setValue(Money.fromMajor(2000, 'TRY'), NOW, 7);
      assert.equal(r.value.toDecimalString(), '2000.00');
      assert.equal(r.updatedBy, 7);
      assert.equal(c.value.toDecimalString(), '1000.00'); // orijinal değişmez
    });
    it('aynı değer no-op (aynı instance)', () => {
      const c = Cell.create(makeProps({ value: Money.fromMajor(1000, 'TRY') }));
      assert.equal(c.setValue(Money.fromMajor(1000, 'TRY'), NOW, 7), c);
    });
  });

  describe('toJSON()', () => {
    it('value decimal string olarak serileşir', () => {
      const json = Cell.create(makeProps()).toJSON();
      assert.equal(json.value, '1000.00');
      assert.equal(json.fiscalYear, 2026);
      assert.equal(json.monthIdx, 0);
    });
  });
});
