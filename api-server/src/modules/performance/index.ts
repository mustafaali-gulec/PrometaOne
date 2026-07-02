/**
 * Performans (Performance) modülü — Public API + DI.
 *
 * registerPerformanceModule(pool) Pg* repository + use-case'leri wire eder ve
 * Hono router döndürür. index.ts bunu `/v1/performance` altına mount eder.
 *
 * Kaynak-of-truth UI tarafında app-state blob'udur; bu modül POST /sync ile
 * yazılan SQL-sorgulanabilir aynayı (hr_perf_cycles / hr_perf_reviews) yönetir
 * (Report Studio + API erişimi için).
 */
import type { Pool } from 'pg';

import {
  ListPerfCyclesUseCase,
  ListPerfReviewsUseCase,
  SyncPerformanceUseCase,
} from './application/useCases/PerformanceUseCases.js';
import {
  PgPerfCycleRepository,
  PgPerfReviewRepository,
} from './infrastructure/persistence/PgPerformanceRepositories.js';
import { createPerformanceRouter, type PerformanceRouterDeps } from './presentation/routes.js';

export function registerPerformanceModule(pool: Pool): ReturnType<typeof createPerformanceRouter> {
  const cycles = new PgPerfCycleRepository(pool);
  const reviews = new PgPerfReviewRepository(pool);

  const deps: PerformanceRouterDeps = {
    syncPerformance: new SyncPerformanceUseCase(cycles, reviews),
    listPerfCycles: new ListPerfCyclesUseCase(cycles),
    listPerfReviews: new ListPerfReviewsUseCase(reviews),
  };

  return createPerformanceRouter(deps);
}
