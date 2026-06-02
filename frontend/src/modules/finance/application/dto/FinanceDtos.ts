/**
 * Finance frontend DTO tipleri — backend /v1/finance JSON sözleşmesinin birebir
 * aynası (api-server/src/modules/finance/application/dto/*).
 *
 * Para alanları DAİMA decimal string'tir (NUMERIC(20,2) uyumlu); backend
 * Money'i `toDecimalString()` ile serileştirir. Frontend bunları string olarak
 * gösterir; aritmetik gerekirse parse edilir (PR 7 kapsamında salt görüntüleme).
 */

// ---------------------------------------------------------------------------
// Value-object union'ları
// ---------------------------------------------------------------------------
export type Currency = 'TRY' | 'USD' | 'EUR';
export type CategorySection = 'inflows' | 'outflows' | 'nonPnlOutflows' | 'kasaCategories';
export type FlowDirection = 'in' | 'out';
export type EndpointType = 'bank' | 'kasa';
export type InvoiceStatus = 'open' | 'partial' | 'paid' | 'overdue';

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------
export interface CategoryDto {
  id: number;
  companyId: number;
  section: CategorySection;
  name: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoriesResponse {
  categories: CategoryDto[];
}

export interface BudgetRowDto {
  categoryId: number;
  name: string;
  /** 12 aylık değer (decimal string). */
  months: string[];
  rowTotal: string;
}

export interface BudgetSectionDto {
  section: CategorySection;
  rows: BudgetRowDto[];
  monthlyTotals: string[];
  sectionTotal: string;
}

export interface BudgetMatrixDto {
  currency: Currency;
  fiscalYear: number;
  sections: BudgetSectionDto[];
  pnlNetMonthly: string[];
  pnlNetTotal: string;
}

// ---------------------------------------------------------------------------
// Cash
// ---------------------------------------------------------------------------
export interface BankAccountDto {
  id: number;
  companyId: number;
  bankId: number;
  name: string;
  iban: string | null;
  accountNo: string | null;
  currency: Currency;
  openingBalance: string;
  cashflowCatId: number | null;
  active: boolean;
}

export interface BankAccountsResponse {
  accounts: BankAccountDto[];
}

export interface KasaAccountDto {
  id: number;
  companyId: number;
  name: string;
  currency: Currency;
  openingBalance: string;
  active: boolean;
}

export interface KasaAccountsResponse {
  accounts: KasaAccountDto[];
}

export interface KasaEntryDto {
  id: number | null;
  kasaAccountId: number;
  date: string;
  type: FlowDirection;
  amount: string;
  description: string | null;
  category: string | null;
  cashflowCatId: number | null;
  committedToCells: boolean;
}

export interface TransferDto {
  id: number | null;
  companyId: number;
  date: string;
  fromType: EndpointType;
  fromId: number;
  toType: EndpointType;
  toId: number;
  fromAmount: string;
  toAmount: string;
  description: string | null;
  committedToCells: boolean;
}

export interface TransfersResponse {
  transfers: TransferDto[];
}

export interface CashPositionDto {
  endpointType: EndpointType;
  accountId: number;
  name: string;
  currency: Currency;
  openingBalance: string;
  currentBalance: string;
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------
export interface InvoiceDto {
  id: number | null;
  companyId: number;
  type: FlowDirection;
  invoiceNo: string | null;
  counterparty: string;
  issueDate: string | null;
  dueDate: string;
  currency: Currency;
  subtotal: string;
  kdvRate: number;
  kdv: string;
  total: string;
  paidAmount: string;
  remaining: string;
  status: InvoiceStatus;
  cashflowCatId: number | null;
  committedToCells: boolean;
  note: string | null;
}

export interface InvoicesResponse {
  invoices: InvoiceDto[];
}

export interface InvoicePaymentDto {
  id: number | null;
  invoiceId: number;
  amount: string;
  date: string;
  currency: Currency;
  bankAccountId: number | null;
  kasaAccountId: number | null;
  note: string | null;
}

export interface RecordPaymentResult {
  invoice: InvoiceDto;
  payment: InvoicePaymentDto;
}

/** Yazma uçlarının döndürdüğü basit onay zarfı. */
export interface OkResponse {
  ok: boolean;
}
