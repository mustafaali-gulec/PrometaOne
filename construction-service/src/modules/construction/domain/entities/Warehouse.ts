/**
 * Warehouse — Depo (projeye bağlı). Tablo: cs_warehouses. Immutable.
 */
export interface WarehouseProps {
  id: number;
  companyId: number;
  projectId: number;
  code: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Warehouse {
  private constructor(private readonly props: Readonly<WarehouseProps>) {}

  static create(props: WarehouseProps): Warehouse {
    if (props.id <= 0) throw new Error('Warehouse.id pozitif olmalı');
    if (props.projectId <= 0) throw new Error('Warehouse.projectId pozitif olmalı');
    if (props.code.trim().length === 0) throw new Error('Warehouse.code boş olamaz');
    if (props.name.trim().length === 0) throw new Error('Warehouse.name boş olamaz');
    return new Warehouse(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get projectId(): number {
    return this.props.projectId;
  }
  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get active(): boolean {
    return this.props.active;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(name: string, now: Date): Warehouse {
    if (name.trim().length === 0) throw new Error('Warehouse.name boş olamaz');
    return new Warehouse({ ...this.props, name: name.trim(), updatedAt: now });
  }

  deactivate(now: Date): Warehouse {
    if (!this.props.active) return this;
    return new Warehouse({ ...this.props, active: false, updatedAt: now });
  }

  toJSON(): Readonly<WarehouseProps> {
    return { ...this.props };
  }
}
