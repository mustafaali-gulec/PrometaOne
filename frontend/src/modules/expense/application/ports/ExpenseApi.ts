/**
 * ExpenseApi — backend /v1/expense ile konuşan port.
 *
 * Concrete impl: infrastructure/api/ExpenseApiClient.ts (fetch wrapper).
 * Tüm metodlar `companyId` taşır (multi-tenant). Yazma işlemleri backend'de
 * 'editor' (>=) rolü ister.
 */
import type {
  BulkUpsertResult,
  ExpenseCardAttributes,
  ExpenseCardDto,
  ExpenseCardsResponse,
  FlowDirection,
  GenericColumnMap,
  KasaImportFormat,
  KasaImportResult,
  KasaImportSheet,
} from '../dto/ExpenseDtos';

export interface CreateExpenseCardBody {
  companyId: number;
  code?: string;
  name: string;
  category?: string;
  direction?: FlowDirection;
  defaultAccountCode?: string | null;
  note?: string | null;
  attributes?: ExpenseCardAttributes;
}

export interface UpdateExpenseCardBody {
  companyId: number;
  name?: string;
  category?: string;
  direction?: FlowDirection;
  defaultAccountCode?: string | null;
  note?: string | null;
  attributes?: ExpenseCardAttributes;
}

export interface BulkUpsertCardInput {
  code?: string | null;
  name: string;
  category?: string;
  direction?: FlowDirection;
}

export interface BulkUpsertBody {
  companyId: number;
  cards: BulkUpsertCardInput[];
}

export interface ParseKasaImportBody {
  companyId: number;
  formatId: KasaImportFormat;
  year?: number;
  sheets: KasaImportSheet[];
  columnMap?: GenericColumnMap;
}

export interface ExpenseApi {
  listExpenseCards(
    companyId: number,
    options?: { includeInactive?: boolean; search?: string },
  ): Promise<ExpenseCardsResponse>;
  createExpenseCard(body: CreateExpenseCardBody): Promise<ExpenseCardDto>;
  updateExpenseCard(id: number, body: UpdateExpenseCardBody): Promise<ExpenseCardDto>;
  deactivateExpenseCard(id: number, companyId: number): Promise<ExpenseCardDto>;
  /** Kalıcı silme — yalnız işlem görmemiş kartlar için (kural çağıranda). */
  deleteExpenseCard(id: number, companyId: number): Promise<void>;
  bulkUpsertExpenseCards(body: BulkUpsertBody): Promise<BulkUpsertResult>;
  parseKasaImport(body: ParseKasaImportBody): Promise<KasaImportResult>;
}
