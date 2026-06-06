/**
 * Machine — Makine parkı kaydı (firma geneli). Tablo: cs_machines.
 */
import type { MachineKind } from '../valueObjects/Labor.js';

export interface MachineProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  kind: MachineKind;
  vendorId: number | null;
  hourlyCost: number;
  active: boolean;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MachineUpdate {
  name?: string;
  kind?: MachineKind;
  vendorId?: number | null;
  hourlyCost?: number;
}

export class Machine {
  private constructor(private readonly props: Readonly<MachineProps>) {}

  static create(props: MachineProps): Machine {
    if (props.id <= 0) throw new Error('Machine.id pozitif olmalı');
    if (props.code.trim().length === 0) throw new Error('Machine.code boş olamaz');
    if (props.name.trim().length === 0) throw new Error('Machine.name boş olamaz');
    if (props.hourlyCost < 0) throw new Error('Machine.hourlyCost negatif olamaz');
    return new Machine(props);
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
  get kind(): MachineKind {
    return this.props.kind;
  }
  get vendorId(): number | null {
    return this.props.vendorId;
  }
  get hourlyCost(): number {
    return this.props.hourlyCost;
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

  update(c: MachineUpdate, now: Date): Machine {
    const name = c.name !== undefined ? c.name.trim() : this.props.name;
    if (name.length === 0) throw new Error('Machine.name boş olamaz');
    const hourlyCost = c.hourlyCost !== undefined ? c.hourlyCost : this.props.hourlyCost;
    if (hourlyCost < 0) throw new Error('Machine.hourlyCost negatif olamaz');
    return new Machine({
      ...this.props,
      name,
      kind: c.kind ?? this.props.kind,
      vendorId: c.vendorId !== undefined ? c.vendorId : this.props.vendorId,
      hourlyCost,
      updatedAt: now,
    });
  }

  deactivate(now: Date): Machine {
    if (!this.props.active) return this;
    return new Machine({ ...this.props, active: false, updatedAt: now });
  }

  toJSON(): Readonly<MachineProps> {
    return { ...this.props };
  }
}
