/**
 * GetAssetUseCase — bir varlığı atama geçmişiyle (ledger) döner.
 *
 * { asset, assignments } — assignments en yeni atama en üstte.
 */
import { toAssetAssignmentDto, type AssetAssignmentDto } from '../dto/AssetAssignmentDto.js';
import { toAssetDto, type AssetDto } from '../dto/AssetDto.js';
import { AssetNotFoundError } from '../errors/HrErrors.js';
import type { AssetRepository } from '../ports/AssetRepository.js';

export interface GetAssetInput {
  companyId: number;
  assetId: number;
}

export interface GetAssetResult {
  asset: AssetDto;
  assignments: ReadonlyArray<AssetAssignmentDto>;
}

export class GetAssetUseCase {
  constructor(private readonly assets: AssetRepository) {}

  async execute(input: GetAssetInput): Promise<GetAssetResult> {
    const asset = await this.assets.findAssetById(input.assetId, input.companyId);
    if (!asset) {
      throw new AssetNotFoundError(input.assetId);
    }
    const assignments = await this.assets.listAssignments({
      companyId: input.companyId,
      assetId: input.assetId,
    });
    return {
      asset: toAssetDto(asset),
      assignments: assignments.map(toAssetAssignmentDto),
    };
  }
}
