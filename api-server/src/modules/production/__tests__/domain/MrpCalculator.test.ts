import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MrpCalculator,
  type InventoryLevel,
  type MrpBomInput,
  type MrpDemandItem,
  type MrpInput,
  type MrpMaterialInput,
  type MrpParams,
  type MrpWorkCenterInput,
} from '../../domain/services/MrpCalculator.js';

const calc = new MrpCalculator();

const defaultParams: MrpParams = {
  horizonDays: 30,
  useSafetyStock: true,
  includeInTransit: true,
};

function build(overrides: Partial<MrpInput>): MrpInput {
  return {
    params: defaultParams,
    materials: [],
    inventory: [],
    boms: [],
    workCenters: [],
    demand: [],
    ...overrides,
  };
}

function mat(
  id: string,
  isManufactured: boolean,
  extra: Partial<MrpMaterialInput> = {},
): MrpMaterialInput {
  return {
    id,
    name: `Malzeme ${id}`,
    code: id.toUpperCase(),
    unit: 'adet',
    isManufactured,
    ...extra,
  };
}

describe('MrpCalculator — tek seviyeli reçete', () => {
  it('mamulü bileşenlerine patlatır, fire yok, stok yok', () => {
    const boms: MrpBomInput[] = [
      {
        id: 'b1',
        productMaterialRef: 'P',
        outputQty: 1,
        components: [
          { materialRef: 'A', qty: 2, scrapPct: 0, isSemi: false },
          { materialRef: 'B', qty: 3, scrapPct: 0, isSemi: false },
        ],
        operations: [],
      },
    ];
    const materials = [
      mat('P', true),
      mat('A', false, { purchasePrice: 10 }),
      mat('B', false, { purchasePrice: 5 }),
    ];
    const demand: MrpDemandItem[] = [{ materialRef: 'P', qty: 10, type: 'order' }];

    const r = calc.compute(build({ boms, materials, demand }));

    // P üretilen, A & B satın alınan
    assert.equal(r.production.length, 1);
    assert.equal(r.production[0]?.materialRef, 'P');
    assert.equal(r.production[0]?.qty, 10);
    assert.equal(r.production[0]?.level, 0);

    assert.equal(r.purchase.length, 2);
    const a = r.purchase.find((p) => p.materialRef === 'A')!;
    const b = r.purchase.find((p) => p.materialRef === 'B')!;
    assert.equal(a.qty, 20); // 10 × 2
    assert.equal(b.qty, 30); // 10 × 3
    assert.equal(a.estCost, 200); // 20 × 10
    assert.equal(b.estCost, 150); // 30 × 5
    assert.equal(r.summary.totalPurchaseCost, 350);
    assert.equal(r.summary.distinctPurchaseItems, 2);
    assert.equal(r.summary.distinctProductionItems, 1);
  });

  it('outputQty > 1: reçete partisini doğru ölçekler', () => {
    const boms: MrpBomInput[] = [
      {
        id: 'b1',
        productMaterialRef: 'P',
        outputQty: 10, // 1 parti 10 adet üretir
        components: [{ materialRef: 'A', qty: 4, scrapPct: 0, isSemi: false }],
        operations: [],
      },
    ];
    const materials = [mat('P', true), mat('A', false, { purchasePrice: 1 })];
    const demand: MrpDemandItem[] = [{ materialRef: 'P', qty: 100, type: 'order' }];

    const r = calc.compute(build({ boms, materials, demand }));
    // 100 adet için 10 parti → 10 × 4 = 40 adet A
    assert.equal(r.purchase.find((p) => p.materialRef === 'A')?.qty, 40);
  });
});

