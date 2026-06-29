/**
 * Expense (Gider Kartları + Kasa İçe Aktarım) frontend modülü — Public API.
 *
 * App.jsx yalnız bu barrel üzerinden erişir.
 */

// --- DTO tipleri ----------------------------------------------------------
export type {
  BulkUpsertResult,
  DetectedExpenseCard,
  ExpenseCardDto,
  ExpenseCardsResponse,
  FlowDirection,
  GenericColumnMap,
  KasaImportEntry,
  KasaImportFormat,
  KasaImportResult,
  KasaImportSheet,
  KasaImportSummary,
} from './application/dto/ExpenseDtos';

// --- Ports ----------------------------------------------------------------
export type {
  BulkUpsertBody,
  BulkUpsertCardInput,
  CreateExpenseCardBody,
  ExpenseApi,
  ParseKasaImportBody,
  UpdateExpenseCardBody,
} from './application/ports/ExpenseApi';
export type { AuthTokenProvider } from './application/ports/AuthTokenProvider';
export { StaticAuthTokenProvider } from './application/ports/AuthTokenProvider';

// --- Infrastructure -------------------------------------------------------
export { ExpenseApiClient } from './infrastructure/api/ExpenseApiClient';

// --- Presentation ---------------------------------------------------------
export { ExpenseCardsPage } from './presentation/ExpenseCardsPage';
export type { ExpenseCardsPageProps } from './presentation/ExpenseCardsPage';
export { KasaImportModal } from './presentation/KasaImportModal';
export type { KasaImportModalProps, KasaAccountLite } from './presentation/KasaImportModal';
