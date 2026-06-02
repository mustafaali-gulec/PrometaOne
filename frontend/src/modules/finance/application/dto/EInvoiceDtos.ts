/**
 * E-Fatura + FX frontend DTO tipleri — backend /v1/finance/einvoice + /fx
 * JSON sözleşmesinin aynası. Para alanları decimal string.
 */
import type { Currency } from './FinanceDtos';

export type ProviderType = 'elogo' | 'qnb_efinans' | 'logo_db' | 'mock';
export type InvoiceDirection = 'incoming' | 'outgoing';

export interface EInvoiceDto {
  id: number | null;
  companyId: number;
  provider: ProviderType;
  uuid: string;
  invoiceNo: string;
  direction: InvoiceDirection;
  invoiceType: string | null;
  scenario: string | null;
  partyVknTckn: string | null;
  partyName: string | null;
  partyAlias: string | null;
  issueDate: string;
  dueDate: string | null;
  currency: Currency;
  exchangeRate: number | null;
  subtotal: string;
  kdvTotal: string;
  tevkifatTotal: string;
  konaklamaVergisi: string;
  ozelTuketimVergisi: string;
  payableAmount: string;
  gibStatus: string | null;
  importedInvoiceId: number | null;
  ignored: boolean;
}

export interface EInvoicesResponse {
  einvoices: EInvoiceDto[];
}

export interface SyncResult {
  incomingFetched: number;
  incomingNew: number;
  outgoingFetched: number;
  outgoingNew: number;
  errorsCount: number;
  status: 'success' | 'partial' | 'error';
}

export interface ImportResult {
  einvoiceId: number;
  invoiceId: number;
}

export interface CredentialConfigInput {
  username: string;
  password: string;
  vergiNo: string;
  env: 'test' | 'prod';
  wsdlUrl?: string;
}

export interface CredentialDto {
  id: number | null;
  companyId: number;
  provider: ProviderType;
  isActive: boolean;
  autoSyncEnabled: boolean;
  autoSyncCron: string;
  lastSyncStatus: string | null;
  lastSyncAt: string | null;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
}

export interface UnmappedPartyDto {
  vknTckn: string;
  partyName: string | null;
  count: number;
}

export interface PartyMappingDto {
  id: number | null;
  companyId: number;
  vknTckn: string;
  displayName: string | null;
  cashflowCatId: number | null;
  autoImport: boolean;
  notes: string | null;
}

// --- FX ---
export interface CurrentRatesDto {
  USD: number | null;
  EUR: number | null;
  date: string | null;
}

export interface FetchRatesResult {
  stored: number;
  latestDate: string | null;
}

export interface RevaluationLineDto {
  label: string;
  currency: Currency;
  foreignAmount: string;
  tryValueBefore: string;
  tryValueAfter: string;
  delta: string;
}

export interface RevaluationDto {
  id: number | null;
  companyId: number;
  referenceDate: string;
  valuationDate: string;
  usdRate1: number;
  usdRate2: number;
  eurRate1: number;
  eurRate2: number;
  gainTotal: string;
  lossTotal: string;
  net: string;
  details: RevaluationLineDto[];
  posted: boolean;
  postedAt: string | null;
}

export interface RevaluationsResponse {
  revaluations: RevaluationDto[];
}

export interface OkResponse {
  ok: boolean;
}
