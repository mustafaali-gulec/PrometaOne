/**
 * MaterialRequest — Malzeme Talep (035_warehouse_aux.sql).
 *
 * İş akışı: pending → approved → fulfilled  (veya pending/approved → rejected).
 * fulfill, requestedWarehouseId'den her kalem için OUT stok hareketi
 * (subType=kullanima_verme) yaratır — bkz. FulfillMaterialRequestUseCase.
 *
 * items = talep kalemleri [{ materialId, qty }] JSONB dizisi (aggregate çocuk).
 */
import type { MaterialRequestStatus } from '../valueObjects/AuxStatuses.js';

/** Talep kalemi. unit opsiyonel — verilmezse karşılamada malzemenin baseUnit'i kullanılır. */
export interface MaterialRequestItem {
  materialId: number;
  qty: number;
  unit: string | null;
}

export interface MaterialRequestProps {
  id: number;
  companyId: number;
  no: string;
  date: string;
  requesterUnit: string | null;
  requester: string | null;
  requestedWarehouseId: number | null;
  validityDays: number | null;
  status: MaterialRequestStatus;
  items: ReadonlyArray<MaterialRequestItem>;
  note: string | null;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MaterialRequest {
  private constructor(private readonly props: Readonly<MaterialRequestProps>) {}

  static create(props: MaterialRequestProps): MaterialRequest {
    if (props.id <= 0) {
      throw new Error('MaterialRequest.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('MaterialRequest.companyId pozitif olmalı');
    }
    if (props.no.trim().length === 0) {
      throw new Error('MaterialRequest.no boş olamaz');
    }
    for (const it of props.items) {
      if (it.materialId <= 0) {
        throw new Error('MaterialRequest.items.materialId pozitif olmalı');
      }
      if (it.qty <= 0) {
        throw new Error('MaterialRequest.items.qty 0 dan büyük olmalı');
      }
    }
    return new MaterialRequest(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get no(): string {
    return this.props.no;
  }
  get date(): string {
    return this.props.date;
  }
  get requesterUnit(): string | null {
    return this.props.requesterUnit;
  }
  get requester(): string | null {
    return this.props.requester;
  }
  get requestedWarehouseId(): number | null {
    return this.props.requestedWarehouseId;
  }
  get validityDays(): number | null {
    return this.props.validityDays;
  }
  get status(): MaterialRequestStatus {
    return this.props.status;
  }
  get items(): ReadonlyArray<MaterialRequestItem> {
    return this.props.items;
  }
  get note(): string | null {
    return this.props.note;
  }
  get rejectReason(): string | null {
    return this.props.rejectReason;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  withUpdates(
    patch: Partial<
      Pick<
        MaterialRequestProps,
        | 'date'
        | 'requesterUnit'
        | 'requester'
        | 'requestedWarehouseId'
        | 'validityDays'
        | 'status'
        | 'items'
        | 'note'
        | 'rejectReason'
      >
    >,
    now: Date,
  ): MaterialRequest {
    return new MaterialRequest({ ...this.props, ...patch, updatedAt: now });
  }

  toJSON(): Omit<MaterialRequestProps, 'createdAt' | 'updatedAt'> {
    const { createdAt: _c, updatedAt: _u, ...rest } = this.props;
    return rest;
  }
}
