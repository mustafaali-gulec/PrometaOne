/**
 * PurchaseOrder — Satınalma siparişi (PO) + satırları.
 * Tablolar: purchase_orders, purchase_order_lines (022_purchasing.sql).
 *
 * Her PO bir tedarikçiye (vendorId) bağlıdır — cari hesap ilişkisi. totalAmount
 * satırlardan türetilir. Statü geçişleri PoStatus kurallarına tabidir; 'ordered'
 * geçişinde orderedAt, 'received' geçişinde deliveredAt damgalanır.
 *
 * Immutable — değişiklikler yeni instance döner.
 */
import {
  InvalidStatusTransitionError,
  PurchasingValidationError,
} from '../errors/PurchasingErrors.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';
import { round2 } from '../valueObjects/Currency.js';
import { canTransitionPo, type PoStatus } from '../valueObjects/PoStatus.js';

export interface PurchaseOrderLine {
  lineNo: number;
  description: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
}

export interface PurchaseOrderProps {
  id: number;
  companyId: number;
  poNo: string;
  vendorId: number;
  prId: number | null;
  status: PoStatus;
  currency: CurrencyCode;
  note: string | null;
  orderedAt: Date | null;
  deliveredAt: Date | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  lines: ReadonlyArray<PurchaseOrderLine>;
}

export class PurchaseOrder {
  private constructor(private readonly props: Readonly<PurchaseOrderProps>) {}

  static create(props: PurchaseOrderProps): PurchaseOrder {
    if (props.id <= 0) throw new Error('PurchaseOrder.id pozitif olmalı');
    if (props.companyId <= 0) throw new Error('PurchaseOrder.companyId pozitif olmalı');
    if (props.poNo.trim().length === 0) throw new Error('PurchaseOrder.poNo boş olamaz');
    if (props.vendorId <= 0) {
      throw new PurchasingValidationError('Sipariş bir tedarikçiye bağlı olmalı (vendorId)');
    }
    if (props.lines.length === 0) {
      throw new PurchasingValidationError('Sipariş en az bir satır içermeli');
    }
    for (const ln of props.lines) {
      if (ln.description.trim().length === 0) {
        throw new PurchasingValidationError('Satır açıklaması boş olamaz');
      }
      if (ln.quantity < 0 || ln.unitPrice < 0 || ln.receivedQty < 0) {
        throw new PurchasingValidationError('Miktar/fiyat negatif olamaz');
      }
    }
    return new PurchaseOrder(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get poNo(): string {
    return this.props.poNo;
  }
  get vendorId(): number {
    return this.props.vendorId;
  }
  get prId(): number | null {
    return this.props.prId;
  }
  get status(): PoStatus {
    return this.props.status;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
  }
  get note(): string | null {
    return this.props.note;
  }
  get orderedAt(): Date | null {
    return this.props.orderedAt;
  }
  get deliveredAt(): Date | null {
    return this.props.deliveredAt;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get lines(): ReadonlyArray<PurchaseOrderLine> {
    return this.props.lines;
  }

  get totalAmount(): number {
    return round2(this.props.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  }

  changeStatus(next: PoStatus, now: Date): PurchaseOrder {
    if (!canTransitionPo(this.props.status, next)) {
      throw new InvalidStatusTransitionError(this.props.status, next);
    }
    if (next === this.props.status) return this;
    const orderedAt =
      next === 'ordered' && this.props.orderedAt === null ? now : this.props.orderedAt;
    const deliveredAt =
      next === 'received' && this.props.deliveredAt === null ? now : this.props.deliveredAt;
    return new PurchaseOrder({
      ...this.props,
      status: next,
      orderedAt,
      deliveredAt,
      updatedAt: now,
    });
  }

  toJSON(): Readonly<PurchaseOrderProps> {
    return { ...this.props };
  }
}
