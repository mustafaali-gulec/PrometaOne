/**
 * Yardımcı (aux) WMS entity DTO'ları:
 *   MaterialGroup, Unit, Variant, MaterialRequest, InventoryCount, Assignment.
 */
import type { Assignment, AssignmentItem } from '../../domain/entities/Assignment.js';
import type { InventoryCount, InventoryCountItem } from '../../domain/entities/InventoryCount.js';
import type { MaterialGroup } from '../../domain/entities/MaterialGroup.js';
import type {
  MaterialRequest,
  MaterialRequestItem,
} from '../../domain/entities/MaterialRequest.js';
import type { Unit } from '../../domain/entities/Unit.js';
import type { Variant, VariantOption } from '../../domain/entities/Variant.js';
import type {
  AssignmentStatus,
  GroupStatus,
  InventoryCountStatus,
  MaterialRequestStatus,
  VariantStatus,
} from '../../domain/valueObjects/AuxStatuses.js';

// --- MaterialGroup ---------------------------------------------------------
export interface MaterialGroupDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  status: GroupStatus;
}

export function toMaterialGroupDto(g: MaterialGroup): MaterialGroupDto {
  return g.toJSON();
}

// --- Unit ------------------------------------------------------------------
export interface UnitDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
}

export function toUnitDto(u: Unit): UnitDto {
  return u.toJSON();
}

// --- Variant ---------------------------------------------------------------
export interface VariantDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  status: VariantStatus;
  options: ReadonlyArray<VariantOption>;
}

export function toVariantDto(v: Variant): VariantDto {
  return v.toJSON();
}

// --- MaterialRequest -------------------------------------------------------
export interface MaterialRequestDto {
  id: number;
  companyId: number;
  no: string;
  date: string;
  requesterUnit: string | null;
  requester: string | null;
  requestedWarehouseId: number | null;
  validityDays: number | null;
  status: MaterialRequestStatus;
  items: ReadonlyArray<MaterialRequestItem>;
  note: string | null;
  rejectReason: string | null;
}

export function toMaterialRequestDto(r: MaterialRequest): MaterialRequestDto {
  return r.toJSON();
}

// --- InventoryCount --------------------------------------------------------
export interface InventoryCountDto {
  id: number;
  companyId: number;
  no: string;
  date: string;
  warehouseId: number;
  period: string | null;
  status: InventoryCountStatus;
  items: ReadonlyArray<InventoryCountItem>;
}

export function toInventoryCountDto(c: InventoryCount): InventoryCountDto {
  return c.toJSON();
}

// --- Assignment ------------------------------------------------------------
export interface AssignmentDto {
  id: number;
  companyId: number;
  no: string;
  date: string;
  person: string | null;
  birim: string | null;
  status: AssignmentStatus;
  items: ReadonlyArray<AssignmentItem>;
  note: string | null;
}

export function toAssignmentDto(a: Assignment): AssignmentDto {
  return a.toJSON();
}
