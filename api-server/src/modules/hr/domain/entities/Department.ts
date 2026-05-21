/**
 * Department — bir org birime (veya direkt şirkete) bağlı departman.
 *
 * Immutable. `rename`, `assignToOrgUnit`, `assignManager`, `archive` davranışları
 * yeni instance döner. Manager opsiyonel — başlangıçta NULL olabilir, sonradan
 * `assignManager` ile atanır (bkz. 012_hr.sql geç-bağlanan FK açıklaması).
 */
import type { DepartmentCode } from '../valueObjects/DepartmentCode.js';

export interface DepartmentProps {
  id: number;
  companyId: number;
  orgUnitId: number | null;
  name: string;
  code: DepartmentCode | null;
  managerEmployeeId: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Department {
  private constructor(private readonly props: Readonly<DepartmentProps>) {}

  static create(props: DepartmentProps): Department {
    if (props.id <= 0) {
      throw new Error('Department.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Department.companyId pozitif olmalı');
    }
    if (props.orgUnitId !== null && props.orgUnitId <= 0) {
      throw new Error('Department.orgUnitId pozitif olmalı veya null');
    }
    if (props.managerEmployeeId !== null && props.managerEmployeeId <= 0) {
      throw new Error('Department.managerEmployeeId pozitif olmalı veya null');
    }
    if (props.name.trim().length === 0) {
      throw new Error('Department.name boş olamaz');
    }
    if (props.name.length > 200) {
      throw new Error('Department.name 200 karakteri geçemez');
    }
    return new Department(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get orgUnitId(): number | null {
    return this.props.orgUnitId;
  }
  get name(): string {
    return this.props.name;
  }
  get code(): DepartmentCode | null {
    return this.props.code;
  }
  get managerEmployeeId(): number | null {
    return this.props.managerEmployeeId;
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

  hasManager(): boolean {
    return this.props.managerEmployeeId !== null;
  }

  rename(newName: string, now: Date): Department {
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      throw new Error('Department.name boş olamaz');
    }
    if (trimmed.length > 200) {
      throw new Error('Department.name 200 karakteri geçemez');
    }
    if (trimmed === this.props.name) {
      return this;
    }
    return new Department({ ...this.props, name: trimmed, updatedAt: now });
  }

  assignToOrgUnit(orgUnitId: number | null, now: Date): Department {
    if (orgUnitId !== null && orgUnitId <= 0) {
      throw new Error('Department.orgUnitId pozitif olmalı veya null');
    }
    if (orgUnitId === this.props.orgUnitId) {
      return this;
    }
    return new Department({ ...this.props, orgUnitId, updatedAt: now });
  }

  assignManager(employeeId: number | null, now: Date): Department {
    if (employeeId !== null && employeeId <= 0) {
      throw new Error('Department.managerEmployeeId pozitif olmalı veya null');
    }
    if (employeeId === this.props.managerEmployeeId) {
      return this;
    }
    return new Department({ ...this.props, managerEmployeeId: employeeId, updatedAt: now });
  }

  archive(now: Date): Department {
    if (!this.props.active) {
      return this;
    }
    return new Department({ ...this.props, active: false, updatedAt: now });
  }

  reactivate(now: Date): Department {
    if (this.props.active) {
      return this;
    }
    return new Department({ ...this.props, active: true, updatedAt: now });
  }

  toJSON(): Readonly<DepartmentProps> {
    return { ...this.props };
  }
}
