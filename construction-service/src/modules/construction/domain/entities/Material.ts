/**
 * Material — Malzeme master. Tablo: cs_materials (027_cs_material.sql). Immutable.
 */
export interface MaterialProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  unit: string;
  wastePct: number;
  active: boolean;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialUpdate {
  name?: string;
  unit?: string;
  wastePct?: number;
}

export class Material {
  private constructor(private readonly props: Readonly<MaterialProps>) {}

  static create(props: MaterialProps): Material {
    if (props.id <= 0) throw new Error('Material.id pozitif olmalı');
    if (props.code.trim().length === 0) throw new Error('Material.code boş olamaz');
    if (props.name.trim().length === 0) throw new Error('Material.name boş olamaz');
    if (props.wastePct < 0) throw new Error('Material.wastePct negatif olamaz');
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
  get unit(): string {
    return this.props.unit;
  }
  get wastePct(): number {
    return this.props.wastePct;
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

  update(c: MaterialUpdate, now: Date): Material {
    const name = c.name !== undefined ? c.name.trim() : this.props.name;
    if (name.length === 0) throw new Error('Material.name boş olamaz');
    const wastePct = c.wastePct !== undefined ? c.wastePct : this.props.wastePct;
    if (wastePct < 0) throw new Error('Material.wastePct negatif olamaz');
    return new Material({
      ...this.props,
      name,
      unit: c.unit !== undefined ? c.unit.trim() : this.props.unit,
      wastePct,
      updatedAt: now,
    });
  }

  deactivate(now: Date): Material {
    if (!this.props.active) return this;
    return new Material({ ...this.props, active: false, updatedAt: now });
  }

  toJSON(): Readonly<MaterialProps> {
    return { ...this.props };
  }
}
