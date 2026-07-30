/**
 * FAZ 10 — Konut satış testleri.
 *
 * Ağırlık: UnitSale durum makinesi (tek yönlü akış, iptal gerekçesi, taraf
 * kuralları), tahsilat kuralları (geleceğe yazılamaz, iade tahsilatı aşamaz,
 * iptalde yalnız iade), değişiklik isteği bedel donması ve SyncUnitSales
 * idempotensi. SQL görünümleri (envanter/özet) smoke'ta canlı sınanır.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { LocationRepository } from '../../application/ports/LocationRepository.js';
import type { ProjectRepository } from '../../application/ports/ProjectRepository.js';
import type {
  NewChangeRequestInput,
  NewUnitPaymentInput,
  NewUnitSaleInput,
  UnitPaymentRow,
  UnitSaleRepository,
} from '../../application/ports/UnitSaleRepository.js';
import {
  AddUnitPaymentUseCase,
  CreateUnitSaleUseCase,
  GetUnitSaleUseCase,
  SyncUnitSalesUseCase,
} from '../../application/useCases/UnitSaleUseCases.js';
import {
  UnitChangeRequest,
  type UnitChangeRequestProps,
} from '../../domain/entities/UnitChangeRequest.js';
import { UnitSale, type UnitSaleProps } from '../../domain/entities/UnitSale.js';
import {
  ChangeRequestNotEditableError,
  ConstructionValidationError,
  InvalidStatusTransitionError,
  NotAUnitLocationError,
  RefundExceedsCollectedError,
  UnitAlreadySoldError,
} from '../../domain/errors/ConstructionErrors.js';
import { FixedClock } from '../fakes.js';

const NOW = new Date('2026-07-30T10:00:00.000Z');

function sale(over: Partial<UnitSaleProps> = {}): UnitSale {
  return UnitSale.create({
    id: 1,
    companyId: 1,
    projectId: 5,
    locationId: 42,
    status: 'reserved',
    source: 'manual',
    refNo: null,
    buyerName: 'Ayşe Yılmaz',
    vendorId: null,
    listPrice: 5_000_000,
    salePrice: 4_600_000,
    currency: 'TRY',
    reservedAt: '2026-07-30',
    soldAt: null,
    cancelledAt: null,
    cancelNote: null,
    note: null,
    createdBy: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  });
}

describe('UnitSale — durum makinesi', () => {
  it('rezervasyon satışa döner; satış tarihi geçişte set edilir', () => {
    const s = sale().transition({ to: 'sold' }, NOW);
    assert.equal(s.status, 'sold');
    assert.equal(s.toJSON().soldAt, '2026-07-30');
  });

  it('SATIŞ REZERVASYONA GERİLEMEZ — gerileme iptal + yeni kayıttır', () => {
    const sold = sale().transition({ to: 'sold' }, NOW);
    assert.throws(() => sold.transition({ to: 'reserved' }, NOW), InvalidStatusTransitionError);
  });

  it('iptal GEREKÇESİZ olamaz; gerekçe cancel_note alanına düşer', () => {
    assert.throws(() => sale().transition({ to: 'cancelled' }, NOW), ConstructionValidationError);
    const c = sale().transition({ to: 'cancelled', note: 'müşteri vazgeçti' }, NOW);
    assert.equal(c.status, 'cancelled');
    assert.equal(c.toJSON().cancelNote, 'müşteri vazgeçti');
  });

  it('iptal terminaldir; para oynatılamaz, yalnız not düzeltilir', () => {
    const c = sale().transition({ to: 'cancelled', note: 'x' }, NOW);
    assert.deepEqual(c.allowedTransitions, []);
    assert.throws(() => c.update({ salePrice: 1 }, NOW), InvalidStatusTransitionError);
    assert.equal(c.update({ note: 'düzeltme' }, NOW).toJSON().note, 'düzeltme');
  });

  it('İŞ KARŞILIĞI taşeronsuz olmaz — daire kime verildi?', () => {
    assert.throws(() => sale({ status: 'barter', buyerName: null }), ConstructionValidationError);
    assert.throws(() => sale().transition({ to: 'barter' }, NOW), ConstructionValidationError);
    const b = sale().transition({ to: 'barter', vendorId: 77 }, NOW);
    assert.equal(b.status, 'barter');
  });

  it('rezervasyon/satış alıcı adı ister', () => {
    assert.throws(() => sale({ buyerName: null }), ConstructionValidationError);
  });
});

describe('UnitChangeRequest — bedel donması', () => {
  function cr(over: Partial<UnitChangeRequestProps> = {}): UnitChangeRequest {
    return UnitChangeRequest.create({
      id: 1,
      companyId: 1,
      saleId: 1,
      code: 'DGS-0001',
      title: 'Mutfak dolabı değişikliği',
      description: null,
      cost: 50_000,
      status: 'open',
      requestedAt: '2026-07-30',
      decidedAt: null,
      decidedBy: null,
      doneAt: null,
      note: null,
      createdBy: 1,
      createdAt: NOW,
      updatedAt: NOW,
      ...over,
    });
  }

  it('open → approved karar izini yazar; approved → done biter', () => {
    const a = cr().transition('approved', { decidedBy: 9 }, NOW);
    assert.equal(a.toJSON().decidedAt, '2026-07-30');
    assert.equal(a.toJSON().decidedBy, 9);
    const d = a.transition('done', {}, NOW);
    assert.equal(d.toJSON().doneAt, '2026-07-30');
    assert.deepEqual(d.allowedTransitions, []);
  });

  it('ONAYLANAN BEDEL DONAR — müşteriyle mutabık sayı sessizce değişmez', () => {
    const a = cr().transition('approved', {}, NOW);
    assert.throws(() => a.update({ cost: 60_000 }, NOW), ChangeRequestNotEditableError);
    assert.equal(a.update({ note: 'ek not' }, NOW).toJSON().note, 'ek not');
    assert.equal(cr().update({ cost: 60_000 }, NOW).cost, 60_000);
  });

  it('red gerekçe ister; approved → rejected geri dönüşü de', () => {
    assert.throws(() => cr().transition('rejected', {}, NOW), ConstructionValidationError);
    const a = cr().transition('approved', {}, NOW);
    const r = a.transition('rejected', { note: 'müşteri vazgeçti' }, NOW);
    assert.equal(r.status, 'rejected');
    assert.deepEqual(r.allowedTransitions, []);
  });

  it('open → done atlanamaz (önce onay)', () => {
    assert.throws(() => cr().transition('done', {}, NOW), InvalidStatusTransitionError);
  });
});

// ===== FAKES ================================================================

class FakeUnitSaleRepo implements UnitSaleRepository {
  sales = new Map<number, UnitSale>();
  payments: UnitPaymentRow[] = [];
  crs = new Map<number, UnitChangeRequest>();
  listPrices = new Map<number, number>();
  private seq = 100;

  insert(input: NewUnitSaleInput): Promise<UnitSale> {
    const s = UnitSale.create({
      id: this.seq++,
      companyId: input.companyId,
      projectId: input.projectId,
      locationId: input.locationId,
      status: input.status,
      source: input.source,
      refNo: input.refNo,
      buyerName: input.buyerName,
      vendorId: input.vendorId,
      listPrice: input.listPrice,
      salePrice: input.salePrice,
      currency: input.currency,
      reservedAt: input.reservedAt,
      soldAt: input.soldAt,
      cancelledAt: null,
      cancelNote: null,
      note: input.note,
      createdBy: input.createdBy,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.sales.set(s.id, s);
    return Promise.resolve(s);
  }
  findById(id: number): Promise<UnitSale | null> {
    return Promise.resolve(this.sales.get(id) ?? null);
  }
  findByRef(_c: number, source: string, refNo: string): Promise<UnitSale | null> {
    for (const s of this.sales.values()) {
      const j = s.toJSON();
      if (j.source === source && j.refNo === refNo) return Promise.resolve(s);
    }
    return Promise.resolve(null);
  }
  findActiveByLocation(locationId: number): Promise<UnitSale | null> {
    for (const s of this.sales.values()) {
      if (s.locationId === locationId && s.active) return Promise.resolve(s);
    }
    return Promise.resolve(null);
  }
  list(): Promise<ReadonlyArray<UnitSale>> {
    return Promise.resolve([...this.sales.values()]);
  }
  update(sale: UnitSale): Promise<UnitSale> {
    this.sales.set(sale.id, sale);
    return Promise.resolve(sale);
  }
  inventory(): Promise<never[]> {
    return Promise.resolve([]);
  }
  projectSummary(): Promise<null> {
    return Promise.resolve(null);
  }
  upsertListPrice(input: {
    locationId: number;
    listPrice: number;
  }): Promise<{ locationId: number; listPrice: number }> {
    this.listPrices.set(input.locationId, input.listPrice);
    return Promise.resolve({ locationId: input.locationId, listPrice: input.listPrice });
  }
  getListPrice(locationId: number): Promise<number | null> {
    return Promise.resolve(this.listPrices.get(locationId) ?? null);
  }
  insertPayment(input: NewUnitPaymentInput): Promise<UnitPaymentRow> {
    const row: UnitPaymentRow = {
      id: this.seq++,
      saleId: input.saleId,
      kind: input.kind,
      paidAt: input.paidAt,
      amount: input.amount,
      method: input.method,
      note: input.note,
      createdBy: input.createdBy,
      createdAt: NOW,
    };
    this.payments.push(row);
    return Promise.resolve(row);
  }
  deletePayment(id: number): Promise<boolean> {
    const before = this.payments.length;
    this.payments = this.payments.filter((p) => p.id !== id);
    return Promise.resolve(this.payments.length < before);
  }
  listPayments(saleId: number): Promise<ReadonlyArray<UnitPaymentRow>> {
    return Promise.resolve(this.payments.filter((p) => p.saleId === saleId));
  }
  collectedFor(saleId: number): Promise<number> {
    const sum = this.payments
      .filter((p) => p.saleId === saleId)
      .reduce((acc, p) => acc + (p.kind === 'collection' ? p.amount : -p.amount), 0);
    return Promise.resolve(sum);
  }
  insertChangeRequest(input: NewChangeRequestInput): Promise<UnitChangeRequest> {
    const cr = UnitChangeRequest.create({
      id: this.seq++,
      companyId: input.companyId,
      saleId: input.saleId,
      code: input.code,
      title: input.title,
      description: input.description,
      cost: input.cost,
      status: 'open',
      requestedAt: input.requestedAt,
      decidedAt: null,
      decidedBy: null,
      doneAt: null,
      note: input.note,
      createdBy: input.createdBy,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.crs.set(cr.id, cr);
    return Promise.resolve(cr);
  }
  findChangeRequestById(id: number): Promise<UnitChangeRequest | null> {
    return Promise.resolve(this.crs.get(id) ?? null);
  }
  listChangeRequests(saleId: number): Promise<ReadonlyArray<UnitChangeRequest>> {
    return Promise.resolve([...this.crs.values()].filter((c) => c.toJSON().saleId === saleId));
  }
  updateChangeRequest(cr: UnitChangeRequest): Promise<UnitChangeRequest> {
    this.crs.set(cr.id, cr);
    return Promise.resolve(cr);
  }
  nextChangeRequestCode(): Promise<string> {
    return Promise.resolve(`DGS-${String(this.crs.size + 1).padStart(4, '0')}`);
  }
}

const fakeProjects = {
  findById: (id: number) => Promise.resolve(id === 5 ? ({ id: 5 } as never) : null),
} as unknown as ProjectRepository;

/** 42/43 = aktif daire; 60 = blok (unit değil); diğerleri yok. */
const fakeLocations = {
  findById: (id: number) => {
    if (id === 42 || id === 43) {
      return Promise.resolve({ id, kind: 'unit', active: true, projectId: 5 } as never);
    }
    if (id === 60) {
      return Promise.resolve({ id, kind: 'block', active: true, projectId: 5 } as never);
    }
    return Promise.resolve(null);
  },
} as unknown as LocationRepository;

