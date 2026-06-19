/**
 * Yardımcı (aux) WMS entity'leri için durum value object'leri.
 *
 * DB ENUM'larıyla birebir (035_warehouse_aux.sql):
 *   group_status            — active / passive   (MaterialGroup)
 *   variant_status          — active / passive   (Variant)
 *   material_request_status — pending / approved / rejected / fulfilled
 *   inventory_count_status  — open / applied
 *   assignment_status       — open / returned
 *
 * (MaterialGroup/Variant aktif/pasif; iş akışı entity'leri kendi durum
 * makinelerini taşır — bkz. ilgili use-case'ler.)
 */
import {
  InvalidAssignmentStatusError,
  InvalidGroupStatusError,
  InvalidInventoryCountStatusError,
  InvalidMaterialRequestStatusError,
  InvalidVariantStatusError,
} from '../errors/WarehouseErrors.js';

// --- MaterialGroup ---------------------------------------------------------
export type GroupStatus = 'active' | 'passive';
export const ALL_GROUP_STATUSES: ReadonlyArray<GroupStatus> = ['active', 'passive'];
export function isGroupStatus(value: unknown): value is GroupStatus {
  return typeof value === 'string' && (ALL_GROUP_STATUSES as ReadonlyArray<string>).includes(value);
}
export function toGroupStatus(value: unknown): GroupStatus {
  if (!isGroupStatus(value)) {
    throw new InvalidGroupStatusError(value);
  }
  return value;
}

// --- Variant ---------------------------------------------------------------
export type VariantStatus = 'active' | 'passive';
export const ALL_VARIANT_STATUSES: ReadonlyArray<VariantStatus> = ['active', 'passive'];
export function isVariantStatus(value: unknown): value is VariantStatus {
  return (
    typeof value === 'string' && (ALL_VARIANT_STATUSES as ReadonlyArray<string>).includes(value)
  );
}
export function toVariantStatus(value: unknown): VariantStatus {
  if (!isVariantStatus(value)) {
    throw new InvalidVariantStatusError(value);
  }
  return value;
}

// --- MaterialRequest (Malzeme Talep) ---------------------------------------
export type MaterialRequestStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled';
export const ALL_MATERIAL_REQUEST_STATUSES: ReadonlyArray<MaterialRequestStatus> = [
  'pending',
  'approved',
  'rejected',
  'fulfilled',
];
export function isMaterialRequestStatus(value: unknown): value is MaterialRequestStatus {
  return (
    typeof value === 'string' &&
    (ALL_MATERIAL_REQUEST_STATUSES as ReadonlyArray<string>).includes(value)
  );
}
export function toMaterialRequestStatus(value: unknown): MaterialRequestStatus {
  if (!isMaterialRequestStatus(value)) {
    throw new InvalidMaterialRequestStatusError(value);
  }
  return value;
}

// --- InventoryCount (Envanter Sayım) ---------------------------------------
export type InventoryCountStatus = 'open' | 'applied';
export const ALL_INVENTORY_COUNT_STATUSES: ReadonlyArray<InventoryCountStatus> = [
  'open',
  'applied',
];
export function isInventoryCountStatus(value: unknown): value is InventoryCountStatus {
  return (
    typeof value === 'string' &&
    (ALL_INVENTORY_COUNT_STATUSES as ReadonlyArray<string>).includes(value)
  );
}
export function toInventoryCountStatus(value: unknown): InventoryCountStatus {
  if (!isInventoryCountStatus(value)) {
    throw new InvalidInventoryCountStatusError(value);
  }
  return value;
}

// --- Assignment (Zimmet) ---------------------------------------------------
export type AssignmentStatus = 'open' | 'returned';
export const ALL_ASSIGNMENT_STATUSES: ReadonlyArray<AssignmentStatus> = ['open', 'returned'];
export function isAssignmentStatus(value: unknown): value is AssignmentStatus {
  return (
    typeof value === 'string' && (ALL_ASSIGNMENT_STATUSES as ReadonlyArray<string>).includes(value)
  );
}
export function toAssignmentStatus(value: unknown): AssignmentStatus {
  if (!isAssignmentStatus(value)) {
    throw new InvalidAssignmentStatusError(value);
  }
  return value;
}
