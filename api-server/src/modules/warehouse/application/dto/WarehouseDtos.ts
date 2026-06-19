/**
 * Warehouse DTO'ları.
 */
import type { Warehouse, WarehouseLocation } from '../../domain/entities/Warehouse.js';
import type { WarehouseStatus } from '../../domain/valueObjects/WarehouseStatus.js';

export interface WarehouseDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  unitName: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  manager: string | null;
  status: WarehouseStatus;
  locations: ReadonlyArray<WarehouseLocation>;
}

export function toWarehouseDto(w: Warehouse): WarehouseDto {
  return w.toJSON();
}
