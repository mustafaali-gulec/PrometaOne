/**
 * Adam×saat & verimlilik (FAZ 4) testleri.
 *
 * Odak: oran hesaplarının payda-0 davranışı (null, 0 değil), ağırlıklı verim,
 * ilerleme-işçilik makası, EAC ve sözleşme sınırı denetimi.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type {
  BoqPerformanceRow,
  ContractManhourSummary,
  PerformanceRepository,
} from '../../application/ports/PerformanceRepository.js';
import { CreateContractUseCase } from '../../application/useCases/ContractUseCases.js';
import {
  GetContractPerformanceUseCase,
  GetProjectPerformanceUseCase,
  SetUnitManhoursUseCase,
} from '../../application/useCases/PerformanceUseCases.js';
import { CreateProjectUseCase } from '../../application/useCases/ProjectUseCases.js';
import {
  ConstructionValidationError,
  ContractNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  computeProductivity,
  efficiencyBand,
  estimateAtCompletion,
  safePct,
  safeRatio,
  weightedEfficiency,
} from '../../domain/valueObjects/Productivity.js';
import { FixedClock, InMemoryContractRepository, InMemoryProjectRepository } from '../fakes.js';

// ===== SAF HESAPLAR =========================================================

describe('safeRatio / safePct', () => {
  it('payda 0 ise null döner (0 değil)', () => {
    assert.equal(safeRatio(5, 0), null);
    assert.equal(safePct(5, 0), null);
  });
  it('normal bölme', () => {
    assert.equal(safeRatio(10, 4), 2.5);
    assert.equal(safePct(1, 4), 25);
  });
  it('pay 0 ise 0 döner (null değil — ölçüm var, sonuç sıfır)', () => {
    assert.equal(safeRatio(0, 4), 0);
    assert.equal(safePct(0, 4), 0);
  });
});

describe('computeProductivity', () => {
  it('planına göre iyi giden pozda verim > 1', () => {
    // 100 m³ planlandı, birim 2 a×s → plan 200 a×s.
    // 50 m³ üretildi (beklenen 100 a×s), 80 a×s harcandı → verim 1,25
    const r = computeProductivity({
      plannedQty: 100,
      plannedUnitManhours: 2,
      producedQty: 50,
      actualManhours: 80,
    });
    assert.equal(r.plannedManhours, 200);
    assert.equal(r.expectedManhours, 100);
    assert.equal(r.actualUnitManhours, 1.6);
    assert.equal(r.efficiency, 1.25);
    assert.equal(r.manhourVariance, -20);
    assert.equal(r.producedPct, 50);
    assert.equal(r.manhourPct, 40);
    // Makas pozitif: miktar adam-saatten hızlı ilerliyor (iyi)
    assert.equal(r.progressGap, 10);
  });

  it('adam×saat miktardan hızlı tükeniyorsa makas negatif çıkar', () => {
    // İşin %50'si yapıldı ama adam-saatin %70'i yakıldı
    const r = computeProductivity({
      plannedQty: 100,
      plannedUnitManhours: 2,
      producedQty: 50,
      actualManhours: 140,
    });
    assert.equal(r.producedPct, 50);
    assert.equal(r.manhourPct, 70);
    assert.equal(r.progressGap, -20);
    assert.ok(r.efficiency !== null && r.efficiency < 1);
    assert.equal(r.manhourVariance, 40);
  });

  it('plan adam×saat girilmemişse oranlar null (verim "kötü" değil, ölçülemez)', () => {
    const r = computeProductivity({
      plannedQty: 100,
      plannedUnitManhours: 0,
      producedQty: 50,
      actualManhours: 80,
    });
    assert.equal(r.plannedManhours, 0);
    assert.equal(r.manhourPct, null);
    assert.equal(r.progressGap, null);
    // Beklenen 0 olduğu için verim 0 çıkar; band yorumu bunu 'critical' der
    assert.equal(r.efficiency, 0);
  });

  it('henüz üretim yoksa birim a×s ve makas null', () => {
    const r = computeProductivity({
      plannedQty: 100,
      plannedUnitManhours: 2,
      producedQty: 0,
      actualManhours: 30,
    });
    assert.equal(r.actualUnitManhours, null);
    assert.equal(r.producedPct, 0);
    assert.equal(r.manhourPct, 15);
    assert.equal(r.progressGap, -15);
    // 0 üretim için beklenen 0 → verim 0
    assert.equal(r.efficiency, 0);
  });
});

describe('weightedEfficiency', () => {
  it('küçük pozun gürültüsü büyük pozu bastırmaz', () => {
    const rows = [
      // 1 a×s'lik poz, çok kötü verim
      { expectedManhours: 1, actualManhours: 10 },
      // 10.000 a×s'lik poz, iyi verim
      { expectedManhours: 10_000, actualManhours: 9_000 },
    ];
    const w = weightedEfficiency(rows);
    // Ağırlıklı: 10001/9010 ≈ 1,11 (basit ortalama ≈ 0,60 olurdu)
    assert.ok(w !== null && w > 1.1);
    const naive = (1 / 10 + 10_000 / 9_000) / 2;
    assert.ok(naive < 0.62);
  });
  it('hiç harcama yoksa null', () => {
    assert.equal(weightedEfficiency([{ expectedManhours: 5, actualManhours: 0 }]), null);
  });
  it('boş liste null', () => {
    assert.equal(weightedEfficiency([]), null);
  });
});

describe('estimateAtCompletion', () => {
  it('mevcut verimi bitişe uzatır', () => {
    // 50 m³'te 80 a×s → birim 1,6 ; 100 m³ için 160 a×s
    assert.equal(
      estimateAtCompletion({
        plannedQty: 100,
        plannedUnitManhours: 2,
        producedQty: 50,
        actualManhours: 80,
      }),
      160,
    );
  });
  it('üretim yoksa plana döner (elimizde plandan başka veri yok)', () => {
    assert.equal(
      estimateAtCompletion({
        plannedQty: 100,
        plannedUnitManhours: 2,
        producedQty: 0,
        actualManhours: 0,
      }),
      200,
    );
  });
});

describe('efficiencyBand', () => {
  it('null → unknown', () => {
    assert.equal(efficiencyBand(null), 'unknown');
  });
  it('%10 tolerans bandı: 0,98 ve 1,05 "yolunda" sayılır', () => {
    assert.equal(efficiencyBand(0.98), 'onTrack');
    assert.equal(efficiencyBand(1.05), 'onTrack');
  });
  it('eşikler', () => {
    assert.equal(efficiencyBand(0.7), 'critical');
    assert.equal(efficiencyBand(0.85), 'behind');
    assert.equal(efficiencyBand(1.3), 'ahead');
  });
});

// ===== USE-CASE'LER =========================================================

/** Test verisi üreten bellek-içi performans repo'su. */
class FakePerformanceRepository implements PerformanceRepository {
  rows: BoqPerformanceRow[] = [];
  updates: { boqLineId: number; unitManhours: number }[] = [];

