import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DepreciationCalculator,
  type DepreciableAsset,
  type DepreciableAssetWithId,
} from '../../domain/services/DepreciationCalculator.js';

const calc = new DepreciationCalculator();

function asset(overrides: Partial<DepreciableAsset> = {}): DepreciableAsset {
  return {
    acquisitionDate: '2026-01-15',
    acquisitionCost: 100_000,
    usefulLifeYears: 5,
    method: 'normal',
    isPassengerCar: false,
    salvageValue: 0,
    openingAccumulated: 0,
    ...overrides,
  };
}

function withId(id: string, overrides: Partial<DepreciableAsset> = {}): DepreciableAssetWithId {
  return { id, ...asset(overrides) };
}

describe('DepreciationCalculator.computeAnnualPlan — normal (eşit tutarlı)', () => {
  it('(1) 5 yıl 100.000 TL → 5×20.000, birikmiş base ile kapanır', () => {
    const plan = calc.computeAnnualPlan(asset());
    assert.equal(plan.length, 5);
    assert.deepEqual(
      plan.map((p) => p.annual),
      [20_000, 20_000, 20_000, 20_000, 20_000],
    );
    assert.deepEqual(
      plan.map((p) => p.year),
      [2026, 2027, 2028, 2029, 2030],
    );
    assert.equal(plan[4]!.accumulatedEnd, 100_000);
    assert.equal(plan[4]!.nbvEnd, 0);
  });

  it('(2) salvage 10.000 → base 90.000, 5×18.000, NBV sonu = salvage', () => {
    const plan = calc.computeAnnualPlan(asset({ salvageValue: 10_000 }));
    assert.deepEqual(
      plan.map((p) => p.annual),
      [18_000, 18_000, 18_000, 18_000, 18_000],
    );
    assert.equal(plan[4]!.accumulatedEnd, 90_000);
    assert.equal(plan[4]!.nbvEnd, 10_000);
  });

  it('yuvarlama artığı son yılda kapanır (100.000 / 3 yıl)', () => {
    const plan = calc.computeAnnualPlan(asset({ usefulLifeYears: 3 }));
    assert.deepEqual(
      plan.map((p) => p.annual),
      [33_333.33, 33_333.33, 33_333.34],
    );
    assert.equal(plan[2]!.accumulatedEnd, 100_000);
  });
});

describe('DepreciationCalculator.computeAnnualPlan — binek oto kıst', () => {
  it('(3) alım 2026-06, 5 yıl, 120.000 → ilk yıl 14.000, ertelenen 10.000 son yıla', () => {
    const plan = calc.computeAnnualPlan(
      asset({
        acquisitionDate: '2026-06-10',
        acquisitionCost: 120_000,
        isPassengerCar: true,
      }),
    );
    // tam yıllık 24.000; m = 13-6 = 7 → ilk yıl 24.000×7/12 = 14.000
    assert.deepEqual(
      plan.map((p) => p.annual),
      [14_000, 24_000, 24_000, 24_000, 34_000],
    );
    const total = plan.reduce((s, p) => s + p.annual, 0);
    assert.equal(total, 120_000);
    assert.equal(plan[4]!.accumulatedEnd, 120_000);
    // Süre uzamaz: yıl sayısı N = 5 kalır
    assert.equal(plan.length, 5);
  });

  it('Ocak alımı kıstsız yıla denk düşer (m = 12 → proratasyon yok)', () => {
    const plan = calc.computeAnnualPlan(
      asset({ acquisitionDate: '2026-01-05', acquisitionCost: 120_000, isPassengerCar: true }),
    );
    assert.deepEqual(
      plan.map((p) => p.annual),
      [24_000, 24_000, 24_000, 24_000, 24_000],
    );
  });
});

describe('DepreciationCalculator.computeAnnualPlan — declining (azalan bakiyeler)', () => {
  it('(4) 5 yıl 100.000 → rate 0.4: 40.000/24.000/14.400/8.640/kalan 12.960', () => {
    const plan = calc.computeAnnualPlan(asset({ method: 'declining' }));
    assert.deepEqual(
      plan.map((p) => p.annual),
      [40_000, 24_000, 14_400, 8_640, 12_960],
    );
    assert.equal(plan[4]!.accumulatedEnd, 100_000);
    assert.equal(plan[4]!.nbvEnd, 0);
  });

  it('(5) rate cap: 2 yıl → rate min(2/2, 0.5) = 0.5', () => {
    const plan = calc.computeAnnualPlan(asset({ method: 'declining', usefulLifeYears: 2 }));
    assert.deepEqual(
      plan.map((p) => p.annual),
      [50_000, 50_000],
    );
  });

  it('declining + kıst: ertelenen son yılda otomatik kapanır (toplam = base)', () => {
    const plan = calc.computeAnnualPlan(
      asset({ method: 'declining', acquisitionDate: '2026-06-01', isPassengerCar: true }),
    );
    // Y1: tam 40.000 → kıst 7/12 = 23.333,33; Y2: (100.000−23.333,33)×0.4 = 30.666,67
    assert.equal(plan[0]!.annual, 23_333.33);
    assert.equal(plan[1]!.annual, 30_666.67);
    assert.equal(plan.length, 5);
    assert.equal(plan[4]!.accumulatedEnd, 100_000);
    const total = Math.round(plan.reduce((s, p) => s + p.annual, 0) * 100) / 100;
    assert.equal(total, 100_000);
  });

  it('birikmiş hiçbir zaman base i aşmaz (yüksek salvage)', () => {
    const plan = calc.computeAnnualPlan(
      asset({ method: 'declining', acquisitionCost: 100_000, salvageValue: 90_000 }),
    );
    // base 10.000; Y1 declining 40.000 → 10.000'e klemplenir, kalan yıllar 0
    assert.deepEqual(
      plan.map((p) => p.annual),
      [10_000, 0, 0, 0, 0],
    );
    for (const p of plan) assert.ok(p.accumulatedEnd <= 10_000);
  });
});

