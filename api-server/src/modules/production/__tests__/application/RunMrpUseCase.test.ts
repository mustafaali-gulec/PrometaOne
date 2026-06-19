import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RunMrpRequestDto } from '../../application/dto/MrpDtos.js';
import type { Clock } from '../../application/ports/Clock.js';
import type {
  MrpRunRecord,
  MrpRunRepository,
  NewMrpRunInput,
} from '../../application/ports/MrpRunRepository.js';
import { RunMrpUseCase } from '../../application/useCases/RunMrpUseCase.js';

class FakeMrpRunRepo implements MrpRunRepository {
  public inserted: NewMrpRunInput[] = [];
  async insert(input: NewMrpRunInput): Promise<MrpRunRecord> {
    this.inserted.push(input);
    return {
      id: this.inserted.length,
      companyId: input.companyId,
      no: input.no,
      runAt: input.runAt,
      params: input.params,
      result: input.result,
      createdAt: input.runAt,
    };
  }
  async listByCompany(): Promise<ReadonlyArray<MrpRunRecord>> {
    return [];
  }
}

const fixedClock: Clock = { now: () => new Date('2026-06-19T14:30:45.000Z') };

function baseRequest(): RunMrpRequestDto {
  return {
    companyId: 42,
    params: { horizonDays: 30, useSafetyStock: true, includeInTransit: true },
    materials: [
      { id: 'P', name: 'Mamul', code: 'P', unit: 'adet', isManufactured: true },
      {
        id: 'A',
        name: 'Hammadde',
        code: 'A',
        unit: 'adet',
        purchasePrice: 5,
        isManufactured: false,
      },
    ],
    inventory: [{ materialRef: 'A', onHand: 0, safetyStock: 0, inTransit: 0 }],
    boms: [
      {
        id: 'b1',
        productMaterialRef: 'P',
        outputQty: 1,
        components: [{ materialRef: 'A', qty: 2, scrapPct: 0, isSemi: false }],
        operations: [],
      },
    ],
    workCenters: [],
    demand: [{ materialRef: 'P', qty: 10, type: 'order' }],
  };
}

describe('RunMrpUseCase', () => {
  it('planı hesaplar, koşuyu persist eder ve runAt/no döner', async () => {
    const repo = new FakeMrpRunRepo();
    const uc = new RunMrpUseCase(repo, fixedClock);

    const result = await uc.execute(baseRequest());

    // İçerik: P üretilen, A satın alınan (10×2=20, 20×5=100)
    assert.equal(result.production.length, 1);
    assert.equal(result.purchase.find((p) => p.materialRef === 'A')?.qty, 20);
    assert.equal(result.summary.totalPurchaseCost, 100);

    // Meta
    assert.equal(result.runAt, '2026-06-19T14:30:45.000Z');
    assert.equal(result.no, 'MRP-20260619-143045');

    // Persist edildi
    assert.equal(repo.inserted.length, 1);
    assert.equal(repo.inserted[0]?.companyId, 42);
    assert.equal(repo.inserted[0]?.no, 'MRP-20260619-143045');
    assert.equal(repo.inserted[0]?.result.summary.distinctProductionItems, 1);
  });

  it('isteğin inventory dizisini stok sağlayıcı olarak kullanır', async () => {
    const repo = new FakeMrpRunRepo();
    const uc = new RunMrpUseCase(repo, fixedClock);

    const req = baseRequest();
    req.inventory = [{ materialRef: 'A', onHand: 100, safetyStock: 0, inTransit: 0 }];
    const result = await uc.execute(req);

    // 20 ihtiyaç - 100 stok → satın alma yok
    assert.equal(result.purchase.length, 0);
  });
});
