/**
 * AppState (Uygulama Durumu) modülü — Public API + DI.
 *
 * registerAppStateModule(pool) Pg* repository + use-case'leri wire eder ve Hono
 * router döndürür. index.ts bunu `/v1/app-state` altına mount eder.
 *
 * Genel amaçlı key→JSONB deposu: frontend'in localStorage blob'unu sunucuya
 * taşır. (scope, key) anahtarıdır; value çok-MB JSON nesnesi olabilir.
 */
import type { Pool } from 'pg';

import { SystemClock } from './application/ports/Clock.js';
import { GetAppStateUseCase, SetAppStateUseCase } from './application/useCases/AppStateUseCases.js';
import { PgAppStateRepository } from './infrastructure/persistence/PgAppStateRepository.js';
import { createAppStateRouter, type AppStateRouterDeps } from './presentation/routes.js';

export function registerAppStateModule(pool: Pool): ReturnType<typeof createAppStateRouter> {
  const clock = SystemClock;

  const repo = new PgAppStateRepository(pool);

  const deps: AppStateRouterDeps = {
    getAppState: new GetAppStateUseCase(repo),
    setAppState: new SetAppStateUseCase(repo, clock),
  };

  return createAppStateRouter(deps);
}
