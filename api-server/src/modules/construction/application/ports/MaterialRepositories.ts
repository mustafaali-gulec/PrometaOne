/**
 * Malzeme & Depo kalıcılık portları: malzeme, depo, stok+hareket, talep.
 */
import type { Material } from '../../domain/entities/Material.js';
import type { MaterialRequest } from '../../domain/entities/MaterialRequest.js';
import type { StockMovement } from '../../domain/entities/StockMovement.js';
import type { Warehouse } from '../../domain/entities/Warehouse.js';
import type { MaterialRequestStatus, StockMoveKind } from '../../domain/valueObjects/Material.js';

// ===== Material =============================================================
export interface NewMaterialInput {
  companyId: number;
  code: string;
  name: string;
  unit: string;
  wastePct: number;
  createdBy: number | null;
}
export interface MaterialRepository {
  insert(input: NewMaterialInput): Promise<Material>;
  update(m: Material): Promise<void>;
  findById(id: number, companyId: number): Promise<Material | null>;
  listByCompany(companyId: number, includeInactive?: boolean): Promise<ReadonlyArray<Material>>;
  existsByCode(companyId: number, code: string): Promise<boolean>;
}

// ===== Warehouse ============================================================
export interface NewWarehouseInput {
  companyId: number;
  projectId: number;
  code: string;
  name: string;
}
export interface WarehouseRepository {
  insert(input: NewWarehouseInput): Promise<Warehouse>;
  update(w: Warehouse): Promise<void>;
  findById(id: number, companyId: number): Promise<Warehouse | null>;
  listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Warehouse>>;
  existsByCode(companyId: number, code: string): Promise<boolean>;
}

// ===== Stock + Movements ====================================================
export interface NewStockMovementInput {
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
}

export interface StockView {
  warehouseId: number;
  warehouseName: string;
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  qty: number;
}

export interface StockRepository {
  /** Hareketi kaydeder ve stok cache'ini transaction içinde günceller. */
  recordMovement(input: NewStockMovementInput): Promise<StockMovement>;
  listStockByProject(projectId: number, companyId: number): Promise<ReadonlyArray<StockView>>;
  listMovementsByProject(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<StockMovement>>;
}

// ===== Material Requests ====================================================
export interface NewMaterialRequestLineInput {
  materialId: number;
  qty: number;
  note: string | null;
}
export interface NewMaterialRequestInput {
  companyId: number;
  projectId: number;
  reqNo: string;
  neededBy: string | null;
  note: string | null;
  requestedBy: number | null;
  lines: ReadonlyArray<NewMaterialRequestLineInput>;
}
export interface MreqStatusChange {
  toStatus: MaterialRequestStatus;
  approvedBy: number | null;
}
export interface MaterialRequestRepository {
  insert(input: NewMaterialRequestInput): Promise<MaterialRequest>;
  findById(id: number, companyId: number): Promise<MaterialRequest | null>;
  listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<MaterialRequest>>;
  countByProject(projectId: number, companyId: number): Promise<number>;
  replaceLines(
    id: number,
    companyId: number,
    lines: ReadonlyArray<NewMaterialRequestLineInput>,
  ): Promise<MaterialRequest>;
  changeStatus(id: number, companyId: number, change: MreqStatusChange): Promise<MaterialRequest>;
}
