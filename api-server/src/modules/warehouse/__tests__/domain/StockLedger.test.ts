/**
 * StockLedger domain servisi testleri — negatif stok + hareketli ortalama maliyet.
 *
 * (production/__tests__/domain deseniyle aynı; node:test + assert/strict.)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { StockMovement, type StockMovementProps } from '../../domain/entities/StockMovement.js';
import { StockLedger } from '../../domain/services/StockLedger.js';
import type { MovementKind } from '../../domain/valueObjects/MovementKind.js';

const NOW = new Date('2026-01-01T00:00:00.000Z');
let seq = 0;

interface MoveOverrides {
  kind: MovementKind;
  materialId?: number;
  warehouseId?: number | null;
  fromWarehouseId?: number | null;
  toWarehouseId?: number | null;
  qty: number;
  unitCostBase?: number | null;
  date?: string;
}

function makeMovement(o: MoveOverrides): StockMovement {
  seq += 1;
  const kind = o.kind;
  const props: StockMovementProps = {
    id: seq,
    companyId: 1,
    no: `${kind}-${seq}`,
    kind,
    subType: null,
    date: o.date ?? '2026-01-01',
    warehouseId: kind === 'transfer' ? null : (o.warehouseId ?? 1),
    fromWarehouseId: kind === 'transfer' ? (o.fromWarehouseId ?? 1) : null,
    toWarehouseId: kind === 'transfer' ? (o.toWarehouseId ?? 2) : null,
    materialId: o.materialId ?? 100,
    qty: o.qty,
    unit: 'adet',
    factor: 1,
    baseUnit: 'adet',
    baseQty: o.qty,
    unitPrice: null,
    unitCostBase: o.unitCostBase ?? null,
    total: null,
    lots: [],
    locationId: null,
    partyId: null,
    person: null,
    docNo: null,
    note: null,
    createdBy: null,
    createdAt: NOW,
  };
  return StockMovement.create(props);
}

describe('StockLedger — stok hesabı (hareket-türevli)', () => {
  it('in/out toplamı depo bazında bakiyeyi verir', () => {
    const movements = [
      makeMovement({ kind: 'in', warehouseId: 1, qty: 100 }),
      makeMovement({ kind: 'out', warehouseId: 1, qty: 30 }),
    ];
    assert.equal(StockLedger.computeStockFor(movements, 100, 1), 70);
  });

  it('çıkış stoğu negatife düşürebilir (StockLedger kuralı dayatmaz)', () => {
    const movements = [
      makeMovement({ kind: 'in', warehouseId: 1, qty: 10 }),
      makeMovement({ kind: 'out', warehouseId: 1, qty: 25 }),
    ];
    // StockLedger negatif stoğu modelleyebilir; engelleme use-case katmanında.
    assert.equal(StockLedger.computeStockFor(movements, 100, 1), -15);
  });

  it('transfer kaynak deposunu azaltır, hedef depoyu artırır', () => {
    const movements = [
      makeMovement({ kind: 'in', warehouseId: 1, qty: 50 }),
      makeMovement({ kind: 'transfer', fromWarehouseId: 1, toWarehouseId: 2, qty: 20 }),
    ];
    assert.equal(StockLedger.computeStockFor(movements, 100, 1), 30);
    assert.equal(StockLedger.computeStockFor(movements, 100, 2), 20);
  });

  it('computeStockLevels yalnız hareketi olan (material, depo) ikililerini döner', () => {
    const movements = [
      makeMovement({ kind: 'in', warehouseId: 1, qty: 5 }),
      makeMovement({ kind: 'transfer', fromWarehouseId: 1, toWarehouseId: 2, qty: 2 }),
    ];
    const levels = StockLedger.computeStockLevels(movements);
    const byWh = new Map(levels.map((l) => [l.warehouseId, l.baseQty]));
    assert.equal(byWh.get(1), 3);
    assert.equal(byWh.get(2), 2);
  });
});

describe('StockLedger — hareketli ortalama maliyet (moving average)', () => {
  it('iki maliyetli girişi ağırlıklı ortalar', () => {
    const movements = [
      makeMovement({ kind: 'in', qty: 10, unitCostBase: 100, date: '2026-01-01' }),
      makeMovement({ kind: 'in', qty: 10, unitCostBase: 200, date: '2026-01-02' }),
    ];
    // (10*100 + 10*200) / 20 = 150
    assert.equal(StockLedger.movingAverageCost(movements, 100), 150);
  });

  it('çıkış ortalama maliyeti değiştirmez', () => {
    const movements = [
      makeMovement({ kind: 'in', qty: 10, unitCostBase: 100, date: '2026-01-01' }),
      makeMovement({ kind: 'out', qty: 4, date: '2026-01-02' }),
      makeMovement({ kind: 'in', qty: 10, unitCostBase: 200, date: '2026-01-03' }),
    ];
    // giriş1: qty=10 avg=100 ; çıkış: qty=6 avg=100 ;
    // giriş2: (6*100 + 10*200)/16 = 2600/16 = 162.5
    assert.equal(StockLedger.movingAverageCost(movements, 100), 162.5);
  });

  it('hiç maliyetli giriş yoksa 0 döner', () => {
    const movements = [makeMovement({ kind: 'in', qty: 10, unitCostBase: null })];
    assert.equal(StockLedger.movingAverageCost(movements, 100), 0);
  });
});
