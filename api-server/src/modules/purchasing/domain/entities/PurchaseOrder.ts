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
import { FxInfo } from '../../../../shared/fx/FxInfo.js';
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
  /** İsteğe bağlı şantiye poz bağı (cs_boq_lines id — çapraz servis, FK'sız). */
  constructionBoqLineId?: number | null;
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
  /**
   * DÖVİZ (051): dövizli siparişte kayıt anında DONDURULAN kur. Verilmezse
   * `currency` para biriminde kur bilinmiyor kabul edilir (fx.rate = null) ve
   * TRY karşılığı tarihli TCMB kurundan türetilir.
   */
  fx?: FxInfo;
  /** total_amount'ın TRY karşılığı; kur bilinmiyorsa null. */
  totalAmountTRY?: number | null;
  /**
   * İsteğe bağlı şantiye bağı (cs_projects id). Doluysa sipariş, şantiye
   * taahhüt projeksiyonuna (cs_commitments) senkronlanır — köprü kararı:
   * satınalma ikizlenmez, projeksiyon beslenir.
   */
  constructionProjectId?: number | null;
}

/** fx alanları çözülmüş iç gösterim. */
type ResolvedPoProps = PurchaseOrderProps & {
  fx: FxInfo;
  totalAmountTRY: number | null;
  constructionProjectId: number | null;
};

export class PurchaseOrder {
  private constructor(private readonly props: Readonly<ResolvedPoProps>) {}

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
    // fx verilmezse: TRY ise dövizsiz, değilse "kur bilinmiyor" (rate=null).
    const fx = props.fx ?? FxInfo.fromInput({ currency: props.currency });
    const total = round2(props.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
    const totalAmountTRY =
      props.totalAmountTRY !== undefined ? props.totalAmountTRY : fx.toTRY(total);
    return new PurchaseOrder({
      ...props,
      fx,
      totalAmountTRY,
      constructionProjectId: props.constructionProjectId ?? null,
      lines: props.lines.map((l) => ({
        ...l,
        constructionBoqLineId: l.constructionBoqLineId ?? null,
      })),
    });
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

  /** DÖVİZ (051): kayda dondurulmuş kur bilgisi. */
  get fx(): FxInfo {
    return this.props.fx;
  }

  /** total_amount'ın TRY karşılığı; kur bilinmiyorsa null. */
  get totalAmountTRY(): number | null {
    return this.props.totalAmountTRY;
  }

  /** Şantiye bağı (cs_projects id); yoksa null — senkrona hiç gitmez. */
  get constructionProjectId(): number | null {
    return this.props.constructionProjectId;
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

  toJSON(): Readonly<PurchaseOrderProps> & {
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