describe('MrpCalculator — çok seviyeli patlatma', () => {
  it('yarı mamulü rekürsif patlatır ve level atar', () => {
    const boms: MrpBomInput[] = [
      {
        id: 'b1',
        productMaterialRef: 'P',
        outputQty: 1,
        components: [{ materialRef: 'SEMI', qty: 2, scrapPct: 0, isSemi: true }],
        operations: [],
      },
      {
        id: 'b2',
        productMaterialRef: 'SEMI',
        outputQty: 1,
        components: [{ materialRef: 'RAW', qty: 5, scrapPct: 0, isSemi: false }],
        operations: [],
      },
    ];
    const materials = [mat('P', true), mat('SEMI', true), mat('RAW', false, { purchasePrice: 2 })];
    const demand: MrpDemandItem[] = [{ materialRef: 'P', qty: 3, type: 'order' }];

    const r = calc.compute(build({ boms, materials, demand }));

    // P (level 0) ve SEMI (level 1) üretilen
    const p = r.production.find((x) => x.materialRef === 'P')!;
    const semi = r.production.find((x) => x.materialRef === 'SEMI')!;
    assert.equal(p.level, 0);
    assert.equal(p.qty, 3);
    assert.equal(semi.level, 1);
    assert.equal(semi.qty, 6); // 3 × 2

    // RAW satın alınan: 6 × 5 = 30
    const raw = r.purchase.find((x) => x.materialRef === 'RAW')!;
    assert.equal(raw.qty, 30);
    assert.equal(raw.estCost, 60);

    // Üretim sıralaması: level artan (P önce, SEMI sonra)
    assert.deepEqual(
      r.production.map((x) => x.materialRef),
      ['P', 'SEMI'],
    );
  });
});

describe('MrpCalculator — fire (scrap %)', () => {
  it('bileşen ihtiyacını fire ile artırır', () => {
    const boms: MrpBomInput[] = [
      {
        id: 'b1',
        productMaterialRef: 'P',
        outputQty: 1,
        components: [{ materialRef: 'A', qty: 10, scrapPct: 20, isSemi: false }],
        operations: [],
      },
    ];
    const materials = [mat('P', true), mat('A', false, { purchasePrice: 1 })];
    const demand: MrpDemandItem[] = [{ materialRef: 'P', qty: 5, type: 'order' }];

    const r = calc.compute(build({ boms, materials, demand }));
    // 5 × 10 × 1.2 = 60
    assert.equal(r.purchase.find((p) => p.materialRef === 'A')?.qty, 60);
  });
});

describe('MrpCalculator — emniyet stoğu aç/kapa', () => {
  const boms: MrpBomInput[] = [
    {
      id: 'b1',
      productMaterialRef: 'P',
      outputQty: 1,
      components: [{ materialRef: 'A', qty: 1, scrapPct: 0, isSemi: false }],
      operations: [],
    },
  ];
  const materials = [mat('P', true), mat('A', false, { purchasePrice: 1 })];
  const demand: MrpDemandItem[] = [{ materialRef: 'A', qty: 100, type: 'order' }];
  const inventory: InventoryLevel[] = [
    { materialRef: 'A', onHand: 0, safetyStock: 30, inTransit: 0 },
  ];

  it('useSafetyStock=true → net ihtiyaca emniyet stoğu eklenir', () => {
    const r = calc.compute(
      build({
        boms,
        materials,
        demand,
        inventory,
        params: { ...defaultParams, useSafetyStock: true },
      }),
    );
    // 100 + 30 - 0 - 0 = 130
    assert.equal(r.purchase.find((p) => p.materialRef === 'A')?.qty, 130);
  });

  it('useSafetyStock=false → emniyet stoğu eklenmez', () => {
    const r = calc.compute(
      build({
        boms,
        materials,
        demand,
        inventory,
        params: { ...defaultParams, useSafetyStock: false },
      }),
    );
    assert.equal(r.purchase.find((p) => p.materialRef === 'A')?.qty, 100);
  });
});

describe('MrpCalculator — yoldaki sipariş (in-transit) aç/kapa', () => {
  const materials = [mat('A', false, { purchasePrice: 1 })];
  const demand: MrpDemandItem[] = [{ materialRef: 'A', qty: 100, type: 'order' }];
  const inventory: InventoryLevel[] = [
    { materialRef: 'A', onHand: 0, safetyStock: 0, inTransit: 40 },
  ];

  it('includeInTransit=true → yoldaki sipariş net ihtiyaçtan düşülür', () => {
    const r = calc.compute(
      build({
        materials,
        demand,
        inventory,
        params: { ...defaultParams, includeInTransit: true },
      }),
    );
    // 100 - 0 - 40 = 60
    assert.equal(r.purchase.find((p) => p.materialRef === 'A')?.qty, 60);
  });

  it('includeInTransit=false → yoldaki sipariş yok sayılır', () => {
    const r = calc.compute(
      build({
        materials,
        demand,
        inventory,
        params: { ...defaultParams, includeInTransit: false },
      }),
    );
    assert.equal(r.purchase.find((p) => p.materialRef === 'A')?.qty, 100);
  });
});