  async listByContract(contractId: number): Promise<ReadonlyArray<BoqPerformanceRow>> {
    return Promise.resolve(this.rows.filter((r) => r.contractId === contractId));
  }
  async listByProject(projectId: number): Promise<ReadonlyArray<BoqPerformanceRow>> {
    return Promise.resolve(this.rows.filter((r) => r.projectId === projectId));
  }
  async contractSummary(): Promise<ContractManhourSummary | null> {
    return Promise.resolve(null);
  }
  async projectSummaries(): Promise<ReadonlyArray<ContractManhourSummary>> {
    return Promise.resolve([]);
  }
  async setUnitManhours(
    _companyId: number,
    updates: ReadonlyArray<{ boqLineId: number; unitManhours: number }>,
  ): Promise<number> {
    this.updates.push(...updates);
    return Promise.resolve(updates.length);
  }
}

function makeRow(over: Partial<BoqPerformanceRow>): BoqPerformanceRow {
  const base: BoqPerformanceRow = {
    boqLineId: 1,
    contractId: 1,
    projectId: 1,
    lineNo: 1,
    pozNo: 'A-1',
    description: 'Kalıp',
    unit: 'm2',
    locationId: null,
    plannedQty: 100,
    unitPrice: 500,
    plannedAmount: 50_000,
    pursantajPct: 10,
    plannedUnitManhours: 2,
    plannedManhours: 200,
    progressQty: 40,
    progressAmount: 20_000,
    producedQty: 50,
    ownManhours: 60,
    subManhours: 20,
    actualManhours: 80,
    machineHours: 5,
    expenseAmount: 15_000,
    progressPct: 40,
    producedPct: 50,
    manhourPct: 40,
    earnedPursantaj: 5,
    actualUnitManhours: 1.6,
    expectedManhours: 100,
    efficiency: 1.25,
    committedAmount: 8_000,
    openCommittedAmount: 3_000,
    costExposure: 18_000,
    budgetVariance: 32_000,
    manhourVariance: -20,
  };
  return { ...base, ...over };
}

