/**
 * Expense (Gider Kartları + Kasa İçe Aktarım) DTO tipleri.
 *
 * Backend /v1/expense rotalarının döndürdüğü/aldığı shape'lerle birebir
 * uyumludur. (api-server/src/modules/expense)
 */

export type FlowDirection = 'in' | 'out';

/** Gider kartı (malzeme kartı muadili) — kalıcı master data. */
export interface ExpenseCardDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  category: string;
  direction: FlowDirection;
  defaultAccountCode: string | null;
  note: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCardsResponse {
  cards: ExpenseCardDto[];
}

export interface BulkUpsertResult {
  cards: ExpenseCardDto[];
  created: number;
  matched: number;
}

// --- Kasa İçe Aktarım -------------------------------------------------------

/** Desteklenen Excel formatları. */
export type KasaImportFormat = 'can_tekel_daily' | 'generic';

/** Tek bir Excel sayfası — ham hücre matrisi (satır × sütun, metin). */
export interface KasaImportSheet {
  name: string;
  rows: string[][];
}

/** Genel format için kolon eşlemesi (0 tabanlı sütun indeksleri). */
export interface GenericColumnMap {
  headerRowIndex: number;
  date: number;
  description: number;
  type?: number;
  amount?: number;
  amountIn?: number;
  amountOut?: number;
  category?: number;
  invoiceNo?: number;
}

/** Parse sonucu üretilen normalize edilmiş kasa hareketi. */
export interface KasaImportEntry {
  date: string; // YYYY-MM-DD
  type: FlowDirection;
  amount: number;
  paymentMethod: 'cash' | 'card' | '';
  description: string;
  category: string;
  source: string;
  invoiceNo: string;
  sheetName: string;
  rowRef: number;
}

/** İçe aktarımdan tespit edilen aday gider kartı. */
export interface DetectedExpenseCard {
  name: string;
  category: string;
  direction: FlowDirection;
  occurrences: number;
}

export interface KasaImportSummary {
  entryCount: number;
  totalIn: number;
  totalOut: number;
  sheetCount: number;
  expenseCardCount: number;
  dateRange: { from: string | null; to: string | null };
}

export interface KasaImportResult {
  formatId: string;
  entries: KasaImportEntry[];
  expenseCards: DetectedExpenseCard[];
  warnings: string[];
  summary: KasaImportSummary;
}