describe('MrpCalculator — eldeki stok netlemesi', () => {
  it('eldeki stok talebi tam karşılarsa net ihtiyaç sıfırlanır (satın alma yok)', () => {
    const materials = [mat('A', false, { purchasePrice: 1 })];
    const demand: MrpDemandItem[] = [{ materialRef: 'A', qty: 50, type: 'order' }];
    const inventory: InventoryLevel[] = [
      { materialRef: 'A', onHand: 80, safetyStock: 0, inTransit: 0 },
    ];

    const r = calc.compute(build({ materials, demand, inventory }));
    // 50 - 80 = -30 → clamp 0
    assert.equal(r.purchase.length, 0);
    assert.equal(r.summary.totalPurchaseCost, 0);
  });

  it('kısmi stok → kalan ihtiyaç kadar satın alma', () => {
    const materials = [mat('A', false, { purchasePrice: 2 })];
    const demand: MrpDemandItem[] = [{ materialRef: 'A', qty: 50, type: 'order' }];
    const inventory: InventoryLevel[] = [
      { materialRef: 'A', onHand: 20, safetyStock: 0, inTransit: 0 },
    ];

    const r = calc.compute(build({ materials, demand, inventory }));
    assert.equal(r.purchase.find((p) => p.materialRef === 'A')?.qty, 30);
    assert.equal(r.purchase.find((p) => p.materialRef === 'A')?.estCost, 60);
  });
});

describe('MrpCalculator — eksiklikler (shortages)', () => {
  it('emniyet stoğunun altına düşen malzemeyi eksik olarak işaretler', () => {
    const materials = [mat('A', false, { purchasePrice: 1 })];
    const inventory: InventoryLevel[] = [
      { materialRef: 'A', onHand: 5, safetyStock: 20, inTransit: 0 },
    ];
    // Talep yok ama emniyet stoğu altında
    const demand: MrpDemandItem[] = [{ materialRef: 'A', qty: 0, type: 'order' }];

    const r = calc.compute(build({ materials, demand, inventory }));
    const sh = r.shortages.find((s) => s.materialRef === 'A');
    assert.ok(sh, 'A eksik listesinde olmalı');
    assert.equal(sh?.shortageQty, 15); // 20 - 5
  });

  it('net ihtiyaç var ve yoldaki tedarik yoksa eksik olarak işaretler', () => {
    const materials = [mat('A', false, { purchasePrice: 1 })];
    const demand: MrpDemandItem[] = [{ materialRef: 'A', qty: 40, type: 'order' }];
    const inventory: InventoryLevel[] = [
      { materialRef: 'A', onHand: 10, safetyStock: 0, inTransit: 0 },
    ];

    const r = calc.compute(build({ materials, demand, inventory }));
    const sh = r.shortages.find((s) => s.materialRef === 'A');
    assert.ok(sh);
    assert.equal(sh?.shortageQty, 30);
  });
});

describe('MrpCalculator — kapasite yükü ve darboğaz', () => {
  it('operasyon dakikalarını iş merkezine toplar ve darboğaz tespit eder', () => {
    const boms: MrpBomInput[] = [
      {
        id: 'b1',
        productMaterialRef: 'P',
        outputQty: 1,
        components: [],
        operations: [{ workCenterId: 'wc1', setupMin: 60, runMinPerUnit: 10 }],
      },
    ];
    const materials = [mat('P', true)];
    const workCenters: MrpWorkCenterInput[] = [
      { id: 'wc1', name: 'CNC', dailyHours: 8, costPerHour: 100 },
    ];
    // 100 adet üretim → 60 + 10×100 = 1060 dk = 17.667 saat
    const demand: MrpDemandItem[] = [{ materialRef: 'P', qty: 100, type: 'order' }];

    const r = calc.compute(
      build({ boms, materials, workCenters, demand, params: { ...defaultParams, horizonDays: 1 } }),
    );

    const load = r.capacityLoad.find((l) => l.workCenterId === 'wc1')!;
    // availableHours = 8 × 1 = 8 ; loadHours ≈ 17.6667 > 8 → darboğaz
    assert.equal(load.availableHours, 8);
    assert.ok(load.loadHours > 17 && load.loadHours < 18, `loadHours=${load.loadHours}`);
    assert.equal(load.bottleneck, true);
    assert.ok(load.utilizationPct > 200);
    assert.equal(r.summary.bottleneckCount, 1);
  });

  it('yeterli kapasitede darboğaz yok', () => {
    const boms: MrpBomInput[] = [
      {
        id: 'b1',
        productMaterialRef: 'P',
        outputQty: 1,
        components: [],
        operations: [{ workCenterId: 'wc1', setupMin: 0, runMinPerUnit: 1 }],
      },
    ];
    const materials = [mat('P', true)];
    const workCenters: MrpWorkCenterInput[] = [
      { id: 'wc1', name: 'Montaj', dailyHours: 8, costPerHour: 50 },
    ];
    const demand: MrpDemandItem[] = [{ materialRef: 'P', qty: 60, type: 'order' }];

    const r = calc.compute(
      build({
        boms,
        materials,
        workCenters,
        demand,
        params: { ...defaultParams, horizonDays: 30 },
      }),
    );
    const load = r.capacityLoad.find((l) => l.workCenterId === 'wc1')!;
    // 60 dk = 1 saat ; available = 240 saat
    assert.equal(load.loadHours, 1);
    assert.equal(load.availableHours, 240);
    assert.equal(load.bottleneck, false);
    assert.equal(r.summary.bottleneckCount, 0);
  });
});