describe('PerformanceUseCases', () => {
  let perf: FakePerformanceRepository;
  let contracts: InMemoryContractRepository;
  let projects: InMemoryProjectRepository;
  let clock: FixedClock;
  let projectId: number;
  let contractId: number;

  beforeEach(async () => {
    perf = new FakePerformanceRepository();
    contracts = new InMemoryContractRepository();
    projects = new InMemoryProjectRepository();
    clock = new FixedClock(new Date('2026-07-28T00:00:00.000Z'));
    const p = await new CreateProjectUseCase(projects).execute({ companyId: 1, name: 'Perf P' });
    projectId = p.id;
    const c = await new CreateContractUseCase(contracts, projects, clock).execute({
      companyId: 1,
      projectId,
      partyKind: 'subcontractor',
      title: 'Kaba işler',
      amount: 1_000_000,
    });
    contractId = c.id;
  });

  it('sözleşme performansı türev göstergeleri ekler', async () => {
    perf.rows = [makeRow({ contractId, projectId })];
    const rep = await new GetContractPerformanceUseCase(perf, contracts).execute({
      contractId,
      companyId: 1,
    });
    const row = rep.rows[0]!;
    assert.equal(row.progressGap, 10);
    assert.equal(row.eacManhours, 160);
    assert.equal(row.eacVariance, -40);
    assert.equal(row.band, 'ahead');
    // Fiziksel üretim (50) hakedişin (40) önünde → hakediş kesilmemiş iş var
    assert.equal(row.productionVsProgressQty, 10);
  });

  it('özet ağırlıklı verim kullanır ve planı olmayan satırı sayar', async () => {
    perf.rows = [
      makeRow({ boqLineId: 1, contractId, projectId, expectedManhours: 1, actualManhours: 10 }),
      makeRow({
        boqLineId: 2,
        contractId,
        projectId,
        expectedManhours: 10_000,
        actualManhours: 9_000,
      }),
      // Planı olmayan satır
      makeRow({
        boqLineId: 3,
        contractId,
        projectId,
        plannedUnitManhours: 0,
        plannedManhours: 0,
        expectedManhours: 0,
        actualManhours: 5,
      }),
    ];
    const rep = await new GetContractPerformanceUseCase(perf, contracts).execute({
      contractId,
      companyId: 1,
    });
    assert.equal(rep.summary.lineCount, 3);
    assert.equal(rep.summary.linesWithoutPlan, 1);
    // 10 + 9.000 + 5 = 9.015
    assert.equal(rep.summary.actualManhours, 9_015);
    assert.equal(rep.summary.expectedManhours, 10_001);
    const eff = rep.summary.efficiency;
    assert.ok(eff !== null);
    assert.ok(Math.abs(eff - 10_001 / 9_015) < 1e-9);
    // Ağırlıklı verim 1'in üstünde: büyük pozun iyi verimi baskın
    assert.ok(eff > 1.1);
  });

  it('planlanan a×s hiç yoksa özet oranı null (0 değil)', async () => {
    perf.rows = [
      makeRow({
        contractId,
        projectId,
        plannedUnitManhours: 0,
        plannedManhours: 0,
        expectedManhours: 0,
        actualManhours: 0,
      }),
    ];
    const rep = await new GetContractPerformanceUseCase(perf, contracts).execute({
      contractId,
      companyId: 1,
    });
    assert.equal(rep.summary.manhourPct, null);
    assert.equal(rep.summary.efficiency, null);
    assert.equal(rep.summary.band, 'unknown');
  });

  it('olmayan sözleşme için 404', async () => {
    await assert.rejects(
      () =>
        new GetContractPerformanceUseCase(perf, contracts).execute({
          contractId: 9999,
          companyId: 1,
        }),
      ContractNotFoundError,
    );
  });

  it('proje performansı tüm sözleşmeleri kapsar', async () => {
    perf.rows = [
      makeRow({ boqLineId: 1, contractId, projectId }),
      makeRow({ boqLineId: 2, contractId: 999, projectId }),
    ];
    const rep = await new GetProjectPerformanceUseCase(perf, projects).execute({
      projectId,
      companyId: 1,
    });
    assert.equal(rep.rows.length, 2);
  });

  describe('birim adam×saat girişi', () => {
    it('geçerli güncelleme uygulanır', async () => {
      perf.rows = [makeRow({ boqLineId: 7, contractId, projectId })];
      const res = await new SetUnitManhoursUseCase(perf, contracts).execute({
        companyId: 1,
        contractId,
        updates: [{ boqLineId: 7, unitManhours: 3.5 }],
      });
      assert.equal(res.updated, 1);
      assert.deepEqual(perf.updates, [{ boqLineId: 7, unitManhours: 3.5 }]);
    });

    it('negatif değer reddedilir', async () => {
      perf.rows = [makeRow({ boqLineId: 7, contractId, projectId })];
      await assert.rejects(
        () =>
          new SetUnitManhoursUseCase(perf, contracts).execute({
            companyId: 1,
            contractId,
            updates: [{ boqLineId: 7, unitManhours: -1 }],
          }),
        /negatif olamaz/,
      );
    });

    it('başka sözleşmenin keşif satırına yazılamaz', async () => {
      perf.rows = [makeRow({ boqLineId: 7, contractId, projectId })];
      await assert.rejects(
        () =>
          new SetUnitManhoursUseCase(perf, contracts).execute({
            companyId: 1,
            contractId,
            updates: [{ boqLineId: 999, unitManhours: 2 }],
          }),
        (err: unknown) => {
          assert.ok(err instanceof ConstructionValidationError);
          assert.match(err.message, /bu sözleşmeye ait değil/);
          return true;
        },
      );
      assert.equal(perf.updates.length, 0);
    });
  });
});
