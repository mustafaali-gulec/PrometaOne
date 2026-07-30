/**
 * Konut satış use-case'leri (FAZ 10).
 *
 * KÖPRÜ: müşteri ilişkisi Satış CRM'de; SyncUnitSalesUseCase CRM'den gelen
 * fırsatları (source='crm' + refNo) idempotent upsert eder — aynı yük iki kez
 * gelse sonuç değişmez, satır hatası diğerlerini düşürmez (errors[]).
 *
 * PARASAL DÜRÜSTLÜK:
 * - Liste fiyatı satış ANINDA defterden donar; iskonto tarihi kayıttır.
 * - İade tahsil edileni aşamaz; tahsilat geleceğe yazılamaz (tahsilat plan
 *   değil GERÇEKLEŞEN paradır — vadeli plan CRM/finans tarafının işi).
 * - İptal edilmiş satışa yeni TAHSİLAT yazılamaz ama İADE yazılır — iade tam
 *   da iptalden sonra olur.
 */
import type {
  ChangeRequestStatus,
  ChangeRequestUpdate,
  UnitChangeRequest,
} from '../../domain/entities/UnitChangeRequest.js';
import type {
  SaleTransitionInput,
  UnitPaymentKind,
  UnitPaymentMethod,
  UnitSale,
  UnitSaleStatus,
  UnitSaleUpdate,
} from '../../domain/entities/UnitSale.js';
import {
  ChangeRequestNotFoundError,
  ConstructionValidationError,
  LocationNotFoundError,
  NotAUnitLocationError,
  ProjectNotFoundError,
  RefundExceedsCollectedError,
  UnitAlreadySoldError,
  UnitPaymentNotFoundError,
  UnitSaleNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { Clock } from '../ports/Clock.js';
import type { LocationRepository } from '../ports/LocationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type {
  ProjectSalesSummaryRow,
  UnitInventoryRow,
  UnitPaymentRow,
  UnitSaleFilter,
  UnitSaleRepository,
} from '../ports/UnitSaleRepository.js';

// ===== DTO ==================================================================

export interface UnitSaleDto {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number;
  status: string;
  source: string;
  refNo: string | null;
  buyerName: string | null;
  vendorId: number | null;
  listPrice: number;
  salePrice: number;
  /** Satış anındaki liste − satış; liste donuğu 0 ise null (iskonto bilinmiyor). */
  discount: number | null;
  currency: string;
  reservedAt: string | null;
  soldAt: string | null;
  cancelledAt: string | null;
  cancelNote: string | null;
  note: string | null;
  allowedTransitions: ReadonlyArray<string>;
  createdAt: string;
  updatedAt: string;
}

