/**
 * Kasa Excel Import — DTO / I/O tipleri (REST sınırı + use-case sözleşmesi).
 *
 * ParseKasaImportUseCase saf bir parser'dır: ham hücre matrislerini (string[][])
 * normalize edilmiş kasa hareketlerine ve tespit edilen gider kartlarına çevirir.
 * DB/repo yok — tamamen deterministik.
 */
import type { FlowDirection } from '../../domain/entities/ExpenseCard.js';

export type KasaImportFormat = 'can_tekel_daily' | 'generic';
export type PaymentMethod = 'cash' | 'card' | '';

/** Bir Excel sayfası — ham hücre matrisi (satır × kolon, hepsi string). */
export interface KasaImportSheet {
  name: string;
  rows: string[][];
}

/** generic format için kolon eşlemesi (0-indeksli kolon numaraları). */
export interface GenericColumnMap {
  headerRowIndex: number;
  date: number;
  description: number;
  type?: number | undefined;
  amount?: number | undefined;
  amountIn?: number | undefined;
  amountOut?: number | undefined;
  category?: number | undefined;
  invoiceNo?: number | undefined;
}

export interface ParseKasaImportInput {
  companyId: number;
  formatId: KasaImportFormat;
  year?: number;
  sheets: KasaImportSheet[];
  columnMap?: GenericColumnMap;
}

/** Normalize edilmiş tek kasa hareketi. */
export interface KasaImportEntry {
  date: string; // YYYY-MM-DD
  type: FlowDirection; // 'in' | 'out'
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
  category: string;
  source: string;
  invoiceNo: string;
  sheetName: string;
  rowRef: number;
}

/** Tespit edilen distinct gider kartı adayı. */
export interface KasaImportExpenseCard {
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
  expenseCards: KasaImportExpenseCard[];
  warnings: string[];
  summary: KasaImportSummary;
}
