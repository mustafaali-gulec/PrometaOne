/**
 * Poz — Birim fiyat / poz katalog kaydı. Tablo: cs_poz_catalog (024_cs_boq.sql).
 *
 * Firma genelinde yeniden kullanılan iş kalemi tanımı; keşif satırları (BoqLine)
 * buradan kopyalanabilir. Immutable.
 */
export interface PozProps {
  id: number;
  companyId: number;
  pozNo: string;
  name: string;
  unit: string;
  unitPrice: number;
  source: string | null;
  year: number | null;
  active: boolean;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PozUpdate {
  name?: string;
  unit?: string;
  unitPrice?: number;
  source?: string | null;
  year?: number | null;
}

export class Poz {
  private constructor(private readonly props: Readonly<PozProps>) {}

  static create(props: PozProps): Poz {
    if (props.id <= 0) throw new Error('Poz.id pozitif olmalı');
    if (props.companyId <= 0) throw new Error('Poz.companyId pozitif olmalı');
    if (props.pozNo.trim().length === 0) throw new Error('Poz.pozNo boş olamaz');
    if (props.name.trim().length === 0) throw new Error('Poz.name boş olamaz');
    if (props.unit.trim().length === 0) throw new Error('Poz.unit boş olamaz');
    if (props.unitPrice < 0) throw new Error('Poz.unitPrice negatif olamaz');
    return new Poz(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get pozNo(): string {
    return this.props.pozNo;
  }
  get name(): string {
    return this.props.name;
  }
  get unit(): string {
    return this.props.unit;
  }
  get unitPrice(): number {
    return this.props.unitPrice;
  }
  get source(): string | null {
    return this.props.source;
  }
  get year(): number | null {
    return this.props.year;
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

  update(changes: PozUpdate, now: Date): Poz {
    const name = changes.name !== undefined ? changes.name.trim() : this.props.name;
    if (name.length === 0) throw new Error('Poz.name boş olamaz');
    const unit = changes.unit !== undefined ? changes.unit.trim() : this.props.unit;
    if (unit.length === 0) throw new Error('Poz.unit boş olamaz');
    const unitPrice = changes.unitPrice !== undefined ? changes.unitPrice : this.props.unitPrice;
    if (unitPrice < 0) throw new Error('Poz.unitPrice negatif olamaz');
    return new Poz({
      ...this.props,
      name,
      unit,
      unitPrice,
      source: changes.source !== undefined ? changes.source : this.props.source,
      year: changes.year !== undefined ? changes.year : this.props.year,
      updatedAt: now,
    });
  }

  deactivate(now: Date): Poz {
    if (!this.props.active) return this;
    return new Poz({ ...this.props, active: false, updatedAt: now });
  }

  reactivate(now: Date): Poz {
    if (this.props.active) return this;
    return new Poz({ ...this.props, active: true, updatedAt: now });
  }

  toJSON(): Readonly<PozProps> {
    return { ...this.props };
  }
}