describe('MrpCalculator — döngü koruması', () => {
  it('yarı mamul kendini içeren reçetede sonsuz döngüye girmez', () => {
    // P → SEMI → P (döngü)
    const boms: MrpBomInput[] = [
      {
        id: 'b1',
        productMaterialRef: 'P',
        outputQty: 1,
        components: [{ materialRef: 'SEMI', qty: 1, scrapPct: 0, isSemi: true }],
        operations: [],
      },
      {
        id: 'b2',
        productMaterialRef: 'SEMI',
        outputQty: 1,
        components: [{ materialRef: 'P', qty: 1, scrapPct: 0, isSemi: true }],
        operations: [],
      },
    ];
    const materials = [mat('P', true), mat('SEMI', true)];
    const demand: MrpDemandItem[] = [{ materialRef: 'P', qty: 1, type: 'order' }];

    // Sonsuz döngüye girmeden tamamlanmalı (timeout = başarısızlık)
    const r = calc.compute(build({ boms, materials, demand }));
    assert.ok(Array.isArray(r.production));
    // Hem P hem SEMI üretilen olarak görünür, satın alma yoktur
    assert.ok(r.production.some((x) => x.materialRef === 'P'));
    assert.ok(r.production.some((x) => x.materialRef === 'SEMI'));
  });
});

describe('MrpCalculator — determinizm', () => {
  it('ayni girdi icin ayni ciktiyi verir ve materialRef sirali doner', () => {
    const materials = [
      mat('Z', false, { purchasePrice: 1 }),
      mat('A', false, { purchasePrice: 1 }),
      mat('M', false, { purchasePrice: 1 }),
    ];
    const demand: MrpDemandItem[] = [
      { materialRef: 'Z', qty: 1, type: 'order' },
      { materialRef: 'A', qty: 1, type: 'order' },
      { materialRef: 'M', qty: 1, type: 'order' },
    ];
    const input = build({ materials, demand });
    const r1 = calc.compute(input);
    const r2 = calc.compute(input);
    assert.deepEqual(r1, r2);
    assert.deepEqual(
      r1.purchase.map((p) => p.materialRef),
      ['A', 'M', 'Z'],
    );
  });

  it('birden fazla talep aynı malzemeyi toplar', () => {
    const materials = [mat('A', false, { purchasePrice: 1 })];
    const demand: MrpDemandItem[] = [
      { materialRef: 'A', qty: 10, type: 'order' },
      { materialRef: 'A', qty: 15, type: 'forecast' },
    ];
    const r = calc.compute(build({ materials, demand }));
    assert.equal(r.purchase.length, 1);
    assert.equal(r.purchase[0]?.qty, 25);
  });
});

describe('MrpCalculator — satın alma meta', () => {
  it('leadTimeDays neededByOffsetDays alanina yansir', () => {
    const materials = [mat('A', false, { purchasePrice: 1, leadTimeDays: 7 })];
    const demand: MrpDemandItem[] = [{ materialRef: 'A', qty: 1, type: 'order' }];
    const r = calc.compute(build({ materials, demand }));
    assert.equal(r.purchase[0]?.neededByOffsetDays, 7);
  });
});