describe('CreateUnitSaleUseCase', () => {
  let repo: FakeUnitSaleRepo;
  let create: CreateUnitSaleUseCase;

  beforeEach(() => {
    repo = new FakeUnitSaleRepo();
    create = new CreateUnitSaleUseCase(repo, fakeProjects, fakeLocations, new FixedClock(NOW));
  });

  it('liste fiyatı verilmezse DEFTERDEN DONAR', async () => {
    repo.listPrices.set(42, 5_500_000);
    const dto = await create.execute({
      companyId: 1,
      projectId: 5,
      locationId: 42,
      status: 'sold',
      buyerName: 'Ali Kaya',
      salePrice: 5_000_000,
    });
    assert.equal(dto.listPrice, 5_500_000);
    assert.equal(dto.discount, 500_000);
    assert.equal(dto.soldAt, '2026-07-30');
  });

  it('defterde de fiyat yoksa liste 0 → iskonto null (bilinmiyor)', async () => {
    const dto = await create.execute({
      companyId: 1,
      projectId: 5,
      locationId: 42,
      status: 'reserved',
      buyerName: 'Ali Kaya',
      salePrice: 4_000_000,
    });
    assert.equal(dto.discount, null);
  });

  it('BLOK SATILMAZ — satış yalnız bağımsız bölüme', async () => {
    await assert.rejects(
      create.execute({
        companyId: 1,
        projectId: 5,
        locationId: 60,
        status: 'sold',
        buyerName: 'X',
        salePrice: 1,
      }),
      NotAUnitLocationError,
    );
  });

  it('dairede aktif satış varken ikincisi 409 sınıfı hatadır', async () => {
    const input = {
      companyId: 1,
      projectId: 5,
      locationId: 42,
      status: 'reserved' as const,
      buyerName: 'Ali Kaya',
      salePrice: 1_000,
    };
    await create.execute(input);
    await assert.rejects(create.execute(input), UnitAlreadySoldError);
  });
});