export function toUnitSaleDto(s: UnitSale): UnitSaleDto {
  const j = s.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    locationId: j.locationId,
    status: j.status,
    source: j.source,
    refNo: j.refNo,
    buyerName: j.buyerName,
    vendorId: j.vendorId,
    listPrice: j.listPrice,
    salePrice: j.salePrice,
    discount: j.listPrice > 0 ? j.listPrice - j.salePrice : null,
    currency: j.currency,
    reservedAt: j.reservedAt,
    soldAt: j.soldAt,
    cancelledAt: j.cancelledAt === null ? null : j.cancelledAt.toISOString(),
    cancelNote: j.cancelNote,
    note: j.note,
    allowedTransitions: s.allowedTransitions,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export interface UnitPaymentDto {
  id: number;
  saleId: number;
  kind: string;
  paidAt: string;
  amount: number;
  method: string | null;
  note: string | null;
  createdAt: string;
}

function toPaymentDto(p: UnitPaymentRow): UnitPaymentDto {
  return {
    id: p.id,
    saleId: p.saleId,
    kind: p.kind,
    paidAt: p.paidAt,
    amount: p.amount,
    method: p.method,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
  };
}

export interface ChangeRequestDto {
  id: number;
  saleId: number;
  code: string;
  title: string;
  description: string | null;
  cost: number;
  status: string;
  requestedAt: string;
  decidedAt: string | null;
  doneAt: string | null;
  note: string | null;
  allowedTransitions: ReadonlyArray<string>;
  createdAt: string;
  updatedAt: string;
}

export function toChangeRequestDto(cr: UnitChangeRequest): ChangeRequestDto {
  const j = cr.toJSON();
  return {
    id: j.id,
    saleId: j.saleId,
    code: j.code,
    title: j.title,
    description: j.description,
    cost: j.cost,
    status: j.status,
    requestedAt: j.requestedAt,
    decidedAt: j.decidedAt,
    doneAt: j.doneAt,
    note: j.note,
    allowedTransitions: cr.allowedTransitions,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

// ===== ORTAK DOĞRULAMA ======================================================

/** Satış yalnız projenin AKTİF kind='unit' lokasyonuna bağlanır. */
async function assertUnitLocation(
  locations: LocationRepository,
  locationId: number,
  projectId: number,
  companyId: number,
): Promise<void> {
  const loc = await locations.findById(locationId, companyId);
  if (loc === null || !loc.active) throw new LocationNotFoundError(locationId);
  if (loc.kind !== 'unit') throw new NotAUnitLocationError(locationId, loc.kind);
  if (loc.projectId !== projectId) {
    throw new ConstructionValidationError(`lokasyon ${String(locationId)} bu projeye ait değil`);
  }
}

// ===== LİSTE FİYATI DEFTERİ ================================================

export class SetUnitListPriceUseCase {
  constructor(
    private readonly sales: UnitSaleRepository,
    private readonly locations: LocationRepository,
  ) {}

  async execute(input: {
    companyId: number;
    locationId: number;
    listPrice: number;
    note?: string | null | undefined;
    updatedBy?: number | null | undefined;
  }): Promise<{ locationId: number; listPrice: number }> {
    const loc = await this.locations.findById(input.locationId, input.companyId);
    if (loc === null) throw new LocationNotFoundError(input.locationId);
    if (loc.kind !== 'unit') throw new NotAUnitLocationError(input.locationId, loc.kind);
    if (input.listPrice < 0) {
      throw new ConstructionValidationError('liste fiyatı negatif olamaz');
    }
    return this.sales.upsertListPrice({
      companyId: input.companyId,
      projectId: loc.projectId,
      locationId: input.locationId,
      listPrice: input.listPrice,
      note: input.note?.trim() || null,
      updatedBy: input.updatedBy ?? null,
    });
  }
}

// ===== SATIŞ ================================================================

export interface CreateUnitSaleInput {
  companyId: number;
  projectId: number;
  locationId: number;
  /** cancelled ile satış AÇILMAZ — sadece aktif durumlar. */
  status: Exclude<UnitSaleStatus, 'cancelled'>;
  buyerName?: string | null | undefined;
  vendorId?: number | null | undefined;
  /** Verilmezse defterdeki liste fiyatı donar (defterde de yoksa 0). */
  listPrice?: number | undefined;
  salePrice: number;
  currency?: CurrencyCode | undefined;
  reservedAt?: string | null | undefined;
  soldAt?: string | null | undefined;
  note?: string | null | undefined;
  createdBy?: number | null | undefined;
}

export class CreateUnitSaleUseCase {
  constructor(
    private readonly sales: UnitSaleRepository,
    private readonly projects: ProjectRepository,
    private readonly locations: LocationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateUnitSaleInput): Promise<UnitSaleDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    await assertUnitLocation(this.locations, input.locationId, input.projectId, input.companyId);

    // Ön kontrol: dairede aktif satış varsa anlamlı 409. Yarışta son koruma
    // kısmi UNIQUE indekstir (23505 → 409).
    const existing = await this.sales.findActiveByLocation(input.locationId, input.companyId);
    if (existing !== null) throw new UnitAlreadySoldError(input.locationId);

    const today = this.clock.now().toISOString().slice(0, 10);
    // Liste fiyatı satış anında DONAR: sonradan defter değişse tarihi iskonto oynamaz.
    const bookPrice =
      input.listPrice ?? (await this.sales.getListPrice(input.locationId, input.companyId)) ?? 0;

    const created = await this.sales.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      locationId: input.locationId,
      status: input.status,
      source: 'manual',
      refNo: null,
      buyerName: input.buyerName?.trim() || null,
      vendorId: input.vendorId ?? null,
      listPrice: bookPrice,
      salePrice: input.salePrice,
      currency: input.currency ?? 'TRY',
      reservedAt: input.reservedAt ?? (input.status === 'reserved' ? today : null),
      soldAt: input.soldAt ?? (input.status === 'sold' ? today : null),
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
    });
    return toUnitSaleDto(created);
  }
}

