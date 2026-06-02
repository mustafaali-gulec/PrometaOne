/**
 * Finance modülü — Public API + DI (Faz 5 / PR 6b).
 *
 * registerFinanceModule(pool) tüm Pg* repository + use-case'leri wire eder
 * ve Hono router döndürür. app.ts bunu `/v1/finance` altına mount eder.
 */
import type { Pool } from 'pg';

import { SystemClock } from './application/ports/Clock.js';
import {
  ArchiveBankAccountUseCase,
  ArchiveKasaAccountUseCase,
  CreateBankAccountUseCase,
  CreateKasaAccountUseCase,
  ListBankAccountsUseCase,
  ListKasaAccountsUseCase,
} from './application/useCases/AccountUseCases.js';
import {
  BulkSetCellsUseCase,
  GetBudgetMatrixUseCase,
  SetCellValueUseCase,
} from './application/useCases/BudgetMatrixUseCases.js';
import {
  CreateTransferUseCase,
  GetCashPositionUseCase,
  ListTransfersUseCase,
  RecordKasaEntryUseCase,
} from './application/useCases/CashFlowUseCases.js';
import {
  ArchiveCategoryUseCase,
  CreateCategoryUseCase,
  ListCategoriesUseCase,
  RenameCategoryUseCase,
  ReorderCategoriesUseCase,
} from './application/useCases/CategoryUseCases.js';
import {
  CommitInvoiceToCellsUseCase,
  CommitKasaEntryToCellsUseCase,
  CommitTransferToCellsUseCase,
} from './application/useCases/CommitToCellsUseCases.js';
import {
  CreateInvoiceUseCase,
  DeletePaymentUseCase,
  GetOverdueInvoicesUseCase,
  ListInvoicesUseCase,
  RecordPaymentUseCase,
} from './application/useCases/InvoiceUseCases.js';
import { PgBankAccountRepository } from './infrastructure/persistence/PgBankAccountRepository.js';
import { PgCategoryRepository } from './infrastructure/persistence/PgCategoryRepository.js';
import { PgCellRepository } from './infrastructure/persistence/PgCellRepository.js';
import { PgInvoicePaymentRepository } from './infrastructure/persistence/PgInvoicePaymentRepository.js';
import { PgInvoiceRepository } from './infrastructure/persistence/PgInvoiceRepository.js';
import { PgKasaAccountRepository } from './infrastructure/persistence/PgKasaAccountRepository.js';
import { PgKasaEntryRepository } from './infrastructure/persistence/PgKasaEntryRepository.js';
import { PgTransferRepository } from './infrastructure/persistence/PgTransferRepository.js';
import { PgFinanceUnitOfWork } from './infrastructure/unitOfWork/PgFinanceUnitOfWork.js';
import { createFinanceRouter, type FinanceRouterDeps } from './presentation/routes.js';

export function registerFinanceModule(pool: Pool): ReturnType<typeof createFinanceRouter> {
  const clock = SystemClock;

  // Repository'ler (pool ile — transaction dışı okuma/yazma)
  const categories = new PgCategoryRepository(pool);
  const cells = new PgCellRepository(pool);
  const bankAccounts = new PgBankAccountRepository(pool);
  const kasaAccounts = new PgKasaAccountRepository(pool);
  const kasaEntries = new PgKasaEntryRepository(pool);
  const transfers = new PgTransferRepository(pool);
  const invoices = new PgInvoiceRepository(pool);
  const invoicePayments = new PgInvoicePaymentRepository(pool);

  // Commit-to-cells için UoW (transaction)
  const uow = new PgFinanceUnitOfWork(pool);

  const deps: FinanceRouterDeps = {
    // Budget
    createCategory: new CreateCategoryUseCase(categories),
    renameCategory: new RenameCategoryUseCase(categories, clock),
    reorderCategories: new ReorderCategoriesUseCase(categories, clock),
    archiveCategory: new ArchiveCategoryUseCase(categories, clock),
    listCategories: new ListCategoriesUseCase(categories),
    getBudgetMatrix: new GetBudgetMatrixUseCase(categories, cells),
    setCellValue: new SetCellValueUseCase(categories, cells, clock),
    bulkSetCells: new BulkSetCellsUseCase(categories, cells, clock),
    // Cash
    createBankAccount: new CreateBankAccountUseCase(bankAccounts),
    archiveBankAccount: new ArchiveBankAccountUseCase(bankAccounts, clock),
    listBankAccounts: new ListBankAccountsUseCase(bankAccounts),
    createKasaAccount: new CreateKasaAccountUseCase(kasaAccounts),
    archiveKasaAccount: new ArchiveKasaAccountUseCase(kasaAccounts, clock),
    listKasaAccounts: new ListKasaAccountsUseCase(kasaAccounts),
    recordKasaEntry: new RecordKasaEntryUseCase(kasaAccounts, kasaEntries, clock),
    createTransfer: new CreateTransferUseCase(bankAccounts, kasaAccounts, transfers, clock),
    listTransfers: new ListTransfersUseCase(transfers),
    getCashPosition: new GetCashPositionUseCase(bankAccounts, kasaAccounts, kasaEntries, transfers),
    // Invoice
    createInvoice: new CreateInvoiceUseCase(invoices, clock),
    recordPayment: new RecordPaymentUseCase(invoices, invoicePayments, clock),
    deletePayment: new DeletePaymentUseCase(invoices, invoicePayments, clock),
    listInvoices: new ListInvoicesUseCase(invoices, clock),
    getOverdueInvoices: new GetOverdueInvoicesUseCase(invoices, clock),
    // Commit
    commitKasaEntry: new CommitKasaEntryToCellsUseCase(uow, clock),
    commitTransfer: new CommitTransferToCellsUseCase(uow, clock),
    commitInvoice: new CommitInvoiceToCellsUseCase(uow, clock),
  };

  return createFinanceRouter(deps);
}
