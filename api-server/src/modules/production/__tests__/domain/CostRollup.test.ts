import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Bom, type BomComponent, type BomOperation } from '../../domain/entities/Bom.js';
import { BomCycleError } from '../../domain/errors/ProductionErrors.js';
import { CostRollup, type WorkCenterCost } from '../../domain/services/CostRollup.js';

const rollup = new CostRollup();
const NOW = new Date('2026-06-19T00:00:00.000Z');

function makeBom(
  productMaterialRef: string,
  outputQty: number,
  components: Omit<BomComponent, 'id' | 'sortOrder'>[],
  operations: Omit<BomOperation, 'id' | 'seq'>[],
): Bom {
  return Bom.create({
    id: 1,
    companyId: 1,
    no: `R-${productMaterialRef}`,
    productMaterialRef,
    name: `Reçete ${productMaterialRef}`,
    outputQty,
    outputUnit: 'adet',
    version: null,
    status: 'active',
    notes: null,
    components: components.map((c, i) => ({ ...c, sortOrder: i })),
    operations: operations.map((o, i) => ({ ...o, seq: i })),
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('CostRollup — malzeme maliyeti', () => {
  it('bileşen qty × fiyat toplar', () => {
    const bom = makeBom(
      'P',
      1,
      [
        { materialRef: 'A', qty: 2, unit: 'adet', scrapPct: 0, isSemi: false },
        { materialRef: 'B', qty: 3, unit: 'adet', scrapPct: 0, isSemi: false },
      ],
      [],
    );
    const prices = new Map([
      ['A', 10],
      ['B', 5],
    ]);
    const r = rollup.rollupCost(bom, prices, new Map(), 0);
    // 2×10 + 3×5 = 35
    assert.equal(r.materialCost, 35);
    assert.equal(r.laborCost, 0);
    assert.equal(r.overheadCost, 0);
    assert.equal(r.totalCost, 35);
    assert.equal(r.unitCost, 35);
  });

  it('fire (scrap%) malzeme maliyetini artırır', () => {
    const bom = makeBom(
      'P',
      1,
      [{ materialRef: 'A', qty: 10, unit: 'adet', scrapPct: 20, isSemi: false }],
      [],
    );
    const prices = new Map([['A', 2]]);
    const r = rollup.rollupCost(bom, prices, new Map(), 0);
    // 10 × 1.2 × 2 = 24
    assert.equal(r.materialCost, 24);
  });
});

describe('CostRollup — işçilik maliyeti', () => {
  it('operasyon dakikası/60 × saatlik maliyet', () => {
    const bom = makeBom(
      'P',
      1,
      [],
      [{ workCenterId: 1, name: 'CNC', setupMin: 30, runMinPerUnit: 30 }],
    );
    const wcMap = new Map<number, WorkCenterCost>([[1, { costPerHour: 120 }]]);
    const r = rollup.rollupCost(bom, new Map(), wcMap, 0);
    // outputQty=1 → (30 + 30×1) = 60 dk = 1 saat × 120 = 120
    assert.equal(r.laborCost, 120);
    assert.equal(r.totalCost, 120);
  });

  it('outputQty>1: işçilik partiye göre, unitCost adede bölünür', () => {
    const bom = makeBom(
      'P',
      10,
      [{ materialRef: 'A', qty: 1, unit: 'adet', scrapPct: 0, isSemi: false }],
      [{ workCenterId: 1, name: 'Montaj', setupMin: 0, runMinPerUnit: 6 }],
    );
    const prices = new Map([['A', 5]]);
    const wcMap = new Map<number, WorkCenterCost>([[1, { costPerHour: 60 }]]);
    const r = rollup.rollupCost(bom, prices, wcMap, 0);
    // malzeme: 10 parti adet için 1×5 ... ama outputQty=10 → bileşen 1 adet/parti
    // materialCost (parti) = 1 × 5 = 5
    // labor (parti) = (0 + 6×10)/60 × 60 = 60
    // total = 65 ; unit = 65/10 = 6.5
    assert.equal(r.materialCost, 5);
    assert.equal(r.laborCost, 60);
    assert.equal(r.totalCost, 65);
    assert.equal(r.unitCost, 6.5);
  });
});

describe('CostRollup — genel gider (overhead)', () => {
  it('overheadPct (malzeme+işçilik) üzerine eklenir', () => {
    const bom = makeBom(
      'P',
      1,
      [{ materialRef: 'A', qty: 1, unit: 'adet', scrapPct: 0, isSemi: false }],
      [{ workCenterId: 1, name: 'İş', setupMin: 0, runMinPerUnit: 60 }],
    );
    const prices = new Map([['A', 100]]);
    const wcMap = new Map<number, WorkCenterCost>([[1, { costPerHour: 100 }]]);
    const r = rollup.rollupCost(bom, prices, wcMap, 10);
    // malzeme 100 + işçilik 100 = 200 ; overhead %10 = 20 ; total 220
    assert.equal(r.materialCost, 100);
    assert.equal(r.laborCost, 100);
    assert.equal(r.overheadCost, 20);
    assert.equal(r.totalCost, 220);
  });
});

describe('CostRollup — yarı mamul rekürsif', () => {
  it('yarı mamul bileşenin birim maliyetini hesaplayıp çarpar', () => {
    const root = makeBom(
      'P',
      1,
      [{ materialRef: 'SEMI', qty: 2, unit: 'adet', scrapPct: 0, isSemi: true }],
      [],
    );
    const semi = makeBom(
      'SEMI',
      1,
      [{ materialRef: 'RAW', qty: 5, unit: 'adet', scrapPct: 0, isSemi: false }],
      [{ workCenterId: 1, name: 'Kesim', setupMin: 0, runMinPerUnit: 6 }],
    );
    const prices = new Map([['RAW', 2]]);
    const wcMap = new Map<number, WorkCenterCost>([[1, { costPerHour: 60 }]]);
    const semiBomMap = new Map([['SEMI', semi]]);

    const r = rollup.rollupCost(root, prices, wcMap, 0, semiBomMap);
    // SEMI birim maliyeti: malzeme 5×2=10 + işçilik (6/60)×60=6 = 16
    // P malzeme = 2 × 16 = 32
    assert.equal(r.materialCost, 32);
    assert.equal(r.laborCost, 0); // P'nin kendi operasyonu yok
    assert.equal(r.totalCost, 32);
  });

  it('yarı mamul reçetesi verilmezse fiyat haritasından değerlenir', () => {
    const root = makeBom(
      'P',
      1,
      [{ materialRef: 'SEMI', qty: 2, unit: 'adet', scrapPct: 0, isSemi: true }],
      [],
    );
    const prices = new Map([['SEMI', 50]]);
    const r = rollup.rollupCost(root, prices, new Map(), 0);
    assert.equal(r.materialCost, 100); // 2 × 50
  });
});

describe('CostRollup — döngü koruması', () => {
  it('yarı mamul kendini içerirse BomCycleError fırlatır', () => {
    const root = makeBom(
      'P',
      1,
      [{ materialRef: 'SEMI', qty: 1, unit: 'adet', scrapPct: 0, isSemi: true }],
      [],
    );
    const semi = makeBom(
      'SEMI',
      1,
      [{ materialRef: 'P', qty: 1, unit: 'adet', scrapPct: 0, isSemi: true }],
      [],
    );
    const semiBomMap = new Map([
      ['SEMI', semi],
      ['P', root],
    ]);
    assert.throws(
      () => rollup.rollupCost(root, new Map(), new Map(), 0, semiBomMap),
      BomCycleError,
    );
  });
});
