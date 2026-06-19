/**
 * ProductionOrder — Üretim Emri (033_production_mrp.sql).
 *
 * Bir mamulün belirli miktarda üretimi için açılan emir. Reçeteden (bomId)
 * patlatılarak malzeme rezervasyonları (materials) ve operasyonlar (operations)
 * üretilir. Yaşam döngüsü ProductionOrderStatus VO ile zorlanır.
 *
 * Aggregate root: materials + operations bu varlığa aittir.
 * Immutable — transitionTo/complete yeni instance döner.
 */
import { InvalidProductionOrderError } from '../errors/ProductionErrors.js';
import {
  ProductionOrderStatus,
  type ProductionOrderStatusValue,
} from '../valueObjects/ProductionOrderStatus.js';

export type ProductionOrderPriority = 'low' | 'normal' | 'high';
export type ProductionOrderSource = 'manual' | 'mrp';

export interface ProductionOrderMaterial {
  id?: number;
  materialRef: string;
  requiredQty: number;
  unit: string | null;
  consumedQty: number;
}

export interface ProductionOrderOperation {
  id?: number;
  workCenterId: number | null;
  name: string;
  plannedMin: number;
  status: 'pending' | 'done';
  seq: number;
}

/** Tamamlanma anındaki maliyet dökümü (cost_snapshot JSONB). */
export interface CostSnapshot {
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  unitCost: number;
}

export interface ProductionOrderProps {
  id: number;
  companyId: number;
  no: string;
  bomId: number | null;
  productMaterialRef: string;
  qty: number;
  unit: string | null;
  status: ProductionOrderStatusValue;
  plannedStart: string | null; // YYYY-MM-DD
  plannedEnd: string | null; // YYYY-MM-DD
  warehouseRef: string | null;
  priority: ProductionOrderPriority;
  source: ProductionOrderSource;
  producedQty: number;
  scrapQty: number;
  costSnapshot: CostSnapshot | null;
  consumed: boolean;
  materials: ProductionOrderMaterial[];
  operations: ProductionOrderOperation[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export class ProductionOrder {
  private constructor(private readonly props: Readonly<ProductionOrderProps>) {}

  static create(props: ProductionOrderProps): ProductionOrder {
    if (props.id <= 0) {
      throw new InvalidProductionOrderError('id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new InvalidProductionOrderError('companyId pozitif olmalı');
    }
    if (props.no.trim().length === 0) {
      throw new InvalidProductionOrderError('emir numarası boş olamaz');
    }
    if (props.productMaterialRef.trim().length === 0) {
      throw new InvalidProductionOrderError('mamul referansı boş olamaz');
    }
    if (!(props.qty > 0)) {
      throw new InvalidProductionOrderError('miktar pozitif olmalı');
    }
    if (props.producedQty < 0 || props.scrapQty < 0) {
      throw new InvalidProductionOrderError('üretilen/fire miktarı negatif olamaz');
    }
    return new ProductionOrder(props);
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
  get bomId(): number | null {
    return this.props.bomId;
  }
  get productMaterialRef(): string {
    return this.props.productMaterialRef;
  }
  get qty(): number {
    return this.props.qty;
  }
  get unit(): string | null {
    return this.props.unit;
  }
  get status(): ProductionOrderStatusValue {
    return this.props.status;
  }
  get plannedStart(): string | null {
    return this.props.plannedStart;
  }
  get plannedEnd(): string | null {
    return this.props.plannedEnd;
  }
  get warehouseRef(): string | null {
    return this.props.warehouseRef;
  }
  get priority(): ProductionOrderPriority {
    return this.props.priority;
  }
  get source(): ProductionOrderSource {
    return this.props.source;
  }
  get producedQty(): number {
    return this.props.producedQty;
  }
  get scrapQty(): number {
    return this.props.scrapQty;
  }
  get costSnapshot(): CostSnapshot | null {
    return this.props.costSnapshot;
  }
  get consumed(): boolean {
    return this.props.consumed;
  }
  get materials(): readonly ProductionOrderMaterial[] {
    return this.props.materials;
  }
  get operations(): readonly ProductionOrderOperation[] {
    return this.props.operations;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  /** Durum geçişi — VO geçersiz geçişte fırlatır. */
  transitionTo(to: ProductionOrderStatusValue, now: Date): ProductionOrder {
    const next = ProductionOrderStatus.of(this.props.status).assertTransition(to);
    return new ProductionOrder({ ...this.props, status: next.value, updatedAt: now });
  }

  /**
   * Emri tamamla: produced/scrap miktarlarını, maliyet snapshot'ını yaz,
   * completed_at'i damgala, tüketildi (consumed) işaretle.
   * Sadece in_progress → completed geçişine izin verilir (VO zorlar).
   */
  complete(
    input: { producedQty: number; scrapQty: number; costSnapshot: CostSnapshot | null },
    now: Date,
  ): ProductionOrder {
    if (input.producedQty < 0 || input.scrapQty < 0) {
      throw new InvalidProductionOrderError('üretilen/fire miktarı negatif olamaz');
    }
    const next = ProductionOrderStatus.of(this.props.status).assertTransition('completed');
    return new ProductionOrder({
      ...this.props,
      status: next.value,
      producedQty: input.producedQty,
      scrapQty: input.scrapQty,
      costSnapshot: input.costSnapshot,
      consumed: true,
      completedAt: now,
      updatedAt: now,
    });
  }

  toJSON(): Readonly<ProductionOrderProps> {
    return { ...this.props };
  }
}
