/**
 * Money value object testleri — integer kuruş aritmetiği.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CurrencyMismatchError,
  InvalidAllocationError,
  InvalidMoneyError,
} from '../../domain/errors/FinanceErrors.js';
import { Money } from '../../domain/valueObjects/Money.js';

describe('Money', () => {
  describe('factory', () => {
    it('fromMajor: 12.50 → 1250 kuruş', () => {
      const m = Money.fromMajor(12.5, 'TRY');
      assert.equal(m.minorValue, 1250);
      assert.equal(m.toMajor(), 12.5);
      assert.equal(m.currency, 'TRY');
    });

    it('fromMajor: 2 ondalık ötesini round ile yuvarlar', () => {
      // Float-güvenli değerler: 12.999*100=1299.9→1300, 12.991*100=1299.1→1299
      assert.equal(Money.fromMajor(12.999, 'TRY').minorValue, 1300);
      assert.equal(Money.fromMajor(12.991, 'TRY').minorValue, 1299);
    });

    it('fromMinor: tam sayı zorunlu', () => {
      assert.throws(() => Money.fromMinor(12.5, 'TRY'), InvalidMoneyError);
    });

    it('fromMajor: sonsuz/NaN reddeder', () => {
      assert.throws(() => Money.fromMajor(Infinity, 'TRY'), InvalidMoneyError);
      assert.throws(() => Money.fromMajor(NaN, 'USD'), InvalidMoneyError);
    });

    it('zero + fromDecimalString', () => {
      assert.equal(Money.zero('EUR').minorValue, 0);
      assert.equal(Money.fromDecimalString('1250.00', 'TRY').minorValue, 125000);
      assert.equal(Money.fromDecimalString(12.5, 'TRY').minorValue, 1250);
    });
  });

  describe('aritmetik', () => {
    it('plus / minus aynı para biriminde', () => {
      const a = Money.fromMajor(10, 'TRY');
      const b = Money.fromMajor(2.5, 'TRY');
      assert.equal(a.plus(b).toMajor(), 12.5);
      assert.equal(a.minus(b).toMajor(), 7.5);
    });

    it('plus farklı para biriminde fırlatır', () => {
      const a = Money.fromMajor(10, 'TRY');
      const b = Money.fromMajor(10, 'USD');
      assert.throws(() => a.plus(b), CurrencyMismatchError);
    });

    it('float hatası YOK: 0.1 + 0.2 === 0.3', () => {
      const sum = Money.fromMajor(0.1, 'TRY').plus(Money.fromMajor(0.2, 'TRY'));
      assert.equal(sum.minorValue, 30);
      assert.equal(sum.toMajor(), 0.3);
    });

    it('multiply round-half-up: 12.50 × 0.20 = 2.50', () => {
      const kdv = Money.fromMajor(12.5, 'TRY').multiply(0.2);
      assert.equal(kdv.minorValue, 250);
    });

    it('multiply round-half-up: 1001 kuruş × 0.5 = 500.5 → 501', () => {
      // 1000 kuruş × 0.185 = 185.0 → 185 kuruş
      assert.equal(Money.fromMajor(10, 'TRY').multiply(0.185).minorValue, 185);
      // 1001 kuruş × 0.5 = 500.5 → round-half-up → 501
      assert.equal(Money.fromMinor(1001, 'TRY').multiply(0.5).minorValue, 501);
    });

    it('negate / abs', () => {
      const m = Money.fromMajor(10, 'TRY');
      assert.equal(m.negate().minorValue, -1000);
      assert.equal(m.negate().abs().minorValue, 1000);
    });
  });

  describe('allocate', () => {
    it('100 kuruş / 3 → [34, 33, 33] (toplam korunur)', () => {
      const parts = Money.fromMinor(100, 'TRY').allocate(3);
      assert.deepEqual(
        parts.map((p) => p.minorValue),
        [34, 33, 33],
      );
      const total = parts.reduce((acc, p) => acc.plus(p), Money.zero('TRY'));
      assert.equal(total.minorValue, 100);
    });

    it('tam bölünen: 90 / 3 → [30, 30, 30]', () => {
      const parts = Money.fromMinor(90, 'TRY').allocate(3);
      assert.deepEqual(
        parts.map((p) => p.minorValue),
        [30, 30, 30],
      );
    });

    it('negatif tutar dağıtımı işareti korur', () => {
      const parts = Money.fromMinor(-100, 'TRY').allocate(3);
      assert.deepEqual(
        parts.map((p) => p.minorValue),
        [-34, -33, -33],
      );
      assert.equal(parts.reduce((acc, p) => acc.plus(p), Money.zero('TRY')).minorValue, -100);
    });

    it('geçersiz parça sayısı fırlatır', () => {
      assert.throws(() => Money.fromMinor(100, 'TRY').allocate(0), InvalidAllocationError);
      assert.throws(() => Money.fromMinor(100, 'TRY').allocate(-2), InvalidAllocationError);
      assert.throws(() => Money.fromMinor(100, 'TRY').allocate(2.5), InvalidAllocationError);
    });
  });

  describe('karşılaştırma', () => {
    it('equals para birimi + tutar', () => {
      assert.ok(Money.fromMajor(10, 'TRY').equals(Money.fromMinor(1000, 'TRY')));
      assert.ok(!Money.fromMajor(10, 'TRY').equals(Money.fromMajor(10, 'USD')));
      assert.ok(!Money.fromMajor(10, 'TRY').equals(Money.fromMajor(11, 'TRY')));
    });

    it('compareTo / isGreaterThan / isLessThan', () => {
      const a = Money.fromMajor(10, 'TRY');
      const b = Money.fromMajor(20, 'TRY');
      assert.equal(a.compareTo(b), -1);
      assert.equal(b.compareTo(a), 1);
      assert.equal(a.compareTo(a), 0);
      assert.ok(b.isGreaterThan(a));
      assert.ok(a.isLessThan(b));
    });

    it('compareTo farklı para biriminde fırlatır', () => {
      assert.throws(
        () => Money.fromMajor(10, 'TRY').compareTo(Money.fromMajor(10, 'USD')),
        CurrencyMismatchError,
      );
    });

    it('isZero / isNegative / isPositive', () => {
      assert.ok(Money.zero('TRY').isZero());
      assert.ok(Money.fromMinor(-1, 'TRY').isNegative());
      assert.ok(Money.fromMinor(1, 'TRY').isPositive());
    });
  });

  describe('serileştirme', () => {
    it('toDecimalString sabit 2 ondalık', () => {
      assert.equal(Money.fromMinor(1250, 'TRY').toDecimalString(), '12.50');
      assert.equal(Money.fromMinor(5, 'TRY').toDecimalString(), '0.05');
      assert.equal(Money.fromMinor(0, 'TRY').toDecimalString(), '0.00');
    });

    it('toJSON minor + currency + decimal', () => {
      assert.deepEqual(Money.fromMinor(1250, 'USD').toJSON(), {
        minor: 1250,
        currency: 'USD',
        decimal: '12.50',
      });
    });
  });
});