export class UpdateUnitSaleUseCase {
  constructor(
    private readonly sales: UnitSaleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: { saleId: number; companyId: number } & UnitSaleUpdate,
  ): Promise<UnitSaleDto> {
    const sale = await this.sales.findById(input.saleId, input.companyId);
    if (!sale) throw new UnitSaleNotFoundError(input.saleId);
    const { saleId: _i, companyId: _c, ...patch } = input;
    const updated = sale.update(
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      this.clock.now(),
    );
    return toUnitSaleDto(await this.sales.update(updated));
  }
}

export class ChangeUnitSaleStatusUseCase {
  constructor(
    private readonly sales: UnitSaleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: { saleId: number; companyId: number } & SaleTransitionInput,
  ): Promise<UnitSaleDto> {
    const sale = await this.sales.findById(input.saleId, input.companyId);
    if (!sale) throw new UnitSaleNotFoundError(input.saleId);
    const next = sale.transition(
      { to: input.to, note: input.note, soldAt: input.soldAt, vendorId: input.vendorId },
      this.clock.now(),
    );
    return toUnitSaleDto(await this.sales.update(next));
  }
}

export class ListUnitSalesUseCase {
  constructor(private readonly sales: UnitSaleRepository) {}

  async execute(input: UnitSaleFilter & { companyId: number }): Promise<UnitSaleDto[]> {
    const { companyId, ...filter } = input;
    const rows = await this.sales.list(companyId, filter);
    return rows.map(toUnitSaleDto);
  }
}

export interface UnitSaleDetailDto {
  sale: UnitSaleDto;
  /** Net tahsilat (Σtahsilat − Σiade) ve kalan — satırlarla birlikte döner. */
  collected: number;
  remaining: number;
  payments: UnitPaymentDto[];
  changeRequests: ChangeRequestDto[];
}

export class GetUnitSaleUseCase {
  constructor(private readonly sales: UnitSaleRepository) {}

  async execute(input: { saleId: number; companyId: number }): Promise<UnitSaleDetailDto> {
    const sale = await this.sales.findById(input.saleId, input.companyId);
    if (!sale) throw new UnitSaleNotFoundError(input.saleId);
    const [payments, crs, collected] = await Promise.all([
      this.sales.listPayments(input.saleId, input.companyId),
      this.sales.listChangeRequests(input.saleId, input.companyId),
      this.sales.collectedFor(input.saleId),
    ]);
    const approvedCost = crs
      .filter((c) => c.status === 'approved' || c.status === 'done')
      .reduce((sum, c) => sum + c.cost, 0);
    return {
      sale: toUnitSaleDto(sale),
      collected,
      remaining: sale.salePrice + approvedCost - collected,
      payments: payments.map(toPaymentDto),
      changeRequests: crs.map(toChangeRequestDto),
    };
  }
}

// ===== TAHSİLAT =============================================================

export class AddUnitPaymentUseCase {
  constructor(
    private readonly sales: UnitSaleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    saleId: number;
    companyId: number;
    kind?: UnitPaymentKind | undefined;
    paidAt?: string | undefined;
    amount: number;
    method?: UnitPaymentMethod | null | undefined;
    note?: string | null | undefined;
    createdBy?: number | null | undefined;
  }): Promise<UnitPaymentDto> {
    const sale = await this.sales.findById(input.saleId, input.companyId);
    if (!sale) throw new UnitSaleNotFoundError(input.saleId);

    const kind = input.kind ?? 'collection';
    if (input.amount <= 0) {
      throw new ConstructionValidationError(
        'tutar pozitif olmalı; yön tahsilat/iade tipinden gelir',
      );
    }
    // Tahsilat GERÇEKLEŞEN paradır: geleceğe yazılamaz (vadeli plan başka iş).
    const today = this.clock.now().toISOString().slice(0, 10);
    const paidAt = input.paidAt ?? today;
    if (paidAt > today) {
      throw new ConstructionValidationError(
        'geleceğe tahsilat yazılamaz — tahsilat plan değil gerçekleşendir',
      );
    }
    if (kind === 'collection' && !sale.active) {
      // İptal edilmiş satışa yeni para GİRMEZ; iade ise tam iptalden sonra olur.
      throw new ConstructionValidationError(
        'iptal edilmiş satışa tahsilat yazılamaz (iade yazılabilir)',
      );
    }
    if (kind === 'refund') {
      const collected = await this.sales.collectedFor(input.saleId);
      if (input.amount > collected) {
        throw new RefundExceedsCollectedError(collected, input.amount);
      }
    }
    const row = await this.sales.insertPayment({
      companyId: input.companyId,
      saleId: input.saleId,
      kind,
      paidAt,
      amount: input.amount,
      method: input.method ?? null,
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
    });
    return toPaymentDto(row);
  }
}

