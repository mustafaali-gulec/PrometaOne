/**
 * Material — malzeme / stok kartı (034_warehouse.sql).
 *
 * Çoklu birim (altUnits), depo bazlı parametreler (whParams) ve vergi
 * alanlarını taşır. Güncel stok/maliyet burada saklanmaz; StockLedger
 * hareketlerden türetir (hareket-türevli stok).
 */
import type {
  AbcClass,
  CostMethod,
  MaterialStatus,
  NegativeControl,
  TrackMethod,
} from '../valueObjects/MaterialEnums.js';

/** Alternatif birim — baseUnit'e `factor` ile dönüşür (1 alt = factor base). */
export interface MaterialAltUnit {
  unit: string;
  factor: number;
  barcode: string | null;
}

/** Depo bazlı min/max/güvenlik stok + varsayılan konum. */
export interface MaterialWhParam {
  warehouseId: number;
  minStock: number | null;
  maxStock: number | null;
  safetyStock: number | null;
  locationId: number | null;
}

export interface MaterialProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  groupId: number | null;
  type: string | null;
  baseUnit: string;
  altUnits: ReadonlyArray<MaterialAltUnit>;
  brand: string | null;
  barcode: string | null;
  producerCode: string | null;
  gtip: string | null;
  abc: AbcClass | null;
  trackMethod: TrackMethod;
  costMethod: CostMethod;
  negativeControl: NegativeControl;
  minStock: number | null;
  maxStock: number | null;
  safetyStock: number | null;
  shelfLifeMonths: number | null;
  perishable: boolean;
  fragile: boolean;
  kdvPurchase: number | null;
  kdvSale: number | null;
  tevkifatCode: string | null;
  extraTaxRate: number | null;
  whParams: ReadonlyArray<MaterialWhParam>;
  status: MaterialStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Material {
  private constructor(private readonly props: Readonly<MaterialProps>) {}

  static create(props: MaterialProps): Material {
    if (props.id <= 0) {
      throw new Error('Material.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Material.companyId pozitif olmalı');
    }
    if (props.code.trim().length === 0) {
      throw new Error('Material.code boş olamaz');
    }
    if (props.name.trim().length === 0) {
      throw new Error('Material.name boş olamaz');
    }
    if (props.baseUnit.trim().length === 0) {
      throw new Error('Material.baseUnit boş olamaz');
    }
    for (const au of props.altUnits) {
      if (au.factor <= 0) {
        throw new Error(`Material.altUnits factor pozitif olmalı: ${au.unit}`);
      }
    }
    return new Material(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get groupId(): number | null {
    return this.props.groupId;
  }
  get type(): string | null {
    return this.props.type;
  }
  get baseUnit(): string {
    return this.props.baseUnit;
  }
  get altUnits(): ReadonlyArray<MaterialAltUnit> {
    return this.props.altUnits;
  }
  get brand(): string | null {
    return this.props.brand;
  }
  get barcode(): string | null {
    return this.props.barcode;
  }
  get producerCode(): string | null {
    return this.props.producerCode;
  }
  get gtip(): string | null {
    return this.props.gtip;
  }
  get abc(): AbcClass | null {
    return this.props.abc;
  }
  get trackMethod(): TrackMethod {
    return this.props.trackMethod;
  }
  get costMethod(): CostMethod {
    return this.props.costMethod;
  }
  get negativeControl(): NegativeControl {
    return this.props.negativeControl;
  }
  get minStock(): number | null {
    return this.props.minStock;
  }
  get maxStock(): number | null {
    return this.props.maxStock;
  }
  get safetyStock(): number | null {
    return this.props.safetyStock;
  }
  get shelfLifeMonths(): number | null {
    return this.props.shelfLifeMonths;
  }
  get perishable(): boolean {
    return this.props.perishable;
  }
  get fragile(): boolean {
    return this.props.fragile;
  }
  get kdvPurchase(): number | null {
    return this.props.kdvPurchase;
  }
  get kdvSale(): number | null {
    return this.props.kdvSale;
  }
  get tevkifatCode(): string | null {
    return this.props.tevkifatCode;
  }
  get extraTaxRate(): number | null {
    return this.props.extraTaxRate;
  }
  get whParams(): ReadonlyArray<MaterialWhParam> {
    return this.props.whParams;
  }
  get status(): MaterialStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === 'active';
  }

  /** Negatif stoğa izin veriliyor mu (çıkış/transfer stoku negatife düşürebilir mi). */
  allowsNegativeStock(): boolean {
    return this.props.negativeControl === 'allow';
  }

  /**
   * Bir birim ve miktarı base birime çevirir. unit baseUnit ise factor=1;
   * altUnits içinde bulunursa factor onunki; aksi halde unit tanımsız.
   */
  resolveFactor(unit: string): number | null {
    if (unit === this.props.baseUnit) {
      return 1;
    }
    const au = this.props.altUnits.find((u) => u.unit === unit);
    return au ? au.factor : null;
  }

  withUpdates(
    patch: Partial<Omit<MaterialProps, 'id' | 'companyId' | 'createdAt'>>,
    now: Date,
  ): Material {
    return new Material({ ...this.props, ...patch, updatedAt: now });
  }

  toJSON(): Omit<MaterialProps, 'createdAt' | 'updatedAt'> {
    const { createdAt: _c, updatedAt: _u, ...rest } = this.props;
    return rest;
  }
}
