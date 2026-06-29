/**
 * PurchaseRequest — Satınalma talebi (PR) + kalemleri.
 * Tablolar: purchase_requests, purchase_request_items (022_purchasing.sql).
 *
 * totalAmount kalemlerden (qty * unitPrice) türetilir. Statü geçişleri
 * PrStatus kurallarına tabidir (changeStatus).
 *
 * Immutable — değişiklikler yeni instance döner.
 */
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
}

export class PurchaseRequest {
  private constructor(private readonly props: Readonly<PurchaseRequestProps>) {}

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
    return new PurchaseRequest(props);
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

  changeStatus(next: PrStatus, now: Date): PurchaseRequest {
    if (!canTransitionPr(this.props.status, next)) {
      throw new InvalidStatusTransitionError(this.props.status, next);
    }
    if (next === this.props.status) return this;
    return new PurchaseRequest({ ...this.props, status: next, updatedAt: now });
  }

  toJSON(): Readonly<PurchaseRequestProps> {
    return { ...this.props };
  }
}
