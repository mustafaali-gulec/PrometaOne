/**
 * Warehouse — depo (ambar) kartı (034_warehouse.sql).
 *
 * Çoklu konum (oda/koridor/raf/göz) hiyerarşisini locations[] olarak taşır.
 * Güncel stok burada saklanmaz; StockLedger hareketlerden türetir.
 */
import type { LocationStatus } from '../valueObjects/LocationStatus.js';
import type { WarehouseStatus } from '../valueObjects/WarehouseStatus.js';

export interface WarehouseLocation {
  /** Konum id'si (kalıcı; null = henüz persist edilmemiş). */
  id: number | null;
  /** Konum kodu (örn. "A-01-02-03"). */
  code: string;
  /** İnsan-okunur ad. */
  name: string;
  /** Oda / koridor / raf / göz seviyeleri (opsiyonel serbest metin). */
  room: string | null;
  aisle: string | null;
  shelf: string | null;
  bin: string | null;
  status: LocationStatus;
}

export interface WarehouseProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  unitName: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  manager: string | null;
  status: WarehouseStatus;
  locations: ReadonlyArray<WarehouseLocation>;
  createdAt: Date;
  updatedAt: Date;
}

export class Warehouse {
  private constructor(private readonly props: Readonly<WarehouseProps>) {}

  static create(props: WarehouseProps): Warehouse {
    if (props.id <= 0) {
      throw new Error('Warehouse.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Warehouse.companyId pozitif olmalı');
    }
    if (props.code.trim().length === 0) {
      throw new Error('Warehouse.code boş olamaz');
    }
    if (props.name.trim().length === 0) {
      throw new Error('Warehouse.name boş olamaz');
    }
    return new Warehouse(props);
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
  get unitName(): string | null {
    return this.props.unitName;
  }
  get city(): string | null {
    return this.props.city;
  }
  get district(): string | null {
    return this.props.district;
  }
  get address(): string | null {
    return this.props.address;
  }
  get manager(): string | null {
    return this.props.manager;
  }
  get status(): WarehouseStatus {
    return this.props.status;
  }
  get locations(): ReadonlyArray<WarehouseLocation> {
    return this.props.locations;
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

  /** Alanları kısmen değiştirip yeni bir instance döndürür (immutable). */
  withUpdates(
    patch: Partial<
      Pick<
        WarehouseProps,
        | 'code'
        | 'name'
        | 'unitName'
        | 'city'
        | 'district'
        | 'address'
        | 'manager'
        | 'status'
        | 'locations'
      >
    >,
    now: Date,
  ): Warehouse {
    return new Warehouse({ ...this.props, ...patch, updatedAt: now });
  }

  toJSON(): {
    id: number;
    companyId: number;
    code: string;
    name: string;
    unitName: string | null;
    city: string | null;
    district: string | null;
    address: string | null;
    manager: string | null;
    status: WarehouseStatus;
    locations: ReadonlyArray<WarehouseLocation>;
  } {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      code: this.props.code,
      name: this.props.name,
      unitName: this.props.unitName,
      city: this.props.city,
      district: this.props.district,
      address: this.props.address,
      manager: this.props.manager,
      status: this.props.status,
      locations: this.props.locations,
    };
  }
}
