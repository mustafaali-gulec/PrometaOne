/**
 * Project — Proje (özel veya ihaleli). Tablo: cs_projects (023_cs_projects.sql).
 *
 * Tarih alanları 'YYYY-MM-DD' string olarak tutulur (TZ kayması olmadan, DB
 * tarafında DATE). Immutable — update/changeStatus/deactivate yeni instance döner.
 */
import { InvalidStatusTransitionError } from '../errors/ConstructionErrors.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';
import {
  canTransitionProject,
  type ProjectStatus,
  type ProjectType,
} from '../valueObjects/ProjectStatus.js';

export interface ProjectProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  projectType: ProjectType;
  status: ProjectStatus;
  orgUnitId: number | null;
  managerUserId: number | null;
  location: string | null;
  startDate: string | null;
  plannedEnd: string | null;
  budgetAmount: number;
  currency: CurrencyCode;
  active: boolean;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectUpdate {
  name?: string;
  projectType?: ProjectType;
  orgUnitId?: number | null;
  managerUserId?: number | null;
  location?: string | null;
  startDate?: string | null;
  plannedEnd?: string | null;
  budgetAmount?: number;
  currency?: CurrencyCode;
}

export class Project {
  private constructor(private readonly props: Readonly<ProjectProps>) {}

  static create(props: ProjectProps): Project {
    if (props.id <= 0) throw new Error('Project.id pozitif olmalı');
    if (props.companyId <= 0) throw new Error('Project.companyId pozitif olmalı');
    if (props.code.trim().length === 0) throw new Error('Project.code boş olamaz');
    if (props.name.trim().length === 0) throw new Error('Project.name boş olamaz');
    if (props.name.length > 300) throw new Error('Project.name 300 karakteri geçemez');
    if (props.budgetAmount < 0) throw new Error('Project.budgetAmount negatif olamaz');
    return new Project(props);
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
  get projectType(): ProjectType {
    return this.props.projectType;
  }
  get status(): ProjectStatus {
    return this.props.status;
  }
  get orgUnitId(): number | null {
    return this.props.orgUnitId;
  }
  get managerUserId(): number | null {
    return this.props.managerUserId;
  }
  get location(): string | null {
    return this.props.location;
  }
  get startDate(): string | null {
    return this.props.startDate;
  }
  get plannedEnd(): string | null {
    return this.props.plannedEnd;
  }
  get budgetAmount(): number {
    return this.props.budgetAmount;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
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

  update(changes: ProjectUpdate, now: Date): Project {
    const name = changes.name !== undefined ? changes.name.trim() : this.props.name;
    if (name.length === 0) throw new Error('Project.name boş olamaz');
    if (name.length > 300) throw new Error('Project.name 300 karakteri geçemez');
    const budgetAmount =
      changes.budgetAmount !== undefined ? changes.budgetAmount : this.props.budgetAmount;
    if (budgetAmount < 0) throw new Error('Project.budgetAmount negatif olamaz');
    return new Project({
      ...this.props,
      name,
      projectType: changes.projectType ?? this.props.projectType,
      orgUnitId: changes.orgUnitId !== undefined ? changes.orgUnitId : this.props.orgUnitId,
      managerUserId:
        changes.managerUserId !== undefined ? changes.managerUserId : this.props.managerUserId,
      location: changes.location !== undefined ? changes.location : this.props.location,
      startDate: changes.startDate !== undefined ? changes.startDate : this.props.startDate,
      plannedEnd: changes.plannedEnd !== undefined ? changes.plannedEnd : this.props.plannedEnd,
      budgetAmount,
      currency: changes.currency ?? this.props.currency,
      updatedAt: now,
    });
  }

  changeStatus(to: ProjectStatus, now: Date): Project {
    if (!canTransitionProject(this.props.status, to)) {
      throw new InvalidStatusTransitionError(this.props.status, to);
    }
    if (to === this.props.status) return this;
    return new Project({ ...this.props, status: to, updatedAt: now });
  }

  deactivate(now: Date): Project {
    if (!this.props.active) return this;
    return new Project({ ...this.props, active: false, updatedAt: now });
  }

  reactivate(now: Date): Project {
    if (this.props.active) return this;
    return new Project({ ...this.props, active: true, updatedAt: now });
  }

  toJSON(): Readonly<ProjectProps> {
    return { ...this.props };
  }
}
