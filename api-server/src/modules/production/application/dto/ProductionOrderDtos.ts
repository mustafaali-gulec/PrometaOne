/**
 * ProductionOrder (üretim emri) DTO'ları.
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

export interface ProductionOrderMaterialDto {
  id: number | null;
  materialRef: string;
  requiredQty: number;
  unit: string | null;
  consumedQty: number;
}

export interface ProductionOrderOperationDto {
  id: number | null;
  workCenterId: number | null;
  name: string;
  plannedMin: number;
  status: 'pending' | 'done';
  seq: number;
}

export interface ProductionOrderDto {
  id: number;
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
  materials: ProductionOrderMaterialDto[];
  operations: ProductionOrderOperationDto[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

function toMaterialDto(m: ProductionOrderMaterial): ProductionOrderMaterialDto {
  return {
    id: m.id ?? null,
    materialRef: m.materialRef,
    requiredQty: m.requiredQty,
    unit: m.unit,
    consumedQty: m.consumedQty,
  };
}

function toOperationDto(o: ProductionOrderOperation): ProductionOrderOperationDto {
  return {
    id: o.id ?? null,
    workCenterId: o.workCenterId,
    name: o.name,
    plannedMin: o.plannedMin,
    status: o.status,
    seq: o.seq,
  };
}

export function toProductionOrderDto(o: ProductionOrder): ProductionOrderDto {
  const j = o.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    no: j.no,
    bomId: j.bomId,
    productMaterialRef: j.productMaterialRef,
    qty: j.qty,
    unit: j.unit,
    status: j.status,
    plannedStart: j.plannedStart,
    plannedEnd: j.plannedEnd,
    warehouseRef: j.warehouseRef,
    priority: j.priority,
    source: j.source,
    producedQty: j.producedQty,
    scrapQty: j.scrapQty,
    costSnapshot: j.costSnapshot,
    consumed: j.consumed,
    materials: j.materials.map(toMaterialDto),
    operations: j.operations.map(toOperationDto),
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    completedAt: j.completedAt ? j.completedAt.toISOString() : null,
  };
}
