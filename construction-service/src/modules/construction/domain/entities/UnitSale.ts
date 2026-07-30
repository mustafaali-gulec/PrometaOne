/**
 * UnitSale — bağımsız bölüm satış kaydı (FAZ 10).
 * Tablo: cs_unit_sales (015_unit_sales.sql)
 *
 * KÖPRÜ KARARI: müşteri ilişkisi Satış CRM'de kaynak-of-truth; bu kayıt
 * PROJEKSİYONDUR. source='crm' kayıtları senkron ucundan (company+source+refNo)
 * idempotent upsert ile gelir; elle giriş source='manual'.
 *
 * DURUM MAKİNESİ:
 *   reserved → sold | barter | cancelled
 *   sold     → cancelled
 *   barter   → cancelled
 *   cancelled terminal — daire envantere döner (kısmi UNIQUE boşalır).
 * `sold → reserved` YOK: satışın rezervasyona "gerilemesi" gerçekte iptal +
 * yeni rezervasyondur; ikisini tek kayıtta ezmek tarihçeyi siler.
 *
 * PARA: list_price satış ANINDA defterden donan kopya (defter sonradan değişse
 * tarihi iskonto oynamaz). İptal edilen kaydın parası oynatılmaz (yalnız not) —
 * iade cs_unit_payments'ta ayrı satırdır, satış tutarını geri yazmak değil.
 */
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';

export const UNIT_SALE_STATUSES = ['reserved', 'sold', 'barter', 'cancelled'] as const;
export type UnitSaleStatus = (typeof UNIT_SALE_STATUSES)[number];

export const UNIT_SALE_SOURCES = ['crm', 'manual'] as const;
export type UnitSaleSource = (typeof UNIT_SALE_SOURCES)[number];

export const UNIT_PAYMENT_KINDS = ['collection', 'refund'] as const;
export type UnitPaymentKind = (typeof UNIT_PAYMENT_KINDS)[number];

export const UNIT_PAYMENT_METHODS = ['cash', 'bank', 'cheque', 'other'] as const;
export type UnitPaymentMethod = (typeof UNIT_PAYMENT_METHODS)[number];

const TRANSITIONS: Record<UnitSaleStatus, ReadonlyArray<UnitSaleStatus>> = {
  reserved: ['sold', 'barter', 'cancelled'],
  sold: ['cancelled'],
  barter: ['cancelled'],
  cancelled: [],
};

export function allowedSaleTransitions(from: UnitSaleStatus): ReadonlyArray<UnitSaleStatus> {
  return TRANSITIONS[from];
}

export interface UnitSaleProps {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number;
  status: UnitSaleStatus;
  source: UnitSaleSource;
  refNo: string | null;
  buyerName: string | null;
  vendorId: number | null;
  listPrice: number;
  salePrice: number;
  currency: CurrencyCode;
  reservedAt: string | null;
  soldAt: string | null;
  cancelledAt: Date | null;
  cancelNote: string | null;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnitSaleUpdate {
  buyerName?: string | undefined;
  vendorId?: number | null | undefined;
  listPrice?: number | undefined;
  salePrice?: number | undefined;
  reservedAt?: string | null | undefined;
  soldAt?: string | null | undefined;
  note?: string | null | undefined;
}

export interface SaleTransitionInput {
  to: UnitSaleStatus;
  note?: string | null | undefined;
  /** reserved → sold geçişinde satış tarihi (verilmezse bugün). */
  soldAt?: string | undefined;
  /** reserved → barter geçişinde taşeron (kayıtta yoksa zorunlu). */
  vendorId?: number | null | undefined;
}

function assertParty(status: UnitSaleStatus, buyerName: string | null, vendorId: number | null) {
  if ((status === 'reserved' || status === 'sold') && (buyerName === null || buyerName === '')) {
    throw new ConstructionValidationError('rezervasyon/satış için alıcı adı zorunludur');
  }
  if (status === 'barter' && vendorId === null) {
    throw new ConstructionValidationError(
      'iş karşılığı satışta taşeron (vendorId) zorunludur — daire kime verildi?',
    );
  }
}

export class UnitSale {
  private constructor(private readonly props: Readonly<UnitSaleProps>) {}

  static create(props: UnitSaleProps): UnitSale {
    if (props.listPrice < 0 || props.salePrice < 0) {
      throw new ConstructionValidationError('fiyat negatif olamaz');
    }
    assertParty(props.status, props.buyerName, props.vendorId);
    if (props.status === 'sold' && props.soldAt === null) {
      throw new ConstructionValidationError('satılan kayıtta satış tarihi zorunludur');
    }
    return new UnitSale(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get projectId(): number {
    return this.props.projectId;
  }
  get locationId(): number {
    return this.props.locationId;
  }
  get status(): UnitSaleStatus {
    return this.props.status;
  }
  get salePrice(): number {
    return this.props.salePrice;
  }
  get active(): boolean {
    return this.props.status !== 'cancelled';
  }
  get allowedTransitions(): ReadonlyArray<UnitSaleStatus> {
    return TRANSITIONS[this.props.status];
  }

  update(patch: UnitSaleUpdate, now: Date): UnitSale {
    if (!this.active) {
      // İptal edilmiş satışın parası/tarafı oynatılmaz: iskonto ve iade
      // yükümlülüğü tarihçesi geriye doğru değişmemeli. Yalnız not düzeltilir.
      const touchesData = Object.keys(patch).some((k) => k !== 'note');
      if (touchesData) {
        throw new InvalidStatusTransitionError(this.props.status, 'düzenleme');
      }
    }
    if (patch.buyerName !== undefined && patch.buyerName.trim() === '') {
      throw new ConstructionValidationError('alıcı adı boş olamaz');
    }
    if (
      (patch.listPrice !== undefined && patch.listPrice < 0) ||
      (patch.salePrice !== undefined && patch.salePrice < 0)
    ) {
      throw new ConstructionValidationError('fiyat negatif olamaz');
    }
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Partial<UnitSaleProps>;
    const next: UnitSaleProps = { ...this.props, ...clean, updatedAt: now };
    assertParty(next.status, next.buyerName, next.vendorId);
    return new UnitSale(next);
  }

  transition(input: SaleTransitionInput, now: Date): UnitSale {
    if (!TRANSITIONS[this.props.status].includes(input.to)) {
      throw new InvalidStatusTransitionError(this.props.status, input.to);
    }
    const next: UnitSaleProps = { ...this.props, status: input.to, updatedAt: now };
    if (input.vendorId !== undefined) next.vendorId = input.vendorId;

    if (input.to === 'sold') {
      next.soldAt = input.soldAt ?? now.toISOString().slice(0, 10);
    }
    if (input.to === 'cancelled') {
      // Gerekçesiz iptal yok: daire envantere dönerken "neden boşaldı" sorusunun
      // cevabı başka yerde durmuyor.
      if (input.note === undefined || input.note === null || input.note.trim() === '') {
        throw new ConstructionValidationError('iptal gerekçesi zorunludur');
      }
      next.cancelledAt = now;
      next.cancelNote = input.note.trim();
    } else if (input.note !== undefined && input.note !== null && input.note.trim() !== '') {
      next.note = input.note.trim();
    }
    assertParty(next.status, next.buyerName, next.vendorId);
    return new UnitSale(next);
  }

  toJSON(): UnitSaleProps {
    return { ...this.props };
  }
}
