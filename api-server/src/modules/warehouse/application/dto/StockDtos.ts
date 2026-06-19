/**
 * Stok hareketi & seviye DTO'ları.
 */
import type { MovementLot, StockMovement } from '../../domain/entities/StockMovement.js';
import type { MovementKind } from '../../domain/valueObjects/MovementKind.js';

export interface StockMovementDto {
  id: number | null;
  companyId: number;
  no: string;
  kind: MovementKind;
  subType: string | null;
  date: string;
  warehouseId: number | null;
  fromWarehouseId: number | null;
  toWarehouseId: number | null;
  materialId: number;
  qty: number;
  unit: string;
  factor: number;
  baseUnit: string;
  baseQty: number;
  unitPrice: number | null;
  unitCostBase: number | null;
  total: number | null;
  lots: ReadonlyArray<MovementLot>;
  locationId: number | null;
  partyId: number | null;
  person: string | null;
  docNo: string | null;
  note: string | null;
  createdBy: number | null;
  createdAt: string;
}

export function toStockMovementDto(m: StockMovement): StockMovementDto {
  return m.toJSON();
}

export interface StockLevelDto {
  materialId: number;
  warehouseId: number;
  baseUnit: string;
  baseQty: number;
}

export interface MaterialLedgerRowDto {
  movementId: number | null;
  no: string;
  date: string;
  kind: MovementKind;
  warehouseId: number | null;
  fromWarehouseId: number | null;
  toWarehouseId: number | null;
  /** Bu hareketin belirtilen depo (veya tüm depolar) bazındaki signed delta'sı. */
  delta: number;
  /** Hareket sonrası yürüyen bakiye (base birim). */
  runningBalance: number;
  note: string | null;
}