export class DeleteUnitPaymentUseCase {
  constructor(private readonly sales: UnitSaleRepository) {}

  async execute(input: { paymentId: number; companyId: number }): Promise<{ deleted: boolean }> {
    const ok = await this.sales.deletePayment(input.paymentId, input.companyId);
    if (!ok) throw new UnitPaymentNotFoundError(input.paymentId);
    return { deleted: true };
  }
}

// ===== DEĞİŞİKLİK İSTEĞİ ====================================================

export class CreateChangeRequestUseCase {
  constructor(
    private readonly sales: UnitSaleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    saleId: number;
    companyId: number;
    title: string;
    description?: string | null | undefined;
    cost?: number | undefined;
    requestedAt?: string | undefined;
    note?: string | null | undefined;
    createdBy?: number | null | undefined;
  }): Promise<ChangeRequestDto> {
    const sale = await this.sales.findById(input.saleId, input.companyId);
    if (!sale) throw new UnitSaleNotFoundError(input.saleId);
    if (!sale.active) {
      throw new ConstructionValidationError('iptal edilmiş satışa değişiklik isteği açılamaz');
    }
    const created = await this.sales.insertChangeRequest({
      companyId: input.companyId,
      saleId: input.saleId,
      code: await this.sales.nextChangeRequestCode(input.companyId),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      cost: input.cost ?? 0,
      requestedAt: input.requestedAt ?? this.clock.now().toISOString().slice(0, 10),
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
    });
    return toChangeRequestDto(created);
  }
}

export class UpdateChangeRequestUseCase {
  constructor(
    private readonly sales: UnitSaleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: { changeRequestId: number; companyId: number } & ChangeRequestUpdate,
  ): Promise<ChangeRequestDto> {
    const cr = await this.sales.findChangeRequestById(input.changeRequestId, input.companyId);
    if (!cr) throw new ChangeRequestNotFoundError(input.changeRequestId);
    const { changeRequestId: _i, companyId: _c, ...patch } = input;
    const updated = cr.update(
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      this.clock.now(),
    );
    return toChangeRequestDto(await this.sales.updateChangeRequest(updated));
  }
}

export class DecideChangeRequestUseCase {
  constructor(
    private readonly sales: UnitSaleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    changeRequestId: number;
    companyId: number;
    to: ChangeRequestStatus;
    note?: string | null | undefined;
    decidedBy?: number | null | undefined;
  }): Promise<ChangeRequestDto> {
    const cr = await this.sales.findChangeRequestById(input.changeRequestId, input.companyId);
    if (!cr) throw new ChangeRequestNotFoundError(input.changeRequestId);
    const next = cr.transition(
      input.to,
      { note: input.note, decidedBy: input.decidedBy },
      this.clock.now(),
    );
    return toChangeRequestDto(await this.sales.updateChangeRequest(next));
  }
}

// ===== ENVANTER =============================================================

export class GetUnitInventoryUseCase {
  constructor(
    private readonly sales: UnitSaleRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: { companyId: number; projectId: number }): Promise<{
    units: ReadonlyArray<UnitInventoryRow>;
    summary: ProjectSalesSummaryRow | null;
  }> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const [units, summary] = await Promise.all([
      this.sales.inventory(input.companyId, input.projectId),
      this.sales.projectSummary(input.companyId, input.projectId),
    ]);
    return { units, summary };
  }
}

// ===== SENKRON (köprünün construction tarafı) ===============================

export interface SyncUnitSaleLine {
  refNo: string;
  projectId: number;
  locationId: number;
  status: Exclude<UnitSaleStatus, 'cancelled'>;
  buyerName?: string | null | undefined;
  vendorId?: number | null | undefined;
  listPrice?: number | undefined;
  salePrice: number;
  currency?: CurrencyCode | undefined;
  reservedAt?: string | null | undefined;
  soldAt?: string | null | undefined;
  /** true → kaynakta iptal; burada da gerekçeyle iptal edilir. */
  cancelled?: boolean | undefined;
  cancelNote?: string | undefined;
}