describe('DepreciationCalculator.accumulatedThrough — aylıklandırma', () => {
  const a = asset({ acquisitionDate: '2026-06-20', acquisitionCost: 60_000 }); // normal, kıst DEĞİL, 5 yıl

  it('(6) alım yılı: 2026-09 sonunda 4 ay × 12.000/7 = 6.857,14', () => {
    // alım yılı aylık payı = annual/(13-6) = 12.000/7; Haz..Eyl = 4 ay
    assert.equal(calc.accumulatedThrough(a, '2026-09'), 6_857.14);
  });

  it('(6) sonraki yıl: 2027-06 → 12.000 (2026 tam) + 6×1.000 = 18.000', () => {
    assert.equal(calc.accumulatedThrough(a, '2027-06'), 18_000);
  });

  it('alım yılı sonu tam annual e ulaşır (2026-12 → 12.000)', () => {
    assert.equal(calc.accumulatedThrough(a, '2026-12'), 12_000);
  });

  it('period alım ayından önce → 0', () => {
    assert.equal(calc.accumulatedThrough(a, '2026-05'), 0);
    assert.equal(calc.accumulatedThrough(a, '2025-12'), 0);
  });

  it('plan bittikten sonra base e sabitlenir', () => {
    assert.equal(calc.accumulatedThrough(a, '2030-12'), 60_000);
    assert.equal(calc.accumulatedThrough(a, '2031-07'), 60_000);
  });

  it('kıst binek oto: alım yılında ay payı tam-yıllık/12 ye denk düşer', () => {
    const car = asset({
      acquisitionDate: '2026-06-10',
      acquisitionCost: 120_000,
      isPassengerCar: true,
    });
    // ilk yıl annual 14.000, m=7 → aylık 2.000 (= tamYıllık 24.000/12)
    assert.equal(calc.accumulatedThrough(car, '2026-06'), 2_000);
    assert.equal(calc.accumulatedThrough(car, '2026-12'), 14_000);
    // son yıl (2030) ertelenen dahil annual 34.000 → aylık/12
    assert.equal(calc.accumulatedThrough(car, '2030-06'), 86_000 + 17_000);
  });
});

describe('DepreciationCalculator.computeRunLines', () => {
  it('fark hesabı: accumulatedThrough − alreadyBooked', () => {
    const assets = [withId('a1', { acquisitionDate: '2026-06-20', acquisitionCost: 60_000 })];
    const lines = calc.computeRunLines('2026-09', assets, {});
    assert.deepEqual(lines, [{ assetId: 'a1', amount: 6_857.14 }]);
  });

  it('(7) idempotent: aynı dönem ikinci koşumda 0 satır', () => {
    const assets = [withId('a1', { acquisitionDate: '2026-06-20', acquisitionCost: 60_000 })];
    const first = calc.computeRunLines('2026-09', assets, {});
    assert.equal(first.length, 1);
    const booked = { a1: first[0]!.amount };
    const second = calc.computeRunLines('2026-09', assets, booked);
    assert.deepEqual(second, []);
  });

  it('openingAccumulated alreadyBooked içinde geçirilir; sadece fark alınır', () => {
    const assets = [
      withId('a1', {
        acquisitionDate: '2025-01-10',
        acquisitionCost: 100_000,
        openingAccumulated: 20_000, // 2025 yılı devri
      }),
    ];
    // 2026-06 sonunda olması gereken: 20.000 (2025) + 6×20.000/12 = 30.000
    const lines = calc.computeRunLines('2026-06', assets, { a1: 20_000 });
    assert.deepEqual(lines, [{ assetId: 'a1', amount: 10_000 }]);
  });

  it('fazla ayrılmışsa negatif fark 0 a klemplenir ve satır elenir', () => {
    const assets = [withId('a1', { acquisitionDate: '2026-06-20', acquisitionCost: 60_000 })];
    const lines = calc.computeRunLines('2026-07', assets, { a1: 50_000 });
    assert.deepEqual(lines, []);
  });

  it('(8) usefulLifeYears = 0 → boş plan, 0 tutar, satır yok', () => {
    const zero = asset({ usefulLifeYears: 0 });
    assert.deepEqual(calc.computeAnnualPlan(zero), []);
    assert.equal(calc.accumulatedThrough(zero, '2026-12'), 0);
    const lines = calc.computeRunLines('2026-12', [{ id: 'a1', ...zero }], {});
    assert.deepEqual(lines, []);
  });

  it('base = 0 (salvage >= maliyet) → boş plan', () => {
    const plan = calc.computeAnnualPlan(asset({ acquisitionCost: 5_000, salvageValue: 5_000 }));
    assert.deepEqual(plan, []);
  });
});
