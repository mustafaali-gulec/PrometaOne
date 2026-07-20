/**
 * Sabit Kıymet liste use-case'leri — GET /assets, /movements, /runs.
 * SQL aynasını companyId ile okur; iş kuralı yazmaz.
 */
import type {
  DepreciationRunDto,
  FixedAssetDto,
  FixedAssetMovementDto,
} from '../dto/FixedAssetDtos.js';
import type { FixedAssetRepository } from '../ports/FixedAssetRepository.js';

export interface ListByCompanyInput {
  companyId: number;
}

export class ListFixedAssetsUseCase {
  constructor(private readonly repo: FixedAssetRepository) {}

  async execute(input: ListByCompanyInput): Promise<FixedAssetDto[]> {
    return this.repo.listAssets(input.companyId);
  }
}

export class ListFixedAssetMovementsUseCase {
  constructor(private readonly repo: FixedAssetRepository) {}

  async execute(input: ListByCompanyInput): Promise<FixedAssetMovementDto[]> {
    return this.repo.listMovements(input.companyId);
  }
}

export class ListDepreciationRunsUseCase {
  constructor(private readonly repo: FixedAssetRepository) {}

  async execute(input: ListByCompanyInput): Promise<DepreciationRunDto[]> {
    return this.repo.listRuns(input.companyId);
  }
}