describe('AddUnitPaymentUseCase — tahsilat kuralları', () => {
  let repo: FakeUnitSaleRepo;
  let add: AddUnitPaymentUseCase;

  beforeEach(async () => {
    repo = new FakeUnitSaleRepo();
    add = new AddUnitPaymentUseCase(repo, new FixedClock(NOW));
    await repo.insert({
      companyId: 1,
      projectId: 5,
      locationId: 42,
      status: 'sold',
      source: 'manual',
      refNo: null,
      buyerName: 'Ali Kaya',
      vendorId: null,
      listPrice: 0,
      salePrice: 1_000_000,
      currency: 'TRY',
      reservedAt: null,
      soldAt: '2026-07-30',
      note: null,
      createdBy: 1,
    });
  });

  it('GELECEĞE TAHSİLAT YAZILAMAZ — tahsilat plan değil gerçekleşendir', async () => {
    await assert.rejects(
      add.execute({ saleId: 100, companyId: 1, amount: 1000, paidAt: '2026-08-01' }),
      ConstructionValidationError,
    );
  });

  it('iade tahsil edileni aşamaz', async () => {
    await add.execute({ saleId: 100, companyId: 1, amount: 300_000 });
    await assert.rejects(
      add.execute({ saleId: 100, companyId: 1, kind: 'refund', amount: 300_001 }),
      RefundExceedsCollectedError,
    );
    const r = await add.execute({ saleId: 100, companyId: 1, kind: 'refund', amount: 100_000 });
    assert.equal(r.kind, 'refund');
  });

  it('iptal edilmiş satışa tahsilat yazılamaz ama İADE yazılır', async () => {
    await add.execute({ saleId: 100, companyId: 1, amount: 200_000 });
    const s = repo.sales.get(100)!;
    repo.sales.set(100, s.transition({ to: 'cancelled', note: 'vazgeçti' }, NOW));
    await assert.rejects(
      add.execute({ saleId: 100, companyId: 1, amount: 1000 }),
      ConstructionValidationError,
    );
    const refund = await add.execute({
      saleId: 100,
      companyId: 1,
      kind: 'refund',
      amount: 200_000,
    });
    assert.equal(refund.amount, 200_000);
  });
});

