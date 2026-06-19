/**
 * InventoryCount — Envanter Sayım (035_warehouse_aux.sql).
 *
 * İş akışı: open → applied. apply, farklı (countedQty ≠ systemQty) kalemler için
 * `count` türünde işaretli stok hareketi (baseQty = countedQty − systemQty)
 * yaratır — bkz. ApplyInventoryCountUseCase.
 *
 * items = sayım kalemleri [{ materialId, systemQty, countedQty }] JSONB dizisi.
 */
import type { InventoryCountStatus } from '../valueObjects/AuxStatuses.js';

/** Sayım kalemi — sistemdeki ile sayılan miktar. */
export interface InventoryCountItem {
  materialId: number;
  systemQty: number;
  countedQty: number;
}

export interface InventoryCountProps {
  id: number;
  companyId: number;
  no: string;
  date: string;
  warehouseId: number;
  period: string | null;
  status: InventoryCountStatus;
  items: ReadonlyArray<InventoryCountItem>;
  createdAt: Date;
  updatedAt: Date;
}

export class InventoryCount {
  private constructor(private readonly props: Readonly<InventoryCountProps>) {}

  static create(props: InventoryCountProps): InventoryCount {
    if (props.id <= 0) {
      throw new Error('InventoryCount.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('InventoryCount.companyId pozitif olmalı');
    }
    if (props.no.trim().length === 0) {
      throw new Error('InventoryCount.no boş olamaz');
    }
    if (props.warehouseId <= 0) {
      throw new Error('InventoryCount.warehouseId pozitif olmalı');
    }
    for (const it of props.items) {
      if (it.materialId <= 0) {
        throw new Error('InventoryCount.items.materialId pozitif olmalı');
      }
    }
    return new InventoryCount(props);
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
  get warehouseId(): number {
    return this.props.warehouseId;
  }
  get period(): string | null {
    return this.props.period;
  }
  get status(): InventoryCountStatus {
    return this.props.status;
  }
  get items(): ReadonlyArray<InventoryCountItem> {
    return this.props.items;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  withUpdates(
    patch: Partial<
      Pick<InventoryCountProps, 'date' | 'warehouseId' | 'period' | 'status' | 'items'>
    >,
    now: Date,
  ): InventoryCount {
    return new InventoryCount({ ...this.props, ...patch, updatedAt: now });
  }

  toJSON(): Omit<InventoryCountProps, 'createdAt' | 'updatedAt'> {
    const { createdAt: _c, updatedAt: _u, ...rest } = this.props;
    return rest;
  }
}
