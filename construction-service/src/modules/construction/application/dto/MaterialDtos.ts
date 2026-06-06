/**
 * Malzeme & Depo DTO'ları — malzeme, depo, stok, hareket, talep.
 */
import type { Material } from '../../domain/entities/Material.js';
import type { MaterialRequest } from '../../domain/entities/MaterialRequest.js';
import type { StockMovement } from '../../domain/entities/StockMovement.js';
import type { Warehouse } from '../../domain/entities/Warehouse.js';
import type { MaterialRequestStatus, StockMoveKind } from '../../domain/valueObjects/Material.js';

export interface MaterialDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  unit: string;
  wastePct: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseDto {
  id: number;
  companyId: number;
  projectId: number;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockDto {
  warehouseId: number;
  warehouseName: string;
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  qty: number;
}

export interface StockMovementDto {
  id: number;
  materialId: number;
  kind: StockMoveKind;
  fromWarehouse: number | null;
  toWarehouse: number | null;
  qty: number;
  unitCost: number;
  boqLineId: number | null;
  description: string | null;
  movedAt: string;
  createdAt: string;
}

export interface MaterialRequestLineDto {
  id: number;
  materialId: number;
  qty: number;
  note: string | null;
}

export interface MaterialRequestDto {
  id: number;
  companyId: number;
  projectId: number;
  reqNo: string;
  status: MaterialRequestStatus;
  neededBy: string | null;
  note: string | null;
  approvedBy: number | null;
  createdAt: string;
  updatedAt: string;
  lines: MaterialRequestLineDto[];
}

export type MaterialRequestSummaryDto = Omit<MaterialRequestDto, 'lines'>;

export function toMaterialDto(m: Material): MaterialDto {
  const j = m.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    code: j.code,
    name: j.name,
    unit: j.unit,
    wastePct: j.wastePct,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export function toWarehouseDto(w: Warehouse): WarehouseDto {
  const j = w.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    code: j.code,
    name: j.name,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export function toStockMovementDto(s: StockMovement): StockMovementDto {
  const j = s.toJSON();
  return {
    id: j.id,
    materialId: j.materialId,
    kind: j.kind,
    fromWarehouse: j.fromWarehouse,
    toWarehouse: j.toWarehouse,
    qty: j.qty,
    unitCost: j.unitCost,
    boqLineId: j.boqLineId,
    description: j.description,
    movedAt: j.movedAt,
    createdAt: j.createdAt.toISOString(),
  };
}

export function toMaterialRequestDto(r: MaterialRequest): MaterialRequestDto {
  const j = r.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    reqNo: j.reqNo,
    status: j.status,
    neededBy: j.neededBy,
    note: j.note,
    approvedBy: j.approvedBy,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    lines: j.lines.map((l) => ({ ...l })),
  };
}

export function toMaterialRequestSummaryDto(r: MaterialRequest): MaterialRequestSummaryDto {
  const { lines: _l, ...rest } = toMaterialRequestDto(r);
  return rest;
}
