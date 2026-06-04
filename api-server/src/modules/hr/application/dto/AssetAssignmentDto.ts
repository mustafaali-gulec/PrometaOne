/**
 * AssetAssignmentDto — REST response için (zimmet atama/iade ledger satırı).
 */
import type { AssetAssignment } from '../../domain/entities/AssetAssignment.js';

export interface AssetAssignmentDto {
  id: number;
  companyId: number;
  assetId: number;
  employeeId: number;
  /** ISO timestamp. */
  assignedAt: string;
  assignedByUserId: number | null;
  /** ISO timestamp veya null (açık atama). */
  returnedAt: string | null;
  returnedByUserId: number | null;
  returnNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toAssetAssignmentDto(a: AssetAssignment): AssetAssignmentDto {
  return {
    id: a.id,
    companyId: a.companyId,
    assetId: a.assetId,
    employeeId: a.employeeId,
    assignedAt: a.assignedAt.toISOString(),
    assignedByUserId: a.assignedByUserId,
    returnedAt: a.returnedAt ? a.returnedAt.toISOString() : null,
    returnedByUserId: a.returnedByUserId,
    returnNote: a.returnNote,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}
