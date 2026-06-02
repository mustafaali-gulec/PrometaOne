/**
 * EInvoiceApi — backend /v1/finance/einvoice + /fx ile konuşan port.
 * Concrete: infrastructure/api/EInvoiceApiClient.ts. Test'te mock'lanabilir.
 */
import type {
  CredentialConfigInput,
  CredentialDto,
  CurrentRatesDto,
  EInvoicesResponse,
  FetchRatesResult,
  ImportResult,
  InvoiceDirection,
  OkResponse,
  PartyMappingDto,
  ProviderTestResult,
  ProviderType,
  RevaluationDto,
  RevaluationsResponse,
  SyncResult,
  UnmappedPartyDto,
} from '../dto/EInvoiceDtos';
import type { Currency } from '../dto/FinanceDtos';

export interface SyncBody {
  companyId: number;
  provider: ProviderType;
  dateFrom: string;
  dateTo: string;
  direction?: 'incoming' | 'outgoing' | 'both';
}

export interface SaveCredentialBody {
  companyId: number;
  provider: ProviderType;
  config: CredentialConfigInput;
  autoSyncEnabled?: boolean;
  autoSyncCron?: string;
}

export interface MapPartyBody {
  companyId: number;
  vknTckn: string;
  displayName?: string | null;
  cashflowCatId?: number | null;
  autoImport?: boolean;
  notes?: string | null;
}

export interface CreateRevaluationBody {
  companyId: number;
  referenceDate: string;
  valuationDate: string;
  positions: Array<{ label: string; currency: 'USD' | 'EUR'; foreignAmountMajor: number }>;
}

export interface EInvoiceApi {
  listEInvoices(
    companyId: number,
    options?: { direction?: InvoiceDirection; pendingOnly?: boolean },
  ): Promise<EInvoicesResponse>;
  syncEInvoices(body: SyncBody): Promise<SyncResult>;
  importEInvoice(
    id: number,
    body: { companyId: number; cashflowCatId?: number | null },
  ): Promise<ImportResult>;
  ignoreEInvoice(
    id: number,
    body: { companyId: number; reason?: string | null },
  ): Promise<OkResponse>;
  saveCredential(body: SaveCredentialBody): Promise<CredentialDto>;
  testConnection(body: { companyId: number; provider: ProviderType }): Promise<ProviderTestResult>;
  deleteCredential(companyId: number, provider: ProviderType): Promise<OkResponse>;
  listUnmappedParties(companyId: number): Promise<{ parties: UnmappedPartyDto[] }>;
  mapParty(body: MapPartyBody): Promise<PartyMappingDto>;
  // FX
  getCurrentRates(): Promise<CurrentRatesDto>;
  fetchRates(): Promise<FetchRatesResult>;
  getRateAt(
    currency: Currency,
    date: string,
  ): Promise<{ currency: Currency; date: string; rate: number }>;
  listRevaluations(companyId: number): Promise<RevaluationsResponse>;
  createRevaluation(body: CreateRevaluationBody): Promise<RevaluationDto>;
  postRevaluation(id: number, companyId: number): Promise<RevaluationDto>;
}
