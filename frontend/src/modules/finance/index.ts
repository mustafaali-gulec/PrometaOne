/**
 * Finance frontend modülü — Public API (Faz 5 / PR 7).
 *
 * App.jsx ve diğer modüllere yalnız bu barrel üzerinden açılır.
 */

// --- DTO tipleri ----------------------------------------------------------
export type {
  BankAccountDto,
  BankAccountsResponse,
  BudgetMatrixDto,
  BudgetRowDto,
  BudgetSectionDto,
  CashPositionDto,
  CategoriesResponse,
  CategoryDto,
  CategorySection,
  Currency,
  EndpointType,
  FlowDirection,
  InvoiceDto,
  InvoicePaymentDto,
  InvoicesResponse,
  InvoiceStatus,
  KasaAccountDto,
  KasaAccountsResponse,
  KasaEntryDto,
  OkResponse,
  RecordPaymentResult,
  TransferDto,
  TransfersResponse,
} from './application/dto/FinanceDtos';

// --- Ports ----------------------------------------------------------------
export type {
  BulkSetCellsBody,
  CreateBankAccountBody,
  CreateCategoryBody,
  CreateInvoiceBody,
  CreateKasaAccountBody,
  CreateTransferBody,
  FinanceApi,
  RecordKasaEntryBody,
  RecordPaymentBody,
  RenameCategoryBody,
  ReorderCategoriesBody,
  SetCellBody,
} from './application/ports/FinanceApi';
export type { AuthTokenProvider } from './application/ports/AuthTokenProvider';
export { StaticAuthTokenProvider } from './application/ports/AuthTokenProvider';

// --- Infrastructure -------------------------------------------------------
export { FinanceApiClient } from './infrastructure/api/FinanceApiClient';

// --- Hooks ----------------------------------------------------------------
export { useBudgetMatrix } from './presentation/hooks/useBudgetMatrix';
export type {
  UseBudgetMatrixOptions,
  UseBudgetMatrixResult,
} from './presentation/hooks/useBudgetMatrix';
export { useCategories } from './presentation/hooks/useCategories';
export type { UseCategoriesOptions, UseCategoriesResult } from './presentation/hooks/useCategories';
export { useCashPosition } from './presentation/hooks/useCashPosition';
export type {
  UseCashPositionOptions,
  UseCashPositionResult,
} from './presentation/hooks/useCashPosition';
export { useInvoices } from './presentation/hooks/useInvoices';
export type { UseInvoicesOptions, UseInvoicesResult } from './presentation/hooks/useInvoices';

// --- Components -----------------------------------------------------------
export { BudgetMatrixGrid } from './presentation/components/BudgetMatrixGrid';
export type { BudgetMatrixGridProps } from './presentation/components/BudgetMatrixGrid';
export { CashPositionCard } from './presentation/components/CashPositionCard';
export type { CashPositionCardProps } from './presentation/components/CashPositionCard';
export { InvoicesTable } from './presentation/components/InvoicesTable';
export type { InvoicesTableProps } from './presentation/components/InvoicesTable';

// --- E-Fatura + FX (Faz 6) ------------------------------------------------
export type {
  CredentialDto,
  CurrentRatesDto,
  EInvoiceDto,
  EInvoicesResponse,
  ProviderType,
  RevaluationDto,
  SyncResult,
} from './application/dto/EInvoiceDtos';
export type { EInvoiceApi } from './application/ports/EInvoiceApi';
export { EInvoiceApiClient } from './infrastructure/api/EInvoiceApiClient';
export { useEInvoices } from './presentation/hooks/useEInvoices';
export type { UseEInvoicesOptions, UseEInvoicesResult } from './presentation/hooks/useEInvoices';
export { useCurrentRates } from './presentation/hooks/useCurrentRates';
export type { UseCurrentRatesResult } from './presentation/hooks/useCurrentRates';
export { useRevaluations } from './presentation/hooks/useRevaluations';
export type { UseRevaluationsResult } from './presentation/hooks/useRevaluations';
export { EInvoiceInbox } from './presentation/components/EInvoiceInbox';
export type { EInvoiceInboxProps } from './presentation/components/EInvoiceInbox';
export { CurrentRatesCard } from './presentation/components/CurrentRatesCard';
export type { CurrentRatesCardProps } from './presentation/components/CurrentRatesCard';
export { RevaluationsTable } from './presentation/components/RevaluationsTable';
export type { RevaluationsTableProps } from './presentation/components/RevaluationsTable';

// --- Demo -----------------------------------------------------------------
export { FinanceDemoPage } from './demo/FinanceDemoPage';
export type { FinanceDemoPageProps, FinanceTab } from './demo/FinanceDemoPage';
