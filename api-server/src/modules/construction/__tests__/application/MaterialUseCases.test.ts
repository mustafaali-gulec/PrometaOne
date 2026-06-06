/**
 * Malzeme & Depo use-case testleri (node:test) — malzeme/depo, stok hareketi
 * (giriş/transfer/çıkış) + stok cache, malzeme talebi durum makinesi.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  ChangeMaterialRequestStatusUseCase,
  CreateMaterialRequestUseCase,
  CreateMaterialUseCase,
  CreateWarehouseUseCase,
  ListStockUseCase,
  RecordStockMovementUseCase,
} from '../../application/useCases/MaterialUseCases.js';
import { CreateProjectUseCase } from '../../application/useCases/ProjectUseCases.js';
import {
  DuplicateMaterialCodeError,
  InvalidStatusTransitionError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  FixedClock,
  InMemoryMaterialRepository,
  InMemoryMaterialRequestRepository,
  InMemoryProjectRepository,
  InMemoryStockRepository,
  InMemoryWarehouseRepository,
} from '../fakes.js';

describe('MaterialUseCases', () => {
  let materials: InMemoryMaterialRepository;
  let warehouses: InMemoryWarehouseRepository;
  let stock: InMemoryStockRepository;
  let requests: InMemoryMaterialRequestRepository;
  let projects: InMemoryProjectRepository;
  let clock: FixedClock;

  beforeEach(() => {
    materials = new InMemoryMaterialRepository();
    warehouses = new InMemoryWarehouseRepository();
    stock = new InMemoryStockRepository(warehouses);
    requests = new InMemoryMaterialRequestRepository();
    projects = new InMemoryProjectRepository();
    clock = new FixedClock(new Date('2026-06-06T00:00:00.000Z'));
  });

  async function makeProject(): Promise<number> {
    const p = await new CreateProjectUseCase(projects).execute({ companyId: 1, name: 'P' });
    return p.id;
  }

  it('malzeme oluşturur, aynı kodu reddeder', async () => {
    const uc = new CreateMaterialUseCase(materials);
    const m = await uc.execute({
      companyId: 1,
      code: 'CIMENTO',
      name: 'Çimento',
      unit: 'ton',
      wastePct: 2,
    });
    assert.equal(m.code, 'CIMENTO');
    assert.equal(m.wastePct, 2);
    await assert.rejects(
      () => uc.execute({ companyId: 1, code: 'CIMENTO', name: 'X', unit: 'ton' }),
      DuplicateMaterialCodeError,
    );
  });

  it('stok hareketi (giriş/transfer/çıkış) stok cache’ini günceller', async () => {
    const projectId = await makeProject();
    const mat = await new CreateMaterialUseCase(materials).execute({
      companyId: 1,
      code: 'M1',
      name: 'Demir',
      unit: 'ton',
    });
    const wA = await new CreateWarehouseUseCase(warehouses, projects).execute({
      companyId: 1,
      projectId,
      code: 'A',
      name: 'Merkez',
    });
    const wB = await new CreateWarehouseUseCase(warehouses, projects).execute({
      companyId: 1,
      projectId,
      code: 'B',
      name: 'Saha',
    });
    const rec = new RecordStockMovementUseCase(stock, materials, warehouses);
    await rec.execute({
      companyId: 1,
      materialId: mat.id,
      kind: 'in',
      toWarehouse: wA.id,
      qty: 100,
      movedAt: '2026-06-01',
    });
    await rec.execute({
      companyId: 1,
      materialId: mat.id,
      kind: 'transfer',
      fromWarehouse: wA.id,
      toWarehouse: wB.id,
      qty: 30,
      movedAt: '2026-06-02',
    });
    await rec.execute({
      companyId: 1,
      materialId: mat.id,
      kind: 'out',
      fromWarehouse: wB.id,
      qty: 10,
      movedAt: '2026-06-03',
    });

    const view = await new ListStockUseCase(stock).execute({ companyId: 1, projectId });
    const qa = view.find((s) => s.warehouseId === wA.id)?.qty;
    const qb = view.find((s) => s.warehouseId === wB.id)?.qty;
    assert.equal(qa, 70); // 100 - 30
    assert.equal(qb, 20); // 30 - 10
  });

  it('transfer için kaynak/hedef depo gerekli (tür-depo doğrulaması)', async () => {
    const projectId = await makeProject();
    const mat = await new CreateMaterialUseCase(materials).execute({
      companyId: 1,
      code: 'M2',
      name: 'Kum',
      unit: 'm3',
    });
    const wA = await new CreateWarehouseUseCase(warehouses, projects).execute({
      companyId: 1,
      projectId,
      code: 'A',
      name: 'Merkez',
    });
    await assert.rejects(
      () =>
        new RecordStockMovementUseCase(stock, materials, warehouses).execute({
          companyId: 1,
          materialId: mat.id,
          kind: 'transfer',
          fromWarehouse: wA.id,
          qty: 5,
          movedAt: '2026-06-01',
        }),
      /hedef depo/i,
    );
  });

  it('malzeme talebi: oluştur (MT-YYYY-0001) + durum makinesi', async () => {
    const projectId = await makeProject();
    const mat = await new CreateMaterialUseCase(materials).execute({
      companyId: 1,
      code: 'M3',
      name: 'Tuğla',
      unit: 'ad',
    });
    const req = await new CreateMaterialRequestUseCase(requests, projects, clock).execute({
      companyId: 1,
      projectId,
      lines: [{ materialId: mat.id, qty: 500 }],
    });
    assert.equal(req.reqNo, 'MT-2026-0001');
    assert.equal(req.status, 'draft');
    assert.equal(req.lines.length, 1);

    const status = new ChangeMaterialRequestStatusUseCase(requests, clock);
    // draft → approved geçersiz
    await assert.rejects(
      () => status.execute({ companyId: 1, requestId: req.id, status: 'approved' }),
      InvalidStatusTransitionError,
    );
    const sub = await status.execute({ companyId: 1, requestId: req.id, status: 'submitted' });
    assert.equal(sub.status, 'submitted');
    const app = await status.execute({
      companyId: 1,
      requestId: req.id,
      status: 'approved',
      actorUserId: 9,
    });
    assert.equal(app.status, 'approved');
    assert.equal(app.approvedBy, 9);
  });
});
