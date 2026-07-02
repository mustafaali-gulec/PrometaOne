/**
 * Expense (Gider/Masraf) modülü — Public API + DI.
 *
 * registerExpenseModule(pool) Pg* repository + use-case'leri wire eder ve Hono
 * router döndürür. index.ts bunu `/v1/expense` altına mount eder.
 *
 * Gider kartı (expense_cards) kalıcı master kayıttır; Kasa Excel import'u saf
 * bir parser'dır (DB'siz) ve tespit ettiği kalemler bulk-upsert ile kartlara
 * dönüşür.
 */
import type { Pool } from 'pg';

import { SystemClock } from './application/ports/Clock.js';
import {
  BulkUpsertExpenseCardsUseCase,
  CreateExpenseCardUseCase,
  DeactivateExpenseCardUseCase,
  DeleteExpenseCardUseCase,
  ListExpenseCardsUseCase,
  UpdateExpenseCardUseCase,
} from './application/useCases/ExpenseCardUseCases.js';
import { ParseKasaImportUseCase } from './application/useCases/KasaImportUseCases.js';
import { PgExpenseCardRepository } from './infrastructure/persistence/PgExpenseCardRepository.js';
import { createExpenseRouter, type ExpenseRouterDeps } from './presentation/routes.js';

export function registerExpenseModule(pool: Pool): ReturnType<typeof createExpenseRouter> {
  const clock = SystemClock;

  const cards = new PgExpenseCardRepository(pool);

  const deps: ExpenseRouterDeps = {
    createExpenseCard: new CreateExpenseCardUseCase(cards),
    listExpenseCards: new ListExpenseCardsUseCase(cards),
    updateExpenseCard: new UpdateExpenseCardUseCase(cards, clock),
    deactivateExpenseCard: new DeactivateExpenseCardUseCase(cards, clock),
    deleteExpenseCard: new DeleteExpenseCardUseCase(cards),
    bulkUpsertExpenseCards: new BulkUpsertExpenseCardsUseCase(cards),
    parseKasaImport: new ParseKasaImportUseCase(),
  };

  return createExpenseRouter(deps);
}
