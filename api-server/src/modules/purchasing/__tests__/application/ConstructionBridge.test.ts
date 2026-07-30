/**
 * Satınalma → şantiye taahhüt köprüsü testleri.
 *
 * Ağırlık: poToCommitmentSync eşleyicisinin dürüstlük kuralları (taslak ve
 * bağsız sipariş senkrona GİTMEZ; teslim tutarı KÜMÜLATİF; received/closed
 * tam teslim beyanıdır; cancelled bayrağı) ve use-case'lerin köprüyü doğru
 * anlarda çağırması. HTTP adaptörünün asla fırlatmaması da sınanır.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  poToCommitmentSync,
  type CommitmentSyncPayload,
  type ConstructionBridge,
} from '../../application/ports/ConstructionBridge.js';
import {
  CreatePurchaseOrderUseCase,
  ChangePoStatusUseCase,
} from '../../application/useCases/PurchaseOrderUseCases.js';
import { CreateVendorUseCase } from '../../application/useCases/VendorUseCases.js';
import { PurchaseOrder, type PurchaseOrderProps } from '../../domain/entities/PurchaseOrder.js';
import { HttpConstructionBridge } from '../../infrastructure/bridge/HttpConstructionBridge.js';
import {
  FixedClock,
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseRequestRepository,
  InMemoryVendorRepository,
} from '../fakes.js';

const NOW = new Date('2026-07-30T10:00:00.000Z');

function po(over: Partial<PurchaseOrderProps> = {}): PurchaseOrder {
  return PurchaseOrder.create({
    id: 1,
    companyId: 1,
    poNo: 'PO-2026-0001',
    vendorId: 7,
    prId: null,
    status: 'ordered',
    currency: 'TRY',
    note: null,
    orderedAt: NOW,
    deliveredAt: null,
    createdBy: 1,
    createdAt: NOW,
    updatedAt: NOW,
    constructionProjectId: 5,
    lines: [
      {
        lineNo: 1,
        description: 'C30 hazır beton',
        quantity: 100,
        receivedQty: 40,
        unitPrice: 3000,
        constructionBoqLineId: 12,
      },
      { lineNo: 2, description: 'Nervürlü demir', quantity: 10, receivedQty: 0, unitPrice: 25000 },
    ],
    ...over,
  });
}

describe('poToCommitmentSync — eşleme dürüstlüğü', () => {
  it('şantiye bağı olmayan sipariş senkrona GİTMEZ (null)', () => {
    assert.equal(poToCommitmentSync(po({ constructionProjectId: null })), null);
  });

  it('TASLAK senkrona gitmez — taahhüt verilmiş sipariştir', () => {
    assert.equal(poToCommitmentSync(po({ status: 'draft', orderedAt: null })), null);
  });

  it('ordered: satırlar poz bağıyla eşlenir; teslim tutarı KÜMÜLATİF', () => {
    const p = poToCommitmentSync(po())!;
    assert.equal(p.source, 'purchase_order');
    assert.equal(p.lines.length, 2);
    const l1 = p.lines[0]!;
    assert.equal(l1.refNo, 'PO-2026-0001');
    assert.equal(l1.refLineNo, 1);
    assert.equal(l1.projectId, 5);
    assert.equal(l1.boqLineId, 12);
    assert.equal(l1.amount, 300_000);
    assert.equal(l1.deliveredAmount, 120_000); // 40 × 3000 — kümülatif
    assert.equal(p.lines[1]!.boqLineId, null); // bağsız satır unlinked raporlanır
    assert.equal(l1.cancelled, undefined);
  });

  it('received/closed TAM TESLİM beyanıdır — kalem kalem işlenmemiş olsa da', () => {
    const p = poToCommitmentSync(po({ status: 'received', deliveredAt: NOW }))!;
    assert.equal(p.lines[0]!.deliveredAmount, 300_000);
    assert.equal(p.lines[1]!.deliveredAmount, 250_000);
  });

  it('cancelled bayrağı taşınır; alınan kısım kümülatif kalır', () => {
    const p = poToCommitmentSync(po({ status: 'cancelled' }))!;
    assert.equal(p.lines[0]!.cancelled, true);
    assert.equal(p.lines[0]!.deliveredAmount, 120_000);
  });

  it('fazla mal kabulü (receivedQty > quantity) taahhüt tutarını AŞMAZ', () => {
    const p = poToCommitmentSync(
      po({
        lines: [{ lineNo: 1, description: 'X', quantity: 10, receivedQty: 12, unitPrice: 100 }],
      }),
    )!;
    assert.equal(p.lines[0]!.deliveredAmount, 1000); // 10 × 100'e kapaklanır
  });
});

class SpyBridge implements ConstructionBridge {
  calls: PurchaseOrder[] = [];
  syncPurchaseOrder(po: PurchaseOrder): Promise<void> {
    this.calls.push(po);
    return Promise.resolve();
  }
}

describe('use-case köprü tetiklemesi', () => {
  it('markOrdered ile oluşturulan bağlı sipariş köprüyü çağırır', async () => {
    const poRepo = new InMemoryPurchaseOrderRepository();
    const vendorRepo = new InMemoryVendorRepository();
    const v = await new CreateVendorUseCase(vendorRepo).execute({ companyId: 1, name: 'Beton AŞ' });
    const bridge = new SpyBridge();
    const uc = new CreatePurchaseOrderUseCase(
      poRepo,
      vendorRepo,
      new InMemoryPurchaseRequestRepository(),
      new FixedClock(),
      bridge,
    );
    await uc.execute({
      companyId: 1,
      vendorId: v.id,
      markOrdered: true,
      constructionProjectId: 5,
      lines: [{ description: 'Beton', quantity: 10, unitPrice: 100 }],
    });
    assert.equal(bridge.calls.length, 1);
    assert.equal(bridge.calls[0]!.constructionProjectId, 5);
  });

  it('statü değişimi köprüyü çağırır (draft→ordered)', async () => {
    const poRepo = new InMemoryPurchaseOrderRepository();
    const vendorRepo = new InMemoryVendorRepository();
    const v = await new CreateVendorUseCase(vendorRepo).execute({ companyId: 1, name: 'Beton AŞ' });
    const bridge = new SpyBridge();
    const create = new CreatePurchaseOrderUseCase(
      poRepo,
      vendorRepo,
      new InMemoryPurchaseRequestRepository(),
      new FixedClock(),
      bridge,
    );
    const dto = await create.execute({
      companyId: 1,
      vendorId: v.id,
      constructionProjectId: 5,
      lines: [{ description: 'Beton', quantity: 10, unitPrice: 100 }],
    });
    const change = new ChangePoStatusUseCase(poRepo, new FixedClock(), bridge);
    await change.execute({ companyId: 1, poId: dto.id, status: 'ordered' });
    // create de çağırır (adapter taslağı kendisi eler — eşleyici null döner)
    assert.equal(bridge.calls.length, 2);
    assert.equal(poToCommitmentSync(bridge.calls[0]!), null);
    assert.notEqual(poToCommitmentSync(bridge.calls[1]!), null);
  });
});

describe('HttpConstructionBridge — asla fırlatmaz', () => {
  it('ağ hatasında sipariş işlemi düşmez (fırlatmaz, loglar)', async () => {
    const bridge = new HttpConstructionBridge({
      baseUrl: 'http://localhost:1',
      jwtSecret: 'x'.repeat(32),
      fetchFn: () => Promise.reject(new Error('ECONNREFUSED')),
    });
    await bridge.syncPurchaseOrder(po()); // fırlatmamalı
  });

  it('bağsız siparişte HTTP çağrısı hiç yapılmaz', async () => {
    let called = 0;
    const bridge = new HttpConstructionBridge({
      baseUrl: 'http://x',
      jwtSecret: 'x'.repeat(32),
      fetchFn: () => {
        called += 1;
        return Promise.resolve(new Response('{}'));
      },
    });
    await bridge.syncPurchaseOrder(po({ constructionProjectId: null }));
    assert.equal(called, 0);
  });

  it('yükü doğru uca doğru gövdeyle POST eder', async () => {
    let url = '';
    let body: CommitmentSyncPayload | null = null;
    let auth = '';
    const bridge = new HttpConstructionBridge({
      baseUrl: 'http://cs:3002',
      jwtSecret: 'x'.repeat(32),
      fetchFn: (input, init) => {
        url = input as string;
        body = JSON.parse(init?.body as string) as CommitmentSyncPayload;
        auth = (init?.headers as Record<string, string>)['Authorization'] ?? '';
        return Promise.resolve(
          new Response(JSON.stringify({ inserted: 2, updated: 0, cancelled: 0, errors: [] })),
        );
      },
    });
    await bridge.syncPurchaseOrder(po());
    assert.equal(url, 'http://cs:3002/v1/construction/commitments/sync');
    assert.equal(body!.companyId, 1);
    assert.equal(body!.lines.length, 2);
    assert.match(auth, /^Bearer .+/);
  });
});