describe('GetUnitSaleUseCase — kalan hesabı', () => {
  it('kalan = satış + ONAYLI değişiklik − net tahsilat (open sayılmaz)', async () => {
    const repo = new FakeUnitSaleRepo();
    const clock = new FixedClock(NOW);
    await repo.insert({
      companyId: 1,
      projectId: 5,
      locationId: 42,
      status: 'sold',
      source: 'manual',
      refNo: null,
      buyerName: 'Ali Kaya',
      vendorId: null,
      listPrice: 0,
      salePrice: 1_000_000,
      currency: 'TRY',
      reservedAt: null,
      soldAt: '2026-07-30',
      note: null,
      createdBy: 1,
    });
    const crInput = {
      companyId: 1,
      saleId: 100,
      description: null,
      requestedAt: '2026-07-30',
      note: null,
      createdBy: 1,
    };
    const approved = await repo.insertChangeRequest({
      ...crInput,
      code: 'DGS-0001',
      title: 'onaylı iş',
      cost: 200_000,
    });
    await repo.updateChangeRequest(approved.transition('approved', {}, NOW));
    await repo.insertChangeRequest({
      ...crInput,
      code: 'DGS-0002',
      title: 'bekleyen iş',
      cost: 999_999,
    });
    const add = new AddUnitPaymentUseCase(repo, clock);
    await add.execute({ saleId: 100, companyId: 1, amount: 500_000 });
    await add.execute({ saleId: 100, companyId: 1, kind: 'refund', amount: 100_000 });

    const detail = await new GetUnitSaleUseCase(repo).execute({ saleId: 100, companyId: 1 });
    assert.equal(detail.collected, 400_000);
    // 1.000.000 + 200.000 (yalnız onaylı) − 400.000
    assert.equal(detail.remaining, 800_000);
  });
});

