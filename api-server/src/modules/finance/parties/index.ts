/**
 * Cari (party) modülü — Public API + DI composition root.
 *
 * registerPartiesModule(pool) Pg repo + use-case'leri wire eder, Hono router
 * döndürür. api-server/src/index.ts `/v1/finance` altına mount eder
 * (paths: /parties, /parties/bulk-import).
 */
import type { Pool } from 'pg';

import type {
  BulkImportPartiesRequestDto,
  BulkImportPartiesResultDto,
  PartyImportItemDto,
  PartyImportMode,
} from './application/dto/PartyDto.js';
import type { PartyRepository } from './application/ports/PartyRepository.js';
import { BulkImportPartiesUseCase } from './application/useCases/BulkImportPartiesUseCase.js';
import { ListPartiesUseCase } from './application/useCases/ListPartiesUseCase.js';
import { Party } from './domain/entities/Party.js';
import type { PartyProps } from './domain/entities/Party.js';
import { PgPartyRepository } from './infrastructure/persistence/PgPartyRepository.js';
import { createPartiesRouter } from './presentation/routes.js';

// Public API re-exports
export { Party };
export type { PartyProps, PartyRepository };
export { BulkImportPartiesUseCase, ListPartiesUseCase };
export type {
  BulkImportPartiesRequestDto,
  BulkImportPartiesResultDto,
  PartyImportItemDto,
  PartyImportMode,
};
export { PgPartyRepository };

export function registerPartiesModule(pool: Pool): ReturnType<typeof createPartiesRouter> {
  const parties = new PgPartyRepository(pool);
  return createPartiesRouter({
    bulkImportParties: new BulkImportPartiesUseCase(parties),
    listParties: new ListPartiesUseCase(parties),
  });
}
