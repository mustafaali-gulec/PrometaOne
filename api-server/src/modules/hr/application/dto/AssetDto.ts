/**
 * AssetDto — REST response için.
 */
import type { Asset } from '../../domain/entities/Asset.js';
import type { AssetStatus } from '../../domain/valueObjects/AssetStatus.js';
import type { AssetType } from '../../domain/valueObjects/AssetType.js';

export interface AssetDto {
  id: number;
  companyId: number;
  assetType: AssetType;
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  status: AssetStatus;
  assignedEmployeeId: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toAssetDto(asset: Asset): AssetDto {
  return {
    id: asset.id,
    companyId: asset.companyId,
    assetType: asset.assetType,
    name: asset.name,
    brand: asset.brand,
    model: asset.model,
    serialNo: asset.serialNo,
    status: asset.status,
    assignedEmployeeId: asset.assignedEmployeeId,
    notes: asset.notes,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}
