/**
 * KdvCalculator domain servis testleri.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { KdvCalculator } from '../../domain/services/KdvCalculator.js';
import { KdvRate } from '../../domain/valueObjects/KdvRate.js';
import { Money } from '../../domain/valueObjects/Money.js';

describe('KdvCalculator', () => {
  describe('fromSubtotal', () => {
    it('%20: 100.00 → kdv 20.00, total 120.00', () => {
      const r = KdvCalculator.fromSubtotal(Money.fromMajor(100, 'TRY'), KdvRate.default());
      assert.equal(r.subtotal.toDecimalString(), '100.00');
      assert.equal(r.kdv.toDecimalString(), '20.00');
      assert.equal(r.total.toDecimalString(), '120.00');
    });

    it('%10: 99.99 → kdv 10.00 (yuvarlama), total 109.99', () => {
      // 9999 kuruş × 0.10 = 999.9 → 1000 kuruş = 10.00
      const r = KdvCalculator.fromSubtotal(Money.fromMajor(99.99, 'TRY'), KdvRate.fromPercent(10));
      assert.equal(r.kdv.toDecimalString(), '10.00');
      assert.equal(r.total.toDecimalString(), '109.99');
    });

    it('%0: kdv 0, total = subtotal', () => {
      const r = KdvCalculator.fromSubtotal(Money.fromMajor(50, 'USD'), KdvRate.create(0));
      assert.ok(r.kdv.isZero());
      assert.equal(r.total.toDecimalString(), '50.00');
    });

    it('total = subtotal + kdv her zaman tutar', () => {
      const subtotal = Money.fromMajor(33.33, 'TRY');
      const r = KdvCalculator.fromSubtotal(subtotal, KdvRate.fromPercent(20));
      assert.ok(r.total.equals(r.subtotal.plus(r.kdv)));
    });
  });

  describe('fromGrossTotal', () => {
    it('%20: 120.00 → subtotal 100.00, kdv 20.00', () => {
      const r = KdvCalculator.fromGrossTotal(Money.fromMajor(120, 'TRY'), KdvRate.default());
      assert.equal(r.subtotal.toDecimalString(), '100.00');
      assert.equal(r.kdv.toDecimalString(), '20.00');
    });

    it("total korunur: subtotal + kdv === total (yuvarlama KDV'ye yansır)", () => {
      const total = Money.fromMajor(100, 'TRY');
      const r = KdvCalculator.fromGrossTotal(total, KdvRate.fromPercent(20));
      assert.ok(r.subtotal.plus(r.kdv).equals(total));
    });
  });
});
