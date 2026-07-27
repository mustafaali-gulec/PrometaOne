/**
 * StockMovement — tek bir stok hareketi (034_warehouse.sql).
 *
 * Stok HAREKET-TÜREVLİDİR: güncel stok = hareketlerin base-birim toplamı.
 *   in       → +baseQty (warehouseId)
 *   out      → −baseQty (warehouseId)
 *   transfer → −baseQty (fromWarehouseId) ve +baseQty (toWarehouseId)
 *   count    → işaretli düzeltme (warehouseId; baseQty +/−)
 *
 * baseQty = qty * factor (alt-birimi base'e indirger). StockLedger toplar.
 */
import { FxInfo } from '../../../../shared/fx/FxInfo.js';
import { InvalidMovementError, InvalidQuantityError } from '../errors/WarehouseErrors.js';
import type { MovementKind } from '../valueObjects/MovementKind.js';

/** Lot/parti satırı (trackMethod=lot/serial olan malzemeler için). */
export interface MovementLot {
  no: string;
  qty: number;
  expiry: string | null;
}

export interface StockMovementProps {
  id: number | null;
  companyId: number;
  no: string;
  kind: MovementKind;
  subType: string | null;
  date: string;
  /** Tek-depolu hareketlerde (in/out/count) ana depo. */
  warehouseId: number | null;
  /** transfer çıkış deposu. */
  fromWarehouseId: number | null;
  /** transfer giriş deposu. */
  toWarehouseId: number | null;
  materialId: number;
  qty: number;
  unit: string;
  factor: number;
  baseUnit: string;
  baseQty: number;
  unitPrice: number | null;
  unitCostBase: number | null;
  total: number | null;
  lots: ReadonlyArray<MovementLot>;
  locationId: number | null;
  partyId: number | null;
  person: string | null;
  docNo: string | null;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
  /**
   * DÖVİZ (051): dövizli alım/tedarikte `unitPrice`/`total` ORİJİNAL para
   * biriminde girilir; kayıt anında DONDURULAN kurla TRY karşılığı türetilir.
   * `unitCostBase` (değerleme) DAİMA TL bazlıdır.
   */
  fx?: FxInfo;
  /** total'ın TRY karşılığı; kur bilinmiyorsa null. */
  totalTRY?: number | null;
}

/** fx alanları çözülmüş iç gösterim. */
type ResolvedMovementProps = StockMovementProps & { fx: FxInfo; totalTRY: number | null };

export class StockMovement {
  private constructor(private readonly props: Readonly<ResolvedMovementProps>) {}

  static create(props: StockMovementProps): StockMovement {
    if (props.companyId <= 0) {
      throw new Error('StockMovement.companyId pozitif olmalı');
    }
    if (props.materialId <= 0) {
      throw new Error('StockMovement.materialId pozitif olmalı');
    }
    if (props.qty <= 0) {
      throw new InvalidQuantityError('miktar 0 dan büyük olmalı');
    }
    if (props.factor <= 0) {
      throw new InvalidQuantityError('birim katsayısı (factor) 0 dan büyük olmalı');
    }
    if (props.kind === 'transfer') {
      if (props.fromWarehouseId === null || props.toWarehouseId === null) {
        throw new InvalidMovementError('transfer için fromWarehouseId ve toWarehouseId zorunlu');
      }
      if (props.fromWarehouseId === props.toWarehouseId) {
        throw new InvalidMovementError('transfer kaynak ve hedef depo aynı olamaz');
      }
    } else {
      if (props.warehouseId === null) {
        throw new InvalidMovementError(`${props.kind} hareketi için warehouseId zorunlu`);
      }
    }
    // fx verilmezse: TRY (dövizsiz). totalTRY verilmezse kurdan türetilir.
    const fx = props.fx ?? FxInfo.none();
    const totalTRY =
      props.totalTRY !== undefined
        ? props.totalTRY
        : props.total !== null
          ? fx.toTRY(props.total)
          : null;
    return new StockMovement({ ...props, fx, totalTRY });
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get no(): string {
    return this.props.no;
  }
  get kind(): MovementKind {
    return this.props.kind;
  }
  get subType(): string | null {
    return this.props.subType;
  }
  get date(): string {
    return this.props.date;
  }
  get warehouseId(): number | null {
    return this.props.warehouseId;
  }
  get fromWarehouseId(): number | null {
    return this.props.fromWarehouseId;
  }
  get toWarehouseId(): number | null {
    return this.props.toWarehouseId;
  }
  get materialId(): number {
    return this.props.materialId;
  }
  get qty(): number {
    return this.props.qty;
  }
  get unit(): string {
    return this.props.unit;
  }
  get factor(): number {
    return this.props.factor;
  }
  get baseUnit(): string {
    return this.props.baseUnit;
  }
  get baseQty(): number {
    return this.props.baseQty;
  }
  get unitPrice(): number | null {
    return this.props.unitPrice;
  }
  get unitCostBase(): number | null {
    return this.props.unitCostBase;
  }
  get total(): number | null {
    return this.props.total;
  }
  get lots(): ReadonlyArray<MovementLot> {
    return this.props.lots;
  }
  get locationId(): number | null {
    return this.props.locationId;
  }
  get partyId(): number | null {
    return this.props.partyId;
  }
  get person(): string | null {
    return this.props.person;
  }
  get docNo(): string | null {
    return this.props.docNo;
  }
  get note(): string | null {
    return this.props.note;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Persist sonrası id atanmış yeni instance. */
  withId(id: number): StockMovement {
    return new StockMovement({ ...this.props, id });
  }

  /**
   * Belirli bir deponun base-birim stok deltası (signed):
   *   in       → +baseQty  (warehouseId eşleşirse)
   *   out      → −baseQty  (warehouseId eşleşirse)
   *   count    → +baseQty  (sayım deltası işaretli; girişte + olarak modellenir)
   *   transfer → −baseQty (from) / +baseQty (to)
   */
  signedDeltaFor(warehouseId: number): number {
    switch (this.props.kind) {
      case 'in':
        return this.props.warehouseId === warehouseId ? this.props.baseQty : 0;
      case 'out':
        return this.props.warehouseId === warehouseId ? -this.props.baseQty : 0;
      case 'count':
        return this.props.warehouseId === warehouseId ? this.props.baseQty : 0;
      case 'transfer': {
        let delta = 0;
        if (this.props.fromWarehouseId === warehouseId) delta -= this.props.baseQty;
        if (this.props.toWarehouseId === warehouseId) delta += this.props.baseQty;
        return delta;
      }
      default:
        return 0;
    }
  }

  /** DÖVİZ (051): kayda dondurulmuş kur bilgisi. */
  get fx(): FxInfo {
    return this.props.fx;
  }

  /** total'ın TRY karşılığı; kur bilinmiyorsa null. */
  get totalTRY(): number | null {
    return this.props.totalTRY;
  }

  toJSON(): Omit<StockMovementProps, 'createdAt' | 'fx'> & {
    createdAt: string;
    currency: string;
    fxRate: number | null;
    fxRateSource: string | null;
    fxRateDate: string | null;
    totalTRY: number | null;
  } {
    const { createdAt, fx, ...rest } = this.props;
    return { ...rest, createdAt: createdAt.toISOString(), ...fx.toJSON() };
  }
}
