/**
 * Sabit Kıymet repository PORT'u — application katmanı bu interface'e
 * bağımlıdır, infrastructure (PgFixedAssetRepository) implemente eder.
 *
 * Full-state sync modeli (performance kalıbı): syncAll (companyId, clientId)
 * anahtarına göre upsert eder; prune=true ise şirketin payload'da OLMAYAN
 * satırlarını siler (istemci blob'u kaynak-of-truth olduğundan tam yansıtma).
 * Üç koleksiyon (assets + movements + runs) TEK transaction'da yazılır.
 */
import type {
  DepreciationRunDto,
  FixedAssetDto,
  FixedAssetMovementDto,
  SyncFixedAssetsPayloadDto,
  SyncFixedAssetsResultDto,
} from '../dto/FixedAssetDtos.js';

export interface FixedAssetRepository {
  listAssets(companyId: number): Promise<FixedAssetDto[]>;
  listMovements(companyId: number): Promise<FixedAssetMovementDto[]>;
  listRuns(companyId: number): Promise<DepreciationRunDto[]>;
  /** Tek transaction: upsert by (companyId, clientId) + prune=true ise payload dışını sil. */
  syncAll(payload: SyncFixedAssetsPayloadDto): Promise<SyncFixedAssetsResultDto>;
}
