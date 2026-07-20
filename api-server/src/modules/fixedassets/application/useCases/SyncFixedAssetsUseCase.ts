/**
 * SyncFixedAssets — full-state yansıtma (performance sync kalıbı).
 *
 * İstemci (App.jsx blob'u, kaynak-of-truth) şirketin TÜM kıymet kartı +
 * hareket + amortisman koşumlarını gönderir; repository (companyId, clientId)
 * anahtarına göre upsert eder ve prune=true ise payload'da olmayanları siler —
 * tümü TEK transaction'da (PgFixedAssetRepository.syncAll).
 */
import type { SyncFixedAssetsPayloadDto, SyncFixedAssetsResultDto } from '../dto/FixedAssetDtos.js';
import type { FixedAssetRepository } from '../ports/FixedAssetRepository.js';

export class SyncFixedAssetsUseCase {
  constructor(private readonly repo: FixedAssetRepository) {}

  async execute(input: SyncFixedAssetsPayloadDto): Promise<SyncFixedAssetsResultDto> {
    return this.repo.syncAll(input);
  }
}
