import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Bom, type BomComponent, type BomOperation } from '../../domain/entities/Bom.js';
import { BomCycleError } from '../../domain/errors/ProductionErrors.js';
import { BomExploder } from '../../domain/services/BomExploder.js';

const exploder = new BomExploder();
const NOW = new Date('2026-06-19T00:00:00.000Z');

let idSeq = 1;
function makeBom(
  productMaterialRef: string,
  outputQty: number,
  components: Omit<BomComponent, 'id' | 'sortOrder'>[],
  operations: Omit<BomOperation, 'id' | 'seq'>[] = [],
): Bom {
  return Bom.create({
    id: idSeq++,
    companyId: 1,
    no: `R-${productMaterialRef}-${idSeq}`,
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

describe('BomExploder', () => {
  it('tek seviyeli reçeteyi miktara göre ölçekler', () => {
    const root = makeBom('P', 1, [
      { materialRef: 'A', qty: 2, unit: 'adet', scrapPct: 0, isSemi: false },
      { materialRef: 'B', qty: 1, unit: 'kg', scrapPct: 0, isSemi: false },
    ]);
    const r = exploder.explode(root, 5, new Map());
    const a = r.requirements.find((x) => x.materialRef === 'A')!;
    const b = r.requirements.find((x) => x.materialRef === 'B')!;
    assert.equal(a.qty, 10);
    assert.equal(a.level, 1);
    assert.equal(b.qty, 5);
  });

  it('çok seviyeli patlatmada yarı mamulü açar', () => {
    const semi = makeBom('SEMI', 1, [
      { materialRef: 'RAW', qty: 4, unit: 'adet', scrapPct: 0, isSemi: false },
    ]);
    const root = makeBom('P', 1, [
      { materialRef: 'SEMI', qty: 2, unit: 'adet', scrapPct: 0, isSemi: true },
    ]);
    const byRef = new Map([['SEMI', semi]]);

    const r = exploder.explode(root, 3, byRef);
    // SEMI: 3×2 = 6 (level 1) ; RAW: 6×4 = 24 (level 2)
    assert.equal(r.requirements.find((x) => x.materialRef === 'SEMI')?.qty, 6);
    assert.equal(r.requirements.find((x) => x.materialRef === 'RAW')?.qty, 24);
    assert.equal(r.requirements.find((x) => x.materialRef === 'RAW')?.level, 2);
  });

  it('fire ihtiyacı artırır', () => {
    const root = makeBom('P', 1, [
      { materialRef: 'A', qty: 10, unit: 'adet', scrapPct: 50, isSemi: false },
    ]);
    const r = exploder.explode(root, 2, new Map());
    // 2 × 10 × 1.5 = 30
    assert.equal(r.requirements.find((x) => x.materialRef === 'A')?.qty, 30);
  });

  it('kök operasyonları miktara göre ölçekler', () => {
    const root = makeBom(
      'P',
      1,
      [],
      [{ workCenterId: 7, name: 'CNC', setupMin: 30, runMinPerUnit: 5 }],
    );
    const r = exploder.explode(root, 10, new Map());
    assert.equal(r.rootOperations.length, 1);
    // 30 + 5×10 = 80
    assert.equal(r.rootOperations[0]?.plannedMin, 80);
    assert.equal(r.rootOperations[0]?.workCenterId, 7);
  });

  it('döngülü reçetede BomCycleError fırlatır', () => {
    const root = makeBom('P', 1, [
      { materialRef: 'SEMI', qty: 1, unit: 'adet', scrapPct: 0, isSemi: true },
    ]);
    const semi = makeBom('SEMI', 1, [
      { materialRef: 'P', qty: 1, unit: 'adet', scrapPct: 0, isSemi: true },
    ]);
    const byRef = new Map([
      ['SEMI', semi],
      ['P', root],
    ]);
    assert.throws(() => exploder.explode(root, 1, byRef), BomCycleError);
  });
});