describe('SyncUnitSalesUseCase', () => {
  let repo: FakeUnitSaleRepo;
  let sync: SyncUnitSalesUseCase;

  beforeEach(() => {
    repo = new FakeUnitSaleRepo();
    sync = new SyncUnitSalesUseCase(repo, fakeProjects, fakeLocations, new FixedClock(NOW));
  });

  const line = (over: Record<string, unknown> = {}): never =>
    ({
      refNo: 'DEAL-1',
      projectId: 5,
      locationId: 42,
      status: 'reserved',
      buyerName: 'Ayşe Yılmaz',
      salePrice: 4_600_000,
      ...over,
    }) as never;

  it('İDEMPOTENT: aynı yük iki kez → 1 insert + 1 update, tek kayıt', async () => {
    const r1 = await sync.execute({ companyId: 1, lines: [line()] });
    const r2 = await sync.execute({ companyId: 1, lines: [line()] });
    assert.equal(r1.inserted, 1);
    assert.equal(r2.inserted, 0);
    assert.equal(r2.updated, 1);
    assert.equal(repo.sales.size, 1);
  });

  it('CRM ilerletir: reserved → sold entity geçişinden geçer', async () => {
    await sync.execute({ companyId: 1, lines: [line()] });
    await sync.execute({
      companyId: 1,
      lines: [line({ status: 'sold', soldAt: '2026-07-30', salePrice: 4_700_000 })],
    });
    const s = await repo.findByRef(1, 'crm', 'DEAL-1');
    assert.equal(s!.status, 'sold');
    assert.equal(s!.salePrice, 4_700_000);
  });

  it('DURUM GERİLEMESİ satır hatasıdır — sold kayıt reserved gelirse sessizce gerilemez', async () => {
    await sync.execute({ companyId: 1, lines: [line({ status: 'sold' })] });
    const r = await sync.execute({ companyId: 1, lines: [line({ status: 'reserved' })] });
    assert.equal(r.errors.length, 1);
    const s = await repo.findByRef(1, 'crm', 'DEAL-1');
    assert.equal(s!.status, 'sold');
  });

  it('hiç görülmemiş + kaynakta iptal → kayıt AÇILMAZ', async () => {
    const r = await sync.execute({ companyId: 1, lines: [line({ cancelled: true })] });
    assert.equal(r.inserted, 0);
    assert.equal(r.cancelled, 0);
    assert.equal(repo.sales.size, 0);
  });

  it('kaynakta iptal → burada gerekçeli iptal; daire yeniden satılabilir', async () => {
    await sync.execute({ companyId: 1, lines: [line()] });
    const r = await sync.execute({ companyId: 1, lines: [line({ cancelled: true })] });
    assert.equal(r.cancelled, 1);
    const s = await repo.findByRef(1, 'crm', 'DEAL-1');
    assert.equal(s!.status, 'cancelled');
    assert.notEqual(s!.toJSON().cancelNote, null);
    // aynı daireye yeni fırsat açılabilir
    const r2 = await sync.execute({ companyId: 1, lines: [line({ refNo: 'DEAL-2' })] });
    assert.equal(r2.inserted, 1);
  });

  it('dolu daireye ikinci fırsat satır hatası; diğer satırlar işlenir (kısmi başarı)', async () => {
    await sync.execute({ companyId: 1, lines: [line()] });
    const r = await sync.execute({
      companyId: 1,
      lines: [line({ refNo: 'DEAL-9' }), line({ refNo: 'DEAL-3', locationId: 43 })],
    });
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0]!.refNo, 'DEAL-9');
    assert.equal(r.inserted, 1);
  });
});
