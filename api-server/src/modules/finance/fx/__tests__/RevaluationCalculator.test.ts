/**
 * RevaluationCalculator testleri — kur farkı gain/loss (kuruş-kesin).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Money } from '../../domain/valueObjects/Money.js';
import { RevaluationCalculator } from '../domain/services/RevaluationCalculator.js';

describe('RevaluationCalculator', () => {
  it('USD kuru yükselince kâr (646): 1000 USD, 30 → 32', () => {
    const r = RevaluationCalculator.compute(
      [{ label: 'USD Kasa', currency: 'USD', foreignAmount: Money.fromMajor(1000, 'USD') }],
      { usd1: 30, usd2: 32, eur1: 35, eur2: 35 },
    );
    // 1000 USD: 30000 → 32000 TRY, delta +2000
    assert.equal(r.gainTotal.toDecimalString(), '2000.00');
    assert.equal(r.lossTotal.toDecimalString(), '0.00');
    assert.equal(r.net.toDecimalString(), '2000.00');
    assert.equal(r.lines[0]!.tryValueBefore, '30000.00');
    assert.equal(r.lines[0]!.tryValueAfter, '32000.00');
    assert.equal(r.lines[0]!.delta, '2000.00');
  });

  it('EUR kuru düşünce zarar (656): 500 EUR, 36 → 34', () => {
    const r = RevaluationCalculator.compute(
      [{ label: 'EUR Banka', currency: 'EUR', foreignAmount: Money.fromMajor(500, 'EUR') }],
      { usd1: 30, usd2: 30, eur1: 36, eur2: 34 },
    );
    // 500 EUR: 18000 → 17000, delta -1000
    assert.equal(r.gainTotal.toDecimalString(), '0.00');
    assert.equal(r.lossTotal.toDecimalString(), '1000.00');
    assert.equal(r.net.toDecimalString(), '-1000.00');
  });

  it('karışık: kâr + zarar net olarak toplanır', () => {
    const r = RevaluationCalculator.compute(
      [
        { label: 'USD', currency: 'USD', foreignAmount: Money.fromMajor(1000, 'USD') }, // +2000
        { label: 'EUR', currency: 'EUR', foreignAmount: Money.fromMajor(500, 'EUR') }, // -1000
      ],
      { usd1: 30, usd2: 32, eur1: 36, eur2: 34 },
    );
    assert.equal(r.gainTotal.toDecimalString(), '2000.00');
    assert.equal(r.lossTotal.toDecimalString(), '1000.00');
    assert.equal(r.net.toDecimalString(), '1000.00');
    assert.equal(r.lines.length, 2);
  });

  it('kuruş-kesin: ondalıklı kur + tutar', () => {
    const r = RevaluationCalculator.compute(
      [{ label: 'USD', currency: 'USD', foreignAmount: Money.fromMajor(100.5, 'USD') }],
      { usd1: 32.15, usd2: 32.95, eur1: 35, eur2: 35 },
    );
    // 100.50 USD = 10050 cent; ×32.15 = 323107.5 → round 323108 → 3231.08 TRY
    //             ×32.95 = 331147.5 → round 331148 → 3311.48 TRY; delta 80.40
    assert.equal(r.lines[0]!.tryValueBefore, '3231.08');
    assert.equal(r.lines[0]!.tryValueAfter, '3311.48');
    assert.equal(r.gainTotal.toDecimalString(), '80.40');
  });

  it('kur değişmezse delta sıfır', () => {
    const r = RevaluationCalculator.compute(
      [{ label: 'USD', currency: 'USD', foreignAmount: Money.fromMajor(1000, 'USD') }],
      { usd1: 30, usd2: 30, eur1: 35, eur2: 35 },
    );
    assert.equal(r.net.toDecimalString(), '0.00');
  });
});
