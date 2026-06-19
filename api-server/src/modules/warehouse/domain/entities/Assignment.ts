/**
 * Assignment — Zimmet (035_warehouse_aux.sql).
 *
 * İş akışı: open → returned. create her kalem için OUT stok hareketi
 * (subType=zimmet, kalemin warehouseId'sinden), return ise IN stok hareketi
 * (subType=zimmet_iade) yaratır — bkz. Assignment use-case'leri.
 *
 * items = zimmet kalemleri [{ materialId, warehouseId, qty }] JSONB dizisi.
 */
import type { AssignmentStatus } from '../valueObjects/AuxStatuses.js';

/** Zimmet kalemi — hangi depodan hangi malzemeden ne kadar. */
export interface AssignmentItem {
  materialId: number;
  warehouseId: number;
  qty: number;
}

export interface AssignmentProps {
  id: number;
  companyId: number;
  no: string;
  date: string;
  person: string | null;
  birim: string | null;
  status: AssignmentStatus;
  items: ReadonlyArray<AssignmentItem>;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Assignment {
  private constructor(private readonly props: Readonly<AssignmentProps>) {}

  static create(props: AssignmentProps): Assignment {
    if (props.id <= 0) {
      throw new Error('Assignment.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Assignment.companyId pozitif olmalı');
    }
    if (props.no.trim().length === 0) {
      throw new Error('Assignment.no boş olamaz');
    }
    for (const it of props.items) {
      if (it.materialId <= 0) {
        throw new Error('Assignment.items.materialId pozitif olmalı');
      }
      if (it.warehouseId <= 0) {
        throw new Error('Assignment.items.warehouseId pozitif olmalı');
      }
      if (it.qty <= 0) {
        throw new Error('Assignment.items.qty 0 dan büyük olmalı');
      }
    }
    return new Assignment(props);
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
  get person(): string | null {
    return this.props.person;
  }
  get birim(): string | null {
    return this.props.birim;
  }
  get status(): AssignmentStatus {
    return this.props.status;
  }
  get items(): ReadonlyArray<AssignmentItem> {
    return this.props.items;
  }
  get note(): string | null {
    return this.props.note;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  withUpdates(patch: Partial<Pick<AssignmentProps, 'status'>>, now: Date): Assignment {
    return new Assignment({ ...this.props, ...patch, updatedAt: now });
  }

  toJSON(): Omit<AssignmentProps, 'createdAt' | 'updatedAt'> {
    const { createdAt: _c, updatedAt: _u, ...rest } = this.props;
    return rest;
  }
}
