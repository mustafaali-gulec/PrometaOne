import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PayrollCalculator,
  TR_PAYROLL_RATES_2026,
} from '../../domain/services/PayrollCalculator.js';

describe('PayrollCalculator.calculate', () => {
  it('happy: brüt 50000 için bilinen kırılımı üretir', () => {
    const b = PayrollCalculator.calculate(50000);
    assert.equal(b.grossSalary, 50000);
    assert.equal(b.sgkEmployee, 7000); // 50000 × %14
    assert.equal(b.unemployment, 500); // 50000 × %1
    // matrah = 50000 − 7000 − 500 = 42500; yıllık 510000 → vergi 106700 → /12 = 8891.67
    assert.equal(b.incomeTax, 8891.67);
    assert.equal(b.stampTax, 379.5); // 50000 × %0.759
    assert.equal(b.otherDeductions, 0);
    assert.equal(b.netSalary, 33228.83);
  });

  it('kesintiler + net toplamı brüte eşittir', () => {
    const b = PayrollCalculator.calculate(50000);
    const total =
      b.sgkEmployee + b.unemployment + b.incomeTax + b.stampTax + b.otherDeductions + b.netSalary;
    assert.equal(Math.round(total * 100) / 100, b.grossSalary);
  });

  it("otherDeductions net'ten düşülür", () => {
    const base = PayrollCalculator.calculate(50000);
    const withOther = PayrollCalculator.calculate(50000, 1000);
    assert.equal(withOther.otherDeductions, 1000);
    assert.equal(withOther.netSalary, Math.round((base.netSalary - 1000) * 100) / 100);
  });

  it('SGK tavanı uygulanır: çok yüksek brütte sgkBase sabitlenir', () => {
    const ceiling =
      TR_PAYROLL_RATES_2026.minimumWageGross * TR_PAYROLL_RATES_2026.sgkCeilingMultiplier;
    const b = PayrollCalculator.calculate(ceiling * 2);
    // SGK kesintisi tavana göre hesaplanır (brüte göre değil)
    assert.equal(b.sgkEmployee, Math.round(ceiling * 0.14 * 100) / 100);
    assert.equal(b.unemployment, Math.round(ceiling * 0.01 * 100) / 100);
  });

  it('brüt 0 → tüm kalemler 0', () => {
    const b = PayrollCalculator.calculate(0);
    assert.equal(b.grossSalary, 0);
    assert.equal(b.sgkEmployee, 0);
    assert.equal(b.unemployment, 0);
    assert.equal(b.incomeTax, 0);
    assert.equal(b.stampTax, 0);
    assert.equal(b.netSalary, 0);
  });

  it('edge: negatif brüt → hata', () => {
    assert.throws(() => PayrollCalculator.calculate(-1), /negatif|geçersiz/i);
  });

  it('edge: negatif otherDeductions → hata', () => {
    assert.throws(() => PayrollCalculator.calculate(50000, -1), /negatif|geçersiz/i);
  });
});

describe('PayrollCalculator.annualIncomeTax', () => {
  const brackets = TR_PAYROLL_RATES_2026.incomeTaxBrackets;

  it('0 veya negatif matrah → 0', () => {
    assert.equal(PayrollCalculator.annualIncomeTax(0, brackets), 0);
    assert.equal(PayrollCalculator.annualIncomeTax(-100, brackets), 0);
  });

  it('ilk dilim içi: 100000 × %15 = 15000', () => {
    assert.equal(PayrollCalculator.annualIncomeTax(100000, brackets), 15000);
  });

  it('iki dilim: 200000 → 158000×%15 + 42000×%20 = 23700 + 8400 = 32100', () => {
    assert.equal(PayrollCalculator.annualIncomeTax(200000, brackets), 32100);
  });
});
