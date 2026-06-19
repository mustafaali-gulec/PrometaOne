/**
 * Unit — ölçü birimi (035_warehouse_aux.sql).
 *
 * Basit referans kartı (code/name). Malzeme baseUnit / altUnits serbest metin
 * tutar; bu tablo birim kataloğu / öneri listesi sağlar.
 */
export interface UnitProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Unit {
  private constructor(private readonly props: Readonly<UnitProps>) {}

  static create(props: UnitProps): Unit {
    if (props.id <= 0) {
      throw new Error('Unit.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Unit.companyId pozitif olmalı');
    }
    if (props.code.trim().length === 0) {
      throw new Error('Unit.code boş olamaz');
    }
    if (props.name.trim().length === 0) {
      throw new Error('Unit.name boş olamaz');
    }
    return new Unit(props);
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
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  withUpdates(patch: Partial<Pick<UnitProps, 'code' | 'name'>>, now: Date): Unit {
    return new Unit({ ...this.props, ...patch, updatedAt: now });
  }

  toJSON(): { id: number; companyId: number; code: string; name: string } {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      code: this.props.code,
      name: this.props.name,
    };
  }
}
