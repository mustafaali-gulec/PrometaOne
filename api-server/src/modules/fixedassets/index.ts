/**
 * Sabit Kıymet (Fixed Assets) modülü — Public API + DI composition root.
 *
 * registerFixedAssetsModule(pool) PgFixedAssetRepository + use-case'leri +
 * DepreciationCalculator'ı wire eder ve Hono router döndürür.
 * api-server/src/index.ts bunu `/v1/fixed-assets` altına mount eder.
 *
 * Kaynak-of-truth UI tarafında app-state blob'udur; bu modül POST /sync ile
 * yazılan SQL-sorgulanabilir aynayı (fixed_assets / fixed_asset_movements /
 * fixed_asset_depreciation_runs) yönetir (Report Studio + API erişimi için)
 * ve VUK amortisman hesabını (POST /depreciation/preview) sunar.
 */
import type { Pool } from 'pg';

import {
  ListDepreciationRunsUseCase,
  ListFixedAssetMovementsUseCase,
  ListFixedAssetsUseCase,
} from './application/useCases/ListUseCases.js';
import { SyncFixedAssetsUseCase } from './application/useCases/SyncFixedAssetsUseCase.js';
import { DepreciationCalculator } from './domain/services/DepreciationCalculator.js';
import { PgFixedAssetRepository } from './infrastructure/persistence/PgFixedAssetRepository.js';
import { createFixedAssetsRouter, type FixedAssetsRouterDeps } from './presentation/routes.js';

export function registerFixedAssetsModule(pool: Pool): ReturnType<typeof createFixedAssetsRouter> {
  const repo = new PgFixedAssetRepository(pool);

  const deps: FixedAssetsRouterDeps = {
    syncFixedAssets: new SyncFixedAssetsUseCase(repo),
    listAssets: new ListFixedAssetsUseCase(repo),
    listMovements: new ListFixedAssetMovementsUseCase(repo),
    listRuns: new ListDepreciationRunsUseCase(repo),
    depreciationCalculator: new DepreciationCalculator(),
  };

  return createFixedAssetsRouter(deps);
}