export interface SyncUnitSalesResult {
  inserted: number;
  updated: number;
  cancelled: number;
  /** İşlenemeyen satırlar — senkron KISMEN başarılı olabilir, sessiz atlanmaz. */
  errors: { refNo: string; message: string }[];
}

export class SyncUnitSalesUseCase {
  constructor(
    private readonly sales: UnitSaleRepository,
    private readonly projects: ProjectRepository,
    private readonly locations: LocationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    lines: ReadonlyArray<SyncUnitSaleLine>;
    createdBy?: number | null | undefined;
  }): Promise<SyncUnitSalesResult> {
    if (input.lines.length === 0) {
      throw new ConstructionValidationError('senkron en az bir satır gerektirir');
    }
    const result: SyncUnitSalesResult = { inserted: 0, updated: 0, cancelled: 0, errors: [] };
    const now = this.clock.now();
    const today = now.toISOString().slice(0, 10);

    // Satır satır: bir satırın hatası diğerlerini düşürmez (Faz 7 kalıbı).
    for (const line of input.lines) {
      try {
        const existing = await this.sales.findByRef(input.companyId, 'crm', line.refNo);

        if (existing === null) {
          if (line.cancelled === true) {
            // Hiç görmediğimiz ve kaynakta zaten iptal olan fırsat için kayıt
            // AÇILMAZ — daireyi bir anlığına satılmış gösterip geri almak olur.
            continue;
          }
          const project = await this.projects.findById(line.projectId, input.companyId);
          if (!project) throw new ProjectNotFoundError(line.projectId);
          await assertUnitLocation(
            this.locations,
            line.locationId,
            line.projectId,
            input.companyId,
          );
          const taken = await this.sales.findActiveByLocation(line.locationId, input.companyId);
          if (taken !== null) throw new UnitAlreadySoldError(line.locationId);

          const bookPrice =
            line.listPrice ??
            (await this.sales.getListPrice(line.locationId, input.companyId)) ??
            0;
          await this.sales.insert({
            companyId: input.companyId,
            projectId: line.projectId,
            locationId: line.locationId,
            status: line.status,
            source: 'crm',
            refNo: line.refNo,
            buyerName: line.buyerName?.trim() || null,
            vendorId: line.vendorId ?? null,
            listPrice: bookPrice,
            salePrice: line.salePrice,
            currency: line.currency ?? 'TRY',
            reservedAt: line.reservedAt ?? (line.status === 'reserved' ? today : null),
            soldAt: line.soldAt ?? (line.status === 'sold' ? today : null),
            note: null,
            createdBy: input.createdBy ?? null,
          });
          result.inserted += 1;
          continue;
        }

        if (line.cancelled === true) {
          if (existing.active) {
            await this.sales.update(
              existing.transition(
                { to: 'cancelled', note: line.cancelNote ?? 'CRM kaynağında iptal edildi' },
                now,
              ),
            );
            result.cancelled += 1;
          }
          continue;
        }

        // Kaynak değerleri geri yazılır (kaynak-of-truth CRM). Durum geçişi
        // entity kurallarından geçer: CRM 'sold' kaydı 'reserved'a çekmeye
        // kalkarsa satır hatası döner — sessiz gerileme yok.
        let next = existing;
        if (existing.active) {
          next = existing.update(
            {
              ...(line.buyerName !== undefined && line.buyerName !== null
                ? { buyerName: line.buyerName }
                : {}),
              ...(line.vendorId !== undefined ? { vendorId: line.vendorId } : {}),
              salePrice: line.salePrice,
              ...(line.reservedAt !== undefined ? { reservedAt: line.reservedAt } : {}),
              ...(line.soldAt !== undefined ? { soldAt: line.soldAt } : {}),
            },
            now,
          );
          if (line.status !== existing.status) {
            next = next.transition(
              { to: line.status, ...(line.soldAt ? { soldAt: line.soldAt } : {}) },
              now,
            );
          }
        }
        await this.sales.update(next);
        result.updated += 1;
      } catch (err) {
        result.errors.push({
          refNo: line.refNo,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return result;
  }
}
