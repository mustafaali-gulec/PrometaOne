/**
 * Personnel — Saha personeli (HR çalışanı veya taşeron işçi). Tablo: cs_personnel.
 */
export interface PersonnelProps {
  id: number;
  companyId: number;
  projectId: number;
  employeeId: number | null;
  vendorId: number | null;
  fullName: string;
  trade: string | null;
  dailyCost: number;
  isSubcontractor: boolean;
  active: boolean;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonnelUpdate {
  fullName?: string;
  trade?: string | null;
  dailyCost?: number;
  vendorId?: number | null;
  isSubcontractor?: boolean;
}

export class Personnel {
  private constructor(private readonly props: Readonly<PersonnelProps>) {}

  static create(props: PersonnelProps): Personnel {
    if (props.id <= 0) throw new Error('Personnel.id pozitif olmalı');
    if (props.projectId <= 0) throw new Error('Personnel.projectId pozitif olmalı');
    if (props.fullName.trim().length === 0) throw new Error('Personnel.fullName boş olamaz');
    if (props.dailyCost < 0) throw new Error('Personnel.dailyCost negatif olamaz');
    return new Personnel(props);
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
  get employeeId(): number | null {
    return this.props.employeeId;
  }
  get vendorId(): number | null {
    return this.props.vendorId;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get trade(): string | null {
    return this.props.trade;
  }
  get dailyCost(): number {
    return this.props.dailyCost;
  }
  get isSubcontractor(): boolean {
    return this.props.isSubcontractor;
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

  update(c: PersonnelUpdate, now: Date): Personnel {
    const fullName = c.fullName !== undefined ? c.fullName.trim() : this.props.fullName;
    if (fullName.length === 0) throw new Error('Personnel.fullName boş olamaz');
    const dailyCost = c.dailyCost !== undefined ? c.dailyCost : this.props.dailyCost;
    if (dailyCost < 0) throw new Error('Personnel.dailyCost negatif olamaz');
    return new Personnel({
      ...this.props,
      fullName,
      trade: c.trade !== undefined ? c.trade : this.props.trade,
      dailyCost,
      vendorId: c.vendorId !== undefined ? c.vendorId : this.props.vendorId,
      isSubcontractor:
        c.isSubcontractor !== undefined ? c.isSubcontractor : this.props.isSubcontractor,
      updatedAt: now,
    });
  }

  deactivate(now: Date): Personnel {
    if (!this.props.active) return this;
    return new Personnel({ ...this.props, active: false, updatedAt: now });
  }

  toJSON(): Readonly<PersonnelProps> {
    return { ...this.props };
  }
}
