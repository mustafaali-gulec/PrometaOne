/**
 * AssetRepository — port (asset + assignment ledger cohesive).
 *
 * Concrete: infrastructure/persistence/PgAssetRepository.ts.
 */
import type { Asset } from '../../domain/entities/Asset.js';
import type { AssetAssignment } from '../../domain/entities/AssetAssignment.js';
import type { AssetStatus } from '../../domain/valueObjects/AssetStatus.js';
import type { AssetType } from '../../domain/valueObjects/AssetType.js';

export interface AssetRepository {
  // --- assets ---
  createAsset(input: NewAssetInput): Promise<Asset>;

  findAssetById(id: number, companyId: number): Promise<Asset | null>;

  listAssets(filter: {
    companyId: number;
    status?: AssetStatus;
    assignedEmployeeId?: number;
    type?: AssetType;
  }): Promise<ReadonlyArray<Asset>>;

  updateAsset(asset: Asset): Promise<void>;

  // --- assignments (ledger) ---
  createAssignment(input: NewAssetAssignmentInput): Promise<AssetAssignment>;

  /** Bir varlığın açık (returned_at IS NULL) ataması — 0 veya 1. */
  findOpenAssignmentForAsset(assetId: number, companyId: number): Promise<AssetAssignment | null>;

  closeAssignment(assignment: AssetAssignment): Promise<void>;

  listAssignments(filter: {
    companyId: number;
    assetId?: number;
    employeeId?: number;
  }): Promise<ReadonlyArray<AssetAssignment>>;
}

export interface NewAssetInput {
  companyId: number;
  assetType: AssetType;
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  status: AssetStatus;
  assignedEmployeeId: number | null;
  notes: string | null;
}

export interface NewAssetAssignmentInput {
  companyId: number;
  assetId: number;
  employeeId: number;
  assignedAt: Date;
  assignedByUserId: number | null;
}
