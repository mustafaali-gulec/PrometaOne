/**
 * Vendor — Tedarikçi (kalıcı cari). Tablo: vendors (022_purchasing.sql).
 *
 * Tedarikçi sistemde bir cari kaydıdır: `code` cari kodu (örn 320.A001),
 * `accountCode` muhasebe/cari hesap kodu (cari hesap ilişkisi). PO bu kayda
 * vendor_id ile bağlanır.
 *
 * Immutable — update/deactivate/reactivate yeni instance döner.
 */
export type PersonType = 'real' | 'legal';
export type CariClass = 'satici' | 'alici';

export interface VendorProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  taxId: string | null;
  personType: PersonType;
  cariClass: CariClass;
  accountCode: string | null;
  active: boolean;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorUpdate {
  name?: string;
  taxId?: string | null;
  personType?: PersonType;
  cariClass?: CariClass;
  accountCode?: string | null;
}

export class Vendor {
  private constructor(private readonly props: Readonly<VendorProps>) {}

  static create(props: VendorProps): Vendor {
    if (props.id <= 0) throw new Error('Vendor.id pozitif olmalı');
    if (props.companyId <= 0) throw new Error('Vendor.companyId pozitif olmalı');
    if (props.code.trim().length === 0) throw new Error('Vendor.code boş olamaz');
    if (props.name.trim().length === 0) throw new Error('Vendor.name boş olamaz');
    if (props.name.length > 300) throw new Error('Vendor.name 300 karakteri geçemez');
    return new Vendor(props);
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
  get taxId(): string | null {
    return this.props.taxId;
  }
  get personType(): PersonType {
    return this.props.personType;
  }
  get cariClass(): CariClass {
    return this.props.cariClass;
  }
  get accountCode(): string | null {
    return this.props.accountCode;
  }
  get active(): boolean {
    return this.props.active;
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

  update(changes: VendorUpdate, now: Date): Vendor {
    const name = changes.name !== undefined ? changes.name.trim() : this.props.name;
    if (name.length === 0) throw new Error('Vendor.name boş olamaz');
    if (name.length > 300) throw new Error('Vendor.name 300 karakteri geçemez');
    return new Vendor({
      ...this.props,
      name,
      taxId: changes.taxId !== undefined ? changes.taxId : this.props.taxId,
      personType: changes.personType ?? this.props.personType,
      cariClass: changes.cariClass ?? this.props.cariClass,
      accountCode: changes.accountCode !== undefined ? changes.accountCode : this.props.accountCode,
      updatedAt: now,
    });
  }

  deactivate(now: Date): Vendor {
    if (!this.props.active) return this;
    return new Vendor({ ...this.props, active: false, updatedAt: now });
  }

  reactivate(now: Date): Vendor {
    if (this.props.active) return this;
    return new Vendor({ ...this.props, active: true, updatedAt: now });
  }

  toJSON(): Readonly<VendorProps> {
    return { ...this.props };
  }
}
