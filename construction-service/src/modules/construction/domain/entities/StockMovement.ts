/**
 * StockMovement — Stok hareketi (giriş/çıkış/transfer/sayım/fire). Tablo:
 * cs_stock_movements. Depo referansları türe göre doğrulanır. Create-only.
 */
import type { StockMoveKind } from '../valueObjects/Material.js';

export interface StockMovementProps {
  id: number;
  companyId: number;
  materialId: number;
  kind: StockMoveKind;
  fromWarehouse: number | null;
  toWarehouse: number | null;
  qty: number;
  unitCost: number;
  boqLineId: number | null;
  description: string | null;
  movedAt: string;
  createdBy: number | null;
  createdAt: Date;
}

export class StockMovement {
  private constructor(private readonly props: Readonly<StockMovementProps>) {}

  static create(props: StockMovementProps): StockMovement {
    if (props.id <= 0) throw new Error('StockMovement.id pozitif olmalı');
    if (props.materialId <= 0) throw new Error('StockMovement.materialId pozitif olmalı');
    if (props.qty < 0) throw new Error('StockMovement.qty negatif olamaz');
    StockMovement.assertWarehouses(props.kind, props.fromWarehouse, props.toWarehouse);
    return new StockMovement(props);
  }

  /** Türe göre depo gerekliliği doğrulaması (use-case girişinde de kullanılır). */
  static assertWarehouses(
    kind: StockMoveKind,
    fromWarehouse: number | null,
    toWarehouse: number | null,
  ): void {
    if ((kind === 'in' || kind === 'adjust') && toWarehouse === null) {
      throw new Error(`'${kind}' hareketi için hedef depo (toWarehouse) gerekli`);
    }
    if ((kind === 'out' || kind === 'waste') && fromWarehouse === null) {
      throw new Error(`'${kind}' hareketi için kaynak depo (fromWarehouse) gerekli`);
    }
    if (kind === 'transfer') {
      if (fromWarehouse === null || toWarehouse === null) {
        throw new Error('Transfer için kaynak ve hedef depo gerekli');
      }
      if (fromWarehouse === toWarehouse) {
        throw new Error('Transferde kaynak ve hedef depo farklı olmalı');
      }
    }
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get materialId(): number {
    return this.props.materialId;
  }
  get kind(): StockMoveKind {
    return this.props.kind;
  }
  get fromWarehouse(): number | null {
    return this.props.fromWarehouse;
  }
  get toWarehouse(): number | null {
    return this.props.toWarehouse;
  }
  get qty(): number {
    return this.props.qty;
  }
  get unitCost(): number {
    return this.props.unitCost;
  }
  get boqLineId(): number | null {
    return this.props.boqLineId;
  }
  get description(): string | null {
    return this.props.description;
  }
  get movedAt(): string {
    return this.props.movedAt;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toJSON(): Readonly<StockMovementProps> {
    return { ...this.props };
  }
}
