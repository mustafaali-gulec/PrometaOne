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
import { PgAccessProjectionRepository } from './infrastructure/persistence/PgAccessProjectionRepository.js';
import { PgAppStateRepository } from './infrastructure/persistence/PgAppStateRepository.js';
import { PgMirrorRepository } from './infrastructure/persistence/PgMirrorRepository.js';
import { createAppStateRouter, type AppStateRouterDeps } from './presentation/routes.js';

export function registerAppStateModule(pool: Pool): ReturnType<typeof createAppStateRouter> {
  const clock = SystemClock;

  const repo = new PgAppStateRepository(pool);
  // SQL aynası (app_state_entities) — PUT sonrası fire-and-forget fan-out.
  const mirror = new PgMirrorRepository(pool);
  // RBAC projeksiyonu (access_*) — PUT sonrası ikinci fire-and-forget fan-out.
  const accessMirror = new PgAccessProjectionRepository(pool);

  const deps: AppStateRouterDeps = {
    getAppState: new GetAppStateUseCase(repo),
    setAppState: new SetAppStateUseCase(repo, clock, mirror, accessMirror),
  };

  return createAppStateRouter(deps);
}
