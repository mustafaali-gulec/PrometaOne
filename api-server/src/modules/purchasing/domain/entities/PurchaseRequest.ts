/**
 * PurchaseRequest — Satınalma talebi (PR) + kalemleri.
 * Tablolar: purchase_requests, purchase_request_items (022_purchasing.sql).
 *
 * totalAmount kalemlerden (qty * unitPrice) türetilir. Statü geçişleri
 * PrStatus kurallarına tabidir (changeStatus).
 *
 * Immutable — değişiklikler yeni instance döner.
 */
import { FxInfo } from '../../../../shared/fx/FxInfo.js';
import {
  InvalidStatusTransitionError,
  PurchasingValidationError,
} from '../errors/PurchasingErrors.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';
import { round2 } from '../valueObjects/Currency.js';
import { canTransitionPr, type PrStatus } from '../valueObjects/PrStatus.js';

export interface PurchaseRequestItem {
  lineNo: number;
  description: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
}

export interface PurchaseRequestProps {
  id: number;
  companyId: number;
  prNo: string;
  requesterUserId: number | null;
  departmentId: number | null;
  category: string;
  priority: string;
  status: PrStatus;
  currency: CurrencyCode;
  justification: string | null;
  requiredBy: Date | null;
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  items: ReadonlyArray<PurchaseRequestItem>;
  /** DÖVİZ (051): dövizli talepte kayıt anında DONDURULAN kur. */
  fx?: FxInfo;
  /** total_amount'ın TRY karşılığı; kur bilinmiyorsa null. */
  totalAmountTRY?: number | null;
}

/** fx alanları çözülmüş iç gösterim. */
type ResolvedPrProps = PurchaseRequestProps & { fx: FxInfo; totalAmountTRY: number | null };

export class PurchaseRequest {
  private constructor(private readonly props: Readonly<ResolvedPrProps>) {}

  static create(props: PurchaseRequestProps): PurchaseRequest {
    if (props.id <= 0) throw new Error('PurchaseRequest.id pozitif olmalı');
    if (props.companyId <= 0) throw new Error('PurchaseRequest.companyId pozitif olmalı');
    if (props.prNo.trim().length === 0) throw new Error('PurchaseRequest.prNo boş olamaz');
    if (props.items.length === 0) {
      throw new PurchasingValidationError('Talep en az bir kalem içermeli');
    }
    for (const it of props.items) {
      if (it.description.trim().length === 0) {
        throw new PurchasingValidationError('Kalem açıklaması boş olamaz');
      }
      if (it.quantity < 0 || it.unitPrice < 0) {
        throw new PurchasingValidationError('Miktar ve birim fiyat negatif olamaz');
      }
    }
    // fx verilmezse: TRY ise dövizsiz, değilse "kur bilinmiyor" (rate=null).
    const fx = props.fx ?? FxInfo.fromInput({ currency: props.currency });
    const total = round2(props.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0));
    const totalAmountTRY =
      props.totalAmountTRY !== undefined ? props.totalAmountTRY : fx.toTRY(total);
    return new PurchaseRequest({ ...props, fx, totalAmountTRY });
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get prNo(): string {
    return this.props.prNo;
  }
  get requesterUserId(): number | null {
    return this.props.requesterUserId;
  }
  get departmentId(): number | null {
    return this.props.departmentId;
  }
  get category(): string {
    return this.props.category;
  }
  get priority(): string {
    return this.props.priority;
  }
  get status(): PrStatus {
    return this.props.status;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
  }
  get justification(): string | null {
    return this.props.justification;
  }
  get requiredBy(): Date | null {
    return this.props.requiredBy;
  }
  get requestedAt(): Date {
    return this.props.requestedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get items(): ReadonlyArray<PurchaseRequestItem> {
    return this.props.items;
  }

  get totalAmount(): number {
    return round2(this.props.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  }

  /** DÖVİZ (051): kayda dondurulmuş kur bilgisi. */
  get fx(): FxInfo {
    return this.props.fx;
  }

  /** total_amount'ın TRY karşılığı; kur bilinmiyorsa null. */
  get totalAmountTRY(): number | null {
    return this.props.totalAmountTRY;
  }

  changeStatus(next: PrStatus, now: Date): PurchaseRequest {
    if (!canTransitionPr(this.props.status, next)) {
      throw new InvalidStatusTransitionError(this.props.status, next);
    }
    if (next === this.props.status) return this;
    return new PurchaseRequest({ ...this.props, status: next, updatedAt: now });
  }

  toJSON(): Readonly<PurchaseRequestProps> & {
    totalAmount: number;
    fxRate: number | null;
    fxRateSource: string | null;
    fxRateDate: string | null;
    totalAmountTRY: number | null;
  } {
    const fx = this.props.fx.toJSON();
    return {
      ...this.props,
      totalAmount: this.totalAmount,
      fxRate: fx.fxRate,
      fxRateSource: fx.fxRateSource,
      fxRateDate: fx.fxRateDate,
      totalAmountTRY: this.props.totalAmountTRY,
    };
  }
}
