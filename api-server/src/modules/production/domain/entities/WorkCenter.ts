/**
 * WorkCenter — İş Merkezi / İstasyon (033_production_mrp.sql).
 *
 * Kapasite (günlük çalışma saati) ve maliyet (saatlik maliyet) kaynağıdır.
 * Immutable — rename/update/archive yeni instance döner.
 */
import { InvalidWorkCenterError } from '../errors/ProductionErrors.js';
import type { WorkCenterStatus } from '../valueObjects/WorkCenterStatus.js';

export interface WorkCenterProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  dailyHours: number;
  costPerHour: number;
  status: WorkCenterStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkCenter {
  private constructor(private readonly props: Readonly<WorkCenterProps>) {}

  static create(props: WorkCenterProps): WorkCenter {
    if (props.id <= 0) {
      throw new InvalidWorkCenterError('id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new InvalidWorkCenterError('companyId pozitif olmalı');
    }
    if (props.code.trim().length === 0) {
      throw new InvalidWorkCenterError('kod boş olamaz');
    }
    if (props.name.trim().length === 0) {
      throw new InvalidWorkCenterError('ad boş olamaz');
    }
    if (props.dailyHours < 0) {
      throw new InvalidWorkCenterError('günlük saat negatif olamaz');
    }
    if (props.costPerHour < 0) {
      throw new InvalidWorkCenterError('saatlik maliyet negatif olamaz');
    }
    return new WorkCenter(props);
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
  get dailyHours(): number {
    return this.props.dailyHours;
  }
  get costPerHour(): number {
    return this.props.costPerHour;
  }
  get status(): WorkCenterStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(
    patch: {
      code?: string;
      name?: string;
      dailyHours?: number;
      costPerHour?: number;
      status?: WorkCenterStatus;
    },
    now: Date,
  ): WorkCenter {
    const code = patch.code !== undefined ? patch.code.trim() : this.props.code;
    const name = patch.name !== undefined ? patch.name.trim() : this.props.name;
    const dailyHours = patch.dailyHours ?? this.props.dailyHours;
    const costPerHour = patch.costPerHour ?? this.props.costPerHour;
    const status = patch.status ?? this.props.status;

    if (code.length === 0) {
      throw new InvalidWorkCenterError('kod boş olamaz');
    }
    if (name.length === 0) {
      throw new InvalidWorkCenterError('ad boş olamaz');
    }
    if (dailyHours < 0) {
      throw new InvalidWorkCenterError('günlük saat negatif olamaz');
    }
    if (costPerHour < 0) {
      throw new InvalidWorkCenterError('saatlik maliyet negatif olamaz');
    }

    return new WorkCenter({
      ...this.props,
      code,
      name,
      dailyHours,
      costPerHour,
      status,
      updatedAt: now,
    });
  }

  archive(now: Date): WorkCenter {
    if (this.props.status === 'passive') {
      return this;
    }
    return new WorkCenter({ ...this.props, status: 'passive', updatedAt: now });
  }

  toJSON(): Readonly<WorkCenterProps> {
    return { ...this.props };
  }
}
