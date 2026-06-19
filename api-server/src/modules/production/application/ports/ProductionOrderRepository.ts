/**
 * ProductionOrderRepository — üretim emri kalıcılık portu.
 *
 * Aggregate: ProductionOrder + materials + operations birlikte yazılır/okunur.
 * Concrete: infrastructure/persistence/PgProductionOrderRepository.ts.
 */
import type {
  CostSnapshot,
  ProductionOrder,
  ProductionOrderMaterial,
  ProductionOrderOperation,
  ProductionOrderPriority,
  ProductionOrderSource,
} from '../../domain/entities/ProductionOrder.js';
import type { ProductionOrderStatusValue } from '../../domain/valueObjects/ProductionOrderStatus.js';

export interface NewProductionOrderInput {
  companyId: number;
  no: string;
  bomId: number | null;
  productMaterialRef: string;
  qty: number;
  unit: string | null;
  status: ProductionOrderStatusValue;
  plannedStart: string | null;
  plannedEnd: string | null;
  warehouseRef: string | null;
  priority: ProductionOrderPriority;
  source: ProductionOrderSource;
  producedQty: number;
  scrapQty: number;
  costSnapshot: CostSnapshot | null;
  consumed: boolean;
  materials: Omit<ProductionOrderMaterial, 'id'>[];
  operations: Omit<ProductionOrderOperation, 'id'>[];
}

export interface ProductionOrderRepository {
  insert(input: NewProductionOrderInput): Promise<ProductionOrder>;
  /** Başlık alanlarını günceller (materials/operations sabit kalır). */
  update(order: ProductionOrder): Promise<void>;
  findById(id: number, companyId: number): Promise<ProductionOrder | null>;
  listByCompany(
    companyId: number,
    options?: { status?: ProductionOrderStatusValue },
  ): Promise<ReadonlyArray<ProductionOrder>>;
  existsByNo(companyId: number, no: string, excludeId?: number): Promise<boolean>;
}
