/**
 * FinanceApi — backend /v1/finance ile konuşan port.
 *
 * Concrete impl: infrastructure/api/FinanceApiClient.ts (fetch wrapper).
 * Test'te mock'lanabilir (fakeFinanceApi).
 *
 * Tüm metodlar `companyId` taşır (multi-tenant). Yazma işlemleri backend'de
 * 'cfo' rolü ister; UI bunu zorlamaz, hata dönerse kullanıcıya gösterilir.
 */
import type {
  BankAccountDto,
  BankAccountsResponse,
  BudgetMatrixDto,
  CategoriesResponse,
  CategoryDto,
  CategorySection,
  CashPositionDto,
  Currency,
  EndpointType,
  FlowDirection,
  InvoiceDto,
  InvoicesResponse,
  KasaAccountDto,
  KasaAccountsResponse,
  KasaEntryDto,
  OkResponse,
  RecordPaymentResult,
  TransferDto,
  TransfersResponse,
} from '../dto/FinanceDtos';

// ---------------------------------------------------------------------------
// Input (body) tipleri — backend zod şemalarıyla uyumlu.
// ---------------------------------------------------------------------------
export interface CreateCategoryBody {
  companyId: number;
  section: CategorySection;
  name: string;
  sortOrder?: number;
}

export interface RenameCategoryBody {
  companyId: number;
  name: string;
}

export interface ReorderCategoriesBody {
  companyId: number;
  orderedIds: number[];
}

export interface SetCellBody {
  companyId: number;
  categoryId: number;
  fiscalYear: number;
  monthIdx: number;
  value: number;
  currency?: Currency;
}

export interface BulkSetCellsBody {
  companyId: number;
  fiscalYear: number;
  currency?: Currency;
  entries: Array<{ categoryId: number; monthIdx: number; value: number }>;
}

export interface CreateBankAccountBody {
  companyId: number;
  bankId: number;
  name: string;
  iban?: string | null;
  accountNo?: string | null;
  currency: Currency;
  openingBalance?: number;
  cashflowCatId?: number | null;
}

export interface CreateKasaAccountBody {
  companyId: number;
  name: string;
  currency: Currency;
  openingBalance?: number;
}

export interface RecordKasaEntryBody {
  companyId: number;
  kasaAccountId: number;
  date: string;
  type: FlowDirection;
  amount: number;
  description?: string | null;
  category?: string | null;
  cashflowCatId?: number | null;
}

export interface CreateTransferBody {
  companyId: number;
  date: string;
  fromType: EndpointType;
  fromId: number;
  toType: EndpointType;
  toId: number;
  fromAmount: number;
  toAmount: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  description?: string | null;
  cashflowCatId?: number | null;
}

export interface CreateInvoiceBody {
  companyId: number;
  type: FlowDirection;
  invoiceNo?: string | null;
  counterparty: string;
  issueDate?: string | null;
  dueDate: string;
  currency: Currency;
  subtotal: number;
  kdvRate?: number;
  cashflowCatId?: number | null;
  note?: string | null;
}

export interface RecordPaymentBody {
  companyId: number;
  amount: number;
  date: string;
  bankAccountId?: number | null;
  kasaAccountId?: number | null;
  note?: string | null;
}

export interface FinanceApi {
  // Budget
  getBudgetMatrix(
    companyId: number,
    fiscalYear: number,
    currency?: Currency,
  ): Promise<BudgetMatrixDto>;
  listCategories(companyId: number, section?: CategorySection): Promise<CategoriesResponse>;
  createCategory(body: CreateCategoryBody): Promise<CategoryDto>;
  renameCategory(id: number, body: RenameCategoryBody): Promise<CategoryDto>;
  reorderCategories(body: ReorderCategoriesBody): Promise<OkResponse>;
  archiveCategory(id: number, companyId: number): Promise<CategoryDto>;
  setCellValue(body: SetCellBody): Promise<OkResponse>;
  bulkSetCells(body: BulkSetCellsBody): Promise<OkResponse>;

  // Cash
  listBankAccounts(companyId: number): Promise<BankAccountsResponse>;
  createBankAccount(body: CreateBankAccountBody): Promise<BankAccountDto>;
  archiveBankAccount(id: number, companyId: number): Promise<BankAccountDto>;
  listKasaAccounts(companyId: number): Promise<KasaAccountsResponse>;
  createKasaAccount(body: CreateKasaAccountBody): Promise<KasaAccountDto>;
  archiveKasaAccount(id: number, companyId: number): Promise<KasaAccountDto>;
  recordKasaEntry(body: RecordKasaEntryBody): Promise<KasaEntryDto>;
  listTransfers(companyId: number): Promise<TransfersResponse>;
  createTransfer(body: CreateTransferBody): Promise<TransferDto>;
  getCashPosition(
    companyId: number,
    endpointType: EndpointType,
    accountId: number,
  ): Promise<CashPositionDto>;

  // Invoice
  listInvoices(
    companyId: number,
    options?: { type?: FlowDirection; openOnly?: boolean },
  ): Promise<InvoicesResponse>;
  getOverdueInvoices(companyId: number): Promise<InvoicesResponse>;
  createInvoice(body: CreateInvoiceBody): Promise<InvoiceDto>;
  recordPayment(invoiceId: number, body: RecordPaymentBody): Promise<RecordPaymentResult>;
  deletePayment(paymentId: number, companyId: number): Promise<InvoiceDto>;

  // Commit-to-cells
  commitKasaEntry(id: number, companyId: number): Promise<OkResponse>;
  commitTransfer(id: number, companyId: number): Promise<OkResponse>;
  commitInvoice(id: number, companyId: number): Promise<OkResponse>;
}
