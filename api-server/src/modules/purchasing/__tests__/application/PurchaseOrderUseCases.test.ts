/**
 * Satınalma siparişi (PO) use-case testleri.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  ChangePoStatusUseCase,
  CreatePurchaseOrderUseCase,
  UpdatePurchaseOrderUseCase,
} from '../../application/useCases/PurchaseOrderUseCases.js';
import { CreatePurchaseRequestUseCase } from '../../application/useCases/PurchaseRequestUseCases.js';
import { CreateVendorUseCase } from '../../application/useCases/VendorUseCases.js';
import {
  InvalidStatusTransitionError,
  PurchaseOrderNotFoundError,
  VendorNotFoundError,
} from '../../domain/errors/PurchasingErrors.js';
import {
  FixedClock,
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseRequestRepository,
  InMemoryVendorRepository,
} from '../fakes.js';

describe('PurchaseOrderUseCases', () => {
  let poRepo: InMemoryPurchaseOrderRepository;
  let prRepo: InMemoryPurchaseRequestRepository;
  let vendorRepo: InMemoryVendorRepository;
  let clock: FixedClock;

  beforeEach(() => {
    poRepo = new InMemoryPurchaseOrderRepository();
    prRepo = new InMemoryPurchaseRequestRepository();
    vendorRepo = new InMemoryVendorRepository();
    clock = new FixedClock();
  });

  const lines = [{ description: 'Sunucu', quantity: 1, unitPrice: 80000 }];

  async function makeVendor(): Promise<number> {
    const v = await new CreateVendorUseCase(vendorRepo).execute({
      companyId: 100,
      name: 'Tedarik',
    });
    return v.id;
  }

  it('happy: PO-2026-0001 üretir, vendor bağlı, total hesaplanır', async () => {
    const vendorId = await makeVendor();
    const uc = new CreatePurchaseOrderUseCase(poRepo, vendorRepo, prRepo, clock);
    const dto = await uc.execute({ companyId: 100, vendorId, lines });
    assert.equal(dto.poNo, 'PO-2026-0001');
    assert.equal(dto.vendorId, vendorId);
    assert.equal(dto.status, 'draft');
    assert.equal(dto.totalAmount, 80000);
  });

  it('happy: markOrdered → status ordered, orderedAt damgalı', async () => {
    const vendorId = await makeVendor();
    const uc = new CreatePurchaseOrderUseCase(poRepo, vendorRepo, prRepo, clock);
    const dto = await uc.execute({ companyId: 100, vendorId, lines, markOrdered: true });
    assert.equal(dto.status, 'ordered');
    assert.ok(dto.orderedAt);
  });

  it('edge: olmayan vendor → VendorNotFoundError', async () => {
    const uc = new CreatePurchaseOrderUseCase(poRepo, vendorRepo, prRepo, clock);
    await assert.rejects(uc.execute({ companyId: 100, vendorId: 999, lines }), VendorNotFoundError);
  });

  it('happy: prId verilip lines boşsa PR kalemlerinden kopyalanır', async () => {
    const vendorId = await makeVendor();
    const pr = await new CreatePurchaseRequestUseCase(prRepo, clock).execute({
      companyId: 100,
      items: [
        { description: 'A', quantity: 2, unitPrice: 100 },
        { description: 'B', quantity: 1, unitPrice: 300 },
      ],
    });
    const uc = new CreatePurchaseOrderUseCase(poRepo, vendorRepo, prRepo, clock);
    const dto = await uc.execute({ companyId: 100, vendorId, prId: pr.id });
    assert.equal(dto.lines.length, 2);
    assert.equal(dto.totalAmount, 500);
  });

  it('happy: status ordered → received', async () => {
    const vendorId = await makeVendor();
    const create = new CreatePurchaseOrderUseCase(poRepo, vendorRepo, prRepo, clock);
    const po = await create.execute({ companyId: 100, vendorId, lines, markOrdered: true });
    const change = new ChangePoStatusUseCase(poRepo, clock);
    const dto = await change.execute({ companyId: 100, poId: po.id, status: 'received' });
    assert.equal(dto.status, 'received');
    assert.ok(dto.deliveredAt);
  });

  it('edge: draft → received geçersiz', async () => {
    const vendorId = await makeVendor();
    const create = new CreatePurchaseOrderUseCase(poRepo, vendorRepo, prRepo, clock);
    const po = await create.execute({ companyId: 100, vendorId, lines });
    const change = new ChangePoStatusUseCase(poRepo, clock);
    await assert.rejects(
      change.execute({ companyId: 100, poId: po.id, status: 'received' }),
      InvalidStatusTransitionError,
    );
  });

  it('edge: olmayan PO → PurchaseOrderNotFoundError', async () => {
    const change = new ChangePoStatusUseCase(poRepo, clock);
    await assert.rejects(
      change.execute({ companyId: 100, poId: 999, status: 'ordered' }),
      PurchaseOrderNotFoundError,
    );
  });

  it('happy: update satırları değiştirir, total yeniden hesaplanır', async () => {
    const vendorId = await makeVendor();
    const create = new CreatePurchaseOrderUseCase(poRepo, vendorRepo, prRepo, clock);
    const po = await create.execute({ companyId: 100, vendorId, lines });
    const update = new UpdatePurchaseOrderUseCase(poRepo, clock);
    const dto = await update.execute({
      companyId: 100,
      poId: po.id,
      lines: [{ description: 'Yeni', quantity: 4, unitPrice: 250 }],
      note: 'guncellendi',
    });
    assert.equal(dto.totalAmount, 1000);
    assert.equal(dto.lines.length, 1);
    assert.equal(dto.note, 'guncellendi');
  });

  it('edge: olmayan PO update → PurchaseOrderNotFoundError', async () => {
    const update = new UpdatePurchaseOrderUseCase(poRepo, clock);
    await assert.rejects(
      update.execute({ companyId: 100, poId: 999, note: 'x' }),
      PurchaseOrderNotFoundError,
    );
  });
});
