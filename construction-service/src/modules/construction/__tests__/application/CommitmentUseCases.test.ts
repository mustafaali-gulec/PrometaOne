/**
 * FAZ 7 — Taahhüt & EVM testleri.
 *
 * Ağırlık: Commitment durum makinesi (teslimattan türeyen durum, geriye
 * gitmeyen teslimat, kapalı kaydın dokunulmazlığı) ve SyncCommitmentsUseCase
 * idempotensi (aynı yük iki kez → sonuç değişmez; kısmi başarı errors[]).
 * SQL görünümleri (EVM) smoke'ta canlı sınanır.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type {
  CommitmentFilter,
  CommitmentRepository,
  ContractEvmRow,
  NewCommitmentInput,
  ProjectCommitmentSummaryRow,
} from '../../application/ports/CommitmentRepository.js';
import type { ProjectRepository } from '../../application/ports/ProjectRepository.js';
import { SyncCommitmentsUseCase } from '../../application/useCases/CommitmentUseCases.js';
import {
  Commitment,
  type CommitmentProps,
  type CommitmentSource,
} from '../../domain/entities/Commitment.js';
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../../domain/errors/ConstructionErrors.js';
import { FixedClock } from '../fakes.js';

const NOW = new Date('2026-07-29T10:00:00.000Z');

function commitment(over: Partial<CommitmentProps> = {}): Commitment {
  return Commitment.create({
    id: 1,
    companyId: 1,
    projectId: 5,
    contractId: 3,
    boqLineId: 12,
    locationId: null,
    source: 'manual',
    refNo: 'PO-2026-001',
    refLineNo: 1,
    vendorId: 77,
    description: 'C30 hazır beton',
    quantity: 100,
    unit: 'm3',
    unitPrice: 3000,
    amount: 300_000,
    deliveredAmount: 0,
    currency: 'TRY',
    status: 'open',
    committedAt: '2026-07-29',
    closedAt: null,
    note: null,
    createdBy: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  });
}

describe('Commitment — durum makinesi', () => {
  it('kısmi teslimat durumu partial yapar, açık taahhüt erir', () => {
    const c = commitment().recordDelivery(120_000, NOW);
    assert.equal(c.status, 'partial');
    assert.equal(c.openAmount, 180_000);
  });

  it('tam teslimat otomatik kapatır; açık taahhüt 0', () => {
    const c = commitment().recordDelivery(300_000, NOW);
    assert.equal(c.status, 'closed');
    assert.equal(c.openAmount, 0);
    assert.notEqual(c.toJSON().closedAt, null);
  });

  it('teslimat KÜMÜLATİFTİR ve geriye gitmez (iade ayrı kayıt)', () => {
    const c = commitment().recordDelivery(120_000, NOW);
    assert.throws(() => c.recordDelivery(100_000, NOW), ConstructionValidationError);
  });

  it('teslimat taahhüt tutarını aşamaz', () => {
    assert.throws(() => commitment().recordDelivery(300_001, NOW), ConstructionValidationError);
  });

  it('elle kapatma: kalan açık tutar maruziyetten düşer', () => {
    const c = commitment().recordDelivery(120_000, NOW).close(NOW);
    assert.equal(c.status, 'closed');
    assert.equal(c.openAmount, 0);
  });

  it('kapanmış taahhüdün tutarı OYNATILMAZ; yalnız not düzeltilebilir', () => {
    const closed = commitment().close(NOW);
    assert.throws(() => closed.update({ amount: 1 }, NOW), InvalidStatusTransitionError);
    assert.equal(closed.update({ note: 'düzeltme' }, NOW).toJSON().note, 'düzeltme');
  });

  it('kapanmış taahhüt iptal edilemez, iptal edilmiş teslimat alamaz', () => {
    const closed = commitment().close(NOW);
    assert.throws(() => closed.cancel(NOW), InvalidStatusTransitionError);
    const cancelled = commitment().cancel(NOW);
    assert.throws(() => cancelled.recordDelivery(1, NOW), InvalidStatusTransitionError);
  });

  it('kısmen teslimli iptal: alınan kısım kalır, açık kısım maruziyetten düşer', () => {
    const c = commitment().recordDelivery(120_000, NOW).cancel(NOW);
    assert.equal(c.status, 'cancelled');
    assert.equal(c.openAmount, 0);
    assert.equal(c.toJSON().deliveredAmount, 120_000);
  });

  it('tutar teslim alınanın altına indirilemez', () => {
    const c = commitment().recordDelivery(120_000, NOW);
    assert.throws(() => c.update({ amount: 100_000 }, NOW), ConstructionValidationError);
  });
});

// ===== SENKRON ==============================================================

class FakeCommitmentRepo implements CommitmentRepository {
  rows = new Map<string, Commitment>();
  private seq = 100;

  private key(source: string, refNo: string, refLineNo: number): string {
    return `${source}:${refNo}:${String(refLineNo)}`;
  }

  insert(input: NewCommitmentInput): Promise<Commitment> {
    const c = Commitment.create({
      id: this.seq++,
      companyId: input.companyId,
      projectId: input.projectId,
      contractId: input.contractId,
      boqLineId: input.boqLineId,
      locationId: input.locationId,
      source: input.source,
      refNo: input.refNo,
      refLineNo: input.refLineNo,
      vendorId: input.vendorId,
      description: input.description,
      quantity: input.quantity,
      unit: input.unit,
      unitPrice: input.unitPrice,
      amount: input.amount,
      deliveredAmount: input.deliveredAmount,
      currency: input.currency,
      status: 'open',
      committedAt: input.committedAt,
      closedAt: null,
      note: input.note,
      createdBy: input.createdBy,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.rows.set(this.key(input.source, input.refNo, input.refLineNo), c);
    return Promise.resolve(c);
  }

  findById(id: number): Promise<Commitment | null> {
    for (const c of this.rows.values()) if (c.id === id) return Promise.resolve(c);
    return Promise.resolve(null);
  }

  findByRef(
    _companyId: number,
    source: CommitmentSource,
    refNo: string,
    refLineNo: number,
  ): Promise<Commitment | null> {
    return Promise.resolve(this.rows.get(this.key(source, refNo, refLineNo)) ?? null);
  }

  list(_companyId: number, _filter?: CommitmentFilter): Promise<ReadonlyArray<Commitment>> {
    return Promise.resolve([...this.rows.values()]);
  }

  update(commitment: Commitment): Promise<Commitment> {
    const j = commitment.toJSON();
    this.rows.set(this.key(j.source, j.refNo, j.refLineNo), commitment);
    return Promise.resolve(commitment);
  }

  projectSummary(): Promise<ProjectCommitmentSummaryRow | null> {
    return Promise.resolve(null);
  }
  contractEvm(): Promise<ContractEvmRow | null> {
    return Promise.resolve(null);
  }
  projectEvm(): Promise<ReadonlyArray<ContractEvmRow>> {
    return Promise.resolve([]);
  }
}

const fakeProjects = {
  findById: (id: number) =>
    Promise.resolve(id === 5 ? ({ id: 5 } as unknown as ReturnType<never>) : null),
} as unknown as ProjectRepository;

describe('SyncCommitmentsUseCase', () => {
  let repo: FakeCommitmentRepo;
  let sync: SyncCommitmentsUseCase;

  beforeEach(() => {
    repo = new FakeCommitmentRepo();
    sync = new SyncCommitmentsUseCase(repo, fakeProjects, new FixedClock(NOW));
  });

  const line = (over: Record<string, unknown> = {}): never =>
    ({
      refNo: 'PO-1',
      refLineNo: 1,
      projectId: 5,
      description: 'Demir Ø16',
      amount: 50_000,
      ...over,
    }) as never;

  it('İDEMPOTENT: aynı yük iki kez → 1 insert + 1 update, tek kayıt', async () => {
    const r1 = await sync.execute({ companyId: 1, source: 'purchase_order', lines: [line()] });
    const r2 = await sync.execute({ companyId: 1, source: 'purchase_order', lines: [line()] });
    assert.equal(r1.inserted, 1);
    assert.equal(r2.inserted, 0);
    assert.equal(r2.updated, 1);
    assert.equal(repo.rows.size, 1);
  });

  it('kaynak değeri geri yazar (kaynak-of-truth monolit)', async () => {
    await sync.execute({ companyId: 1, source: 'purchase_order', lines: [line()] });
    await sync.execute({
      companyId: 1,
      source: 'purchase_order',
      lines: [line({ amount: 60_000, deliveredAmount: 20_000 })],
    });
    const c = await repo.findByRef(1, 'purchase_order', 'PO-1', 1);
    assert.equal(c!.amount, 60_000);
    assert.equal(c!.status, 'partial');
    assert.equal(c!.openAmount, 40_000);
  });

  it('kaynakta iptal → burada da iptal; ikinci iptal sayaç artırmaz', async () => {
    await sync.execute({ companyId: 1, source: 'purchase_order', lines: [line()] });
    const r1 = await sync.execute({
      companyId: 1,
      source: 'purchase_order',
      lines: [line({ cancelled: true })],
    });
    const r2 = await sync.execute({
      companyId: 1,
      source: 'purchase_order',
      lines: [line({ cancelled: true })],
    });
    assert.equal(r1.cancelled, 1);
    assert.equal(r2.cancelled, 0);
  });

  it('KISMİ BAŞARI: bozuk satır errors[] içinde döner, diğerleri işlenir', async () => {
    const r = await sync.execute({
      companyId: 1,
      source: 'purchase_order',
      lines: [
        line(),
        line({ refNo: 'PO-2', projectId: 999 }), // olmayan proje
        line({ refNo: 'PO-3' }),
      ],
    });
    assert.equal(r.inserted, 2);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0]!.refNo, 'PO-2');
  });

  it('tam teslimatlı satır insert + kapanış olarak gelir', async () => {
    await sync.execute({
      companyId: 1,
      source: 'purchase_order',
      lines: [line({ deliveredAmount: 50_000 })],
    });
    const c = await repo.findByRef(1, 'purchase_order', 'PO-1', 1);
    assert.equal(c!.status, 'closed');
    assert.equal(c!.openAmount, 0);
  });
});
