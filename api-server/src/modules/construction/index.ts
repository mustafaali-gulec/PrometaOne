/**
 * Construction (Şantiye Yönetim) modülü — Public API + DI.
 *
 * registerConstructionModule(pool) Pg* repository + use-case'leri wire eder ve
 * Hono router döndürür. src/index.ts bunu `/v1/construction` altına mount eder.
 *
 * Faz SF-1 kapsamı: Projeler (özel/ihaleli) + Sözleşmeler (işveren/taşeron + ihale
 * bilgisi). Sonraki fazlar: keşif/pursantaj (SF-2), hakediş (SF-3), harcama (SF-4),
 * malzeme/depo (SF-5), işgücü/makine (SF-6).
 */
import type { Pool } from 'pg';

import { SystemClock } from './application/ports/Clock.js';
import {
  CreateContractUseCase,
  ListContractsUseCase,
  UpdateContractUseCase,
} from './application/useCases/ContractUseCases.js';
import {
  ChangeProjectStatusUseCase,
  CreateProjectUseCase,
  DeactivateProjectUseCase,
  ListProjectsUseCase,
  UpdateProjectUseCase,
} from './application/useCases/ProjectUseCases.js';
import { PgContractRepository } from './infrastructure/persistence/PgContractRepository.js';
import { PgProjectRepository } from './infrastructure/persistence/PgProjectRepository.js';
import { createConstructionRouter, type ConstructionRouterDeps } from './presentation/routes.js';

export function registerConstructionModule(
  pool: Pool,
): ReturnType<typeof createConstructionRouter> {
  const clock = SystemClock;

  const projects = new PgProjectRepository(pool);
  const contracts = new PgContractRepository(pool);

  const deps: ConstructionRouterDeps = {
    createProject: new CreateProjectUseCase(projects),
    listProjects: new ListProjectsUseCase(projects),
    updateProject: new UpdateProjectUseCase(projects, clock),
    changeProjectStatus: new ChangeProjectStatusUseCase(projects, clock),
    deactivateProject: new DeactivateProjectUseCase(projects, clock),
    createContract: new CreateContractUseCase(contracts, projects, clock),
    listContracts: new ListContractsUseCase(contracts),
    updateContract: new UpdateContractUseCase(contracts, clock),
  };

  return createConstructionRouter(deps);
}
