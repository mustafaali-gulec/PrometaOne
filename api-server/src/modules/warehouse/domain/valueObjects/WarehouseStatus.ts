/**
 * WarehouseStatus — depo durumu.
 *
 * DB ENUM `warehouse_status` (034): active / passive.
 *   active  — kullanımda
 *   passive — kapalı / arşiv (yeni hareket girilemez)
 */
import { InvalidWarehouseStatusError } from '../errors/WarehouseErrors.js';

export type WarehouseStatus = 'active' | 'passive';

export const ALL_WAREHOUSE_STATUSES: ReadonlyArray<WarehouseStatus> = ['active', 'passive'];

export function isWarehouseStatus(value: unknown): value is WarehouseStatus {
  return (
    typeof value === 'string' && (ALL_WAREHOUSE_STATUSES as ReadonlyArray<string>).includes(value)
  );
}

export function toWarehouseStatus(value: unknown): WarehouseStatus {
  if (!isWarehouseStatus(value)) {
    throw new InvalidWarehouseStatusError(value);
  }
  return value;
}
