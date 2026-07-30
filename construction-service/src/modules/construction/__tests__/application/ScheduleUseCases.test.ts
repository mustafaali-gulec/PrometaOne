/**
 * FAZ 8 — İş programı testleri.
 *
 * Ağırlık: S-eğrisi matematiği (doğrusal plan, step fiili, ağırlık kipleri,
 * gelecek null) ve ScheduleActivity fiili-tarih türetmesi. SQL katmanı
 * smoke'ta canlı sınanır.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ScheduleActivity,
  type ScheduleActivityProps,
} from '../../domain/entities/ScheduleActivity.js';
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  actualFractionAt,
  computeScheduleCurve,
  plannedFractionAt,
  resolveWeights,
  type CurveActivity,
} from '../../domain/valueObjects/ScheduleCurve.js';

const NOW = new Date('2026-07-29T10:00:00.000Z');

// ===== S-EĞRİSİ MATEMATİĞİ ==================================================

const act = (over: Partial<CurveActivity> & { id: number }): CurveActivity => ({
  kind: 'task',
  plannedStart: '2026-07-01',
  plannedEnd: '2026-07-31',
  weightPct: 0,
  progressLog: [],
  ...over,
});

const ms = (d: string): number => Date.parse(`${d}T00:00:00Z`);

describe('plannedFractionAt — doğrusal yayılım', () => {
  it('başlangıçtan önce 0, bitişten sonra 1, ortada oransal', () => {
    const a = act({ id: 1, plannedStart: '2026-07-01', plannedEnd: '2026-07-31' });
    assert.equal(plannedFractionAt(a, ms('2026-06-30')), 0);
    assert.equal(plannedFractionAt(a, ms('2026-08-01')), 1);
    // 15 gün / 30 gün = 0,5
    assert.equal(plannedFractionAt(a, ms('2026-07-16')), 0.5);
  });

  it('kilometre taşı: gününe kadar 0, gününde 1 (basamak)', () => {
    const m = act({
      id: 2,
      kind: 'milestone',
      plannedStart: '2026-07-15',
      plannedEnd: '2026-07-15',
    });
    assert.equal(plannedFractionAt(m, ms('2026-07-14')), 0);
    assert.equal(plannedFractionAt(m, ms('2026-07-15')), 1);
  });
});

describe('actualFractionAt — step (son bilinen değer)', () => {
  it('kayıt yoksa 0; iki ölçüm arasında SON ölçüm taşınır (doğrusal değil)', () => {
    const a = act({
      id: 1,
      progressLog: [
        { asOf: '2026-07-10', progressPct: 20 },
        { asOf: '2026-07-20', progressPct: 60 },
      ],
    });
    assert.equal(actualFractionAt(a, ms('2026-07-05')), 0);
    assert.equal(actualFractionAt(a, ms('2026-07-10')), 0.2);
    // 15'inde ölçüm yok → son bilinen (20 değil %20); ara değer çekilmez
    assert.equal(actualFractionAt(a, ms('2026-07-15')), 0.2);
    assert.equal(actualFractionAt(a, ms('2026-07-25')), 0.6);
  });

  it('sırasız günlük de doğru okunur (en yeni ≤ tarih kazanır)', () => {
    const a = act({
      id: 1,
      progressLog: [
        { asOf: '2026-07-20', progressPct: 60 },
        { asOf: '2026-07-10', progressPct: 20 },
      ],
    });
    assert.equal(actualFractionAt(a, ms('2026-07-15')), 0.2);
  });
});

describe('resolveWeights', () => {
  it('açık ağırlık varsa normalize eder', () => {
    const { weights, mode } = resolveWeights([
      act({ id: 1, weightPct: 30 }),
      act({ id: 2, weightPct: 10 }),
    ]);
    assert.equal(mode, 'explicit');
    assert.equal(weights.get(1), 0.75);
    assert.equal(weights.get(2), 0.25);
  });

  it('hepsi 0 ise süre-orantılı kipe düşer (tek günlük iş süresi 1)', () => {
    const { weights, mode } = resolveWeights([
      // 10 gün (1-10 temmuz, +1)
      act({ id: 1, plannedStart: '2026-07-01', plannedEnd: '2026-07-10' }),
      // 20 gün (11-30 temmuz, +1)
      act({ id: 2, plannedStart: '2026-07-11', plannedEnd: '2026-07-30' }),
    ]);
    assert.equal(mode, 'duration');
    assert.ok(Math.abs((weights.get(1) ?? 0) - 10 / 30) < 1e-9);
    assert.ok(Math.abs((weights.get(2) ?? 0) - 20 / 30) < 1e-9);
  });
});

describe('computeScheduleCurve', () => {
  it('plan 0→100 tırmanır; fiili gelecekte NULL', () => {
    const curve = computeScheduleCurve(
      [
        act({ id: 1, plannedStart: '2026-07-01', plannedEnd: '2026-07-31', weightPct: 50 }),
        act({ id: 2, plannedStart: '2026-08-01', plannedEnd: '2026-08-31', weightPct: 50 }),
      ],
      '2026-07-29',
      7,
    );
    assert.equal(curve.weightMode, 'explicit');
    assert.equal(curve.points[0]!.plannedPct, 0);
    const last = curve.points[curve.points.length - 1]!;
    assert.equal(last.plannedPct, 100);
    // Ağustos noktaları gelecekte — fiili null
    assert.equal(last.actualPct, null);
    // Bugüne kadarki noktada fiili sayı (günlük boş → 0)
    const todayPoint = [...curve.points].reverse().find((p) => p.actualPct !== null)!;
    assert.equal(todayPoint.actualPct, 0);
  });

  it('fiili eğri günlükten okunur ve ağırlıkla toplanır', () => {
    const curve = computeScheduleCurve(
      [
        act({
          id: 1,
          weightPct: 60,
          progressLog: [{ asOf: '2026-07-10', progressPct: 50 }],
        }),
        act({ id: 2, weightPct: 40, progressLog: [] }),
      ],
      '2026-07-15',
      7,
    );
    // 15 temmuz noktası: 0,6×%50 + 0,4×%0 = %30
    const p = curve.points.find((x) => x.date === '2026-07-15');
    assert.equal(p!.actualPct, 30);
  });

  it('eğri bugüne kadar uzar (plan bitmiş, iş sürüyor)', () => {
    const curve = computeScheduleCurve(
      [act({ id: 1, plannedStart: '2026-06-01', plannedEnd: '2026-06-30' })],
      '2026-07-29',
      7,
    );
    assert.equal(curve.points[curve.points.length - 1]!.date, '2026-07-29');
    assert.equal(curve.plannedEnd, '2026-06-30');
  });

  it('BUGÜN her zaman noktadır — hafta kovasına denk gelmese de son ölçüm görünür', () => {
    const curve = computeScheduleCurve(
      [
        act({
          id: 1,
          plannedStart: '2026-07-01',
          plannedEnd: '2026-08-31',
          progressLog: [{ asOf: '2026-07-10', progressPct: 40 }],
        }),
      ],
      '2026-07-10', // 1 Temmuz + 7n kovalarına denk değil
      7,
    );
    const todayPoint = curve.points.find((p) => p.date === '2026-07-10');
    assert.notEqual(todayPoint, undefined);
    assert.equal(todayPoint!.actualPct, 40);
    // Sıralama bozulmadı
    const dates = curve.points.map((p) => p.date);
    assert.deepEqual(dates, [...dates].sort());
  });

  it('boş listede boş eğri', () => {
    const curve = computeScheduleCurve([], '2026-07-29');
    assert.equal(curve.points.length, 0);
    assert.equal(curve.plannedStart, null);
  });
});

// ===== SCHEDULEACTIVITY =====================================================

function activity(over: Partial<ScheduleActivityProps> = {}): ScheduleActivity {
  return ScheduleActivity.create({
    id: 1,
    companyId: 1,
    projectId: 5,
    parentId: null,
    code: 'AKT-001',
    name: 'Temel kazısı',
    kind: 'task',
    plannedStart: '2026-07-01',
    plannedEnd: '2026-07-31',
    actualStart: null,
    actualEnd: null,
    progressPct: 0,
    weightPct: 10,
    trackingId: null,
    boqLineId: null,
    locationId: null,
    dependsOn: null,
    sortOrder: 0,
    note: null,
    active: true,
    createdBy: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  });
}

describe('ScheduleActivity', () => {
  it('ilk >0 ilerleme fiili başlangıcı damgalar; 100 fiili bitişi', () => {
    const a = activity()
      .recordProgress(30, '2026-07-10', NOW)
      .recordProgress(100, '2026-07-25', NOW);
    const j = a.toJSON();
    assert.equal(j.actualStart, '2026-07-10');
    assert.equal(j.actualEnd, '2026-07-25');
  });

  it('100 sonrası geri düşüş fiili bitişi siler, başlangıcı KORUR', () => {
    const a = activity()
      .recordProgress(100, '2026-07-20', NOW)
      .recordProgress(80, '2026-07-22', NOW);
    const j = a.toJSON();
    assert.equal(j.actualEnd, null);
    assert.equal(j.actualStart, '2026-07-20'); // başlamışlık geri alınamaz
  });

  it('aynı gün 0→100: fiili başlangıç = bitiş', () => {
    const a = activity().recordProgress(100, '2026-07-15', NOW);
    const j = a.toJSON();
    assert.equal(j.actualStart, '2026-07-15');
    assert.equal(j.actualEnd, '2026-07-15');
  });

  it('grup satırına ilerleme yazılamaz (rollup)', () => {
    const g = activity({ kind: 'group' });
    assert.throws(() => g.recordProgress(10, '2026-07-10', NOW), InvalidStatusTransitionError);
  });

  it('kilometre taşının süresi olamaz; task→milestone dönüşünde bitiş güne çekilir', () => {
    assert.throws(
      () => activity({ kind: 'milestone', plannedEnd: '2026-07-31' }),
      ConstructionValidationError,
    );
    const m = activity().update({ kind: 'milestone' }, NOW);
    const j = m.toJSON();
    assert.equal(j.plannedStart, j.plannedEnd);
  });

  it('gecikme: bitmemiş + planlanan bitişi geçmiş; grup ve bitmişte null', () => {
    const late = activity({ plannedEnd: '2026-07-20', progressPct: 50 });
    assert.equal(late.overdueDays('2026-07-29'), 9);
    assert.equal(late.recordProgress(100, '2026-07-29', NOW).overdueDays('2026-07-29'), null);
    assert.equal(activity({ kind: 'group' }).overdueDays('2026-07-29'), null);
  });

  it('kendine bağımlılık ve kendi altına koyma reddedilir', () => {
    assert.throws(() => activity({ dependsOn: 1 }), ConstructionValidationError);
    assert.throws(() => activity({ parentId: 1 }), ConstructionValidationError);
  });
});
