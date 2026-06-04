/**
 * ListAssetsUseCase — şirketin varlık havuzu listesi
 * (filter: status, assignedEmployeeId, type).
 */
import type { AssetStatus } from '../../domain/valueObjects/AssetStatus.js';
import type { AssetType } from '../../domain/valueObjects/AssetType.js';
import { toAssetDto, type AssetDto } from '../dto/AssetDto.js';
import type { AssetRepository } from '../ports/AssetRepository.js';

export interface ListAssetsInput {
  companyId: number;
  status?: AssetStatus;
  assignedEmployeeId?: number;
  type?: AssetType;
}

export class ListAssetsUseCase {
  constructor(private readonly assets: AssetRepository) {}

  async execute(input: ListAssetsInput): Promise<ReadonlyArray<AssetDto>> {
    const filter: {
      companyId: number;
      status?: AssetStatus;
      assignedEmployeeId?: number;
      type?: AssetType;
    } = { companyId: input.companyId };
    if (input.status !== undefined) filter.status = input.status;
    if (input.assignedEmployeeId !== undefined)
      filter.assignedEmployeeId = input.assignedEmployeeId;
    if (input.type !== undefined) filter.type = input.type;
    const list = await this.assets.listAssets(filter);
    return list.map(toAssetDto);
  }
}
