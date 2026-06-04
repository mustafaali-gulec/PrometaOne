/**
 * Asset — bir şirketin varlık havuzundaki tek bir zimmet kalemi.
 *
 * Immutable. Davranışlar (assign, unassign, markMaintenance, retire, markLost)
 * yeni instance döner. State machine AssetStatus VO'da.
 *
 * Invariant: status='assigned' ise assignedEmployeeId NOT NULL;
 *            diğer durumlarda (in_stock/maintenance/retired/lost) NULL.
 */
import {
  isAssetTransitionAllowed,
  InvalidAssetTransitionError,
  type AssetStatus,
} from '../valueObjects/AssetStatus.js';
import type { AssetType } from '../valueObjects/AssetType.js';

export interface AssetProps {
  id: number;
  companyId: number;
  assetType: AssetType;
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  status: AssetStatus;
  assignedEmployeeId: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Asset {
  private constructor(private readonly props: Readonly<AssetProps>) {}

  static create(props: AssetProps): Asset {
    if (props.id <= 0) {
      throw new Error('Asset.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Asset.companyId pozitif olmalı');
    }
    if (props.name.trim().length === 0) {
      throw new Error('Asset.name boş olamaz');
    }
    if (props.assignedEmployeeId !== null && props.assignedEmployeeId <= 0) {
      throw new Error('Asset.assignedEmployeeId pozitif olmalı veya null');
    }
    if (props.status === 'assigned' && props.assignedEmployeeId === null) {
      throw new Error('Asset assigned ise assignedEmployeeId dolu olmalı');
    }
    if (props.status !== 'assigned' && props.assignedEmployeeId !== null) {
      throw new Error('Asset assigned değilse assignedEmployeeId null olmalı');
    }
    return new Asset(props);
  }

  // ---------------------------------------------------------------------------
  // Getter'lar
  // ---------------------------------------------------------------------------
  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get assetType(): AssetType {
    return this.props.assetType;
  }
  get name(): string {
    return this.props.name;
  }
  get brand(): string | null {
    return this.props.brand;
  }
  get model(): string | null {
    return this.props.model;
  }
  get serialNo(): string | null {
    return this.props.serialNo;
  }
  get status(): AssetStatus {
    return this.props.status;
  }
  get assignedEmployeeId(): number | null {
    return this.props.assignedEmployeeId;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isInStock(): boolean {
    return this.props.status === 'in_stock';
  }

  isAssigned(): boolean {
    return this.props.status === 'assigned';
  }

  // ---------------------------------------------------------------------------
  // Davranışlar — yeni instance döner
  // ---------------------------------------------------------------------------

  /** Status geçişi — yasaksa InvalidAssetTransitionError fırlatır. */
  private transitionTo(
    newStatus: AssetStatus,
    now: Date,
    assignedEmployeeId: number | null,
  ): Asset {
    if (!isAssetTransitionAllowed(this.props.status, newStatus)) {
      throw new InvalidAssetTransitionError(this.props.status, newStatus);
    }
    return new Asset({
      ...this.props,
      status: newStatus,
      assignedEmployeeId,
      updatedAt: now,
    });
  }

  /** Varlığı bir çalışana ata (in_stock → assigned). */
  assign(employeeId: number, now: Date): Asset {
    if (employeeId <= 0) {
      throw new Error('Asset.assign: employeeId pozitif olmalı');
    }
    return this.transitionTo('assigned', now, employeeId);
  }

  /** Varlığı iade al (assigned → in_stock). */
  unassign(now: Date): Asset {
    return this.transitionTo('in_stock', now, null);
  }

  /** Varlığı bakıma al (in_stock → maintenance). */
  markMaintenance(now: Date): Asset {
    return this.transitionTo('maintenance', now, null);
  }

  /** Varlığı hurdaya ayır (any → retired). */
  retire(now: Date): Asset {
    return this.transitionTo('retired', now, null);
  }

  /** Varlığı kayıp olarak işaretle (any → lost). */
  markLost(now: Date): Asset {
    return this.transitionTo('lost', now, null);
  }

  toJSON(): Readonly<AssetProps> {
    return { ...this.props };
  }
}
