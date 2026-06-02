/**
 * EInvoiceApiClient — /v1/finance/einvoice + /fx fetch wrapper.
 * request() helper FinanceApiClient ile aynı (tek text() okuma).
 */
import type {
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
} from '../../application/dto/EInvoiceDtos';
import type { Currency } from '../../application/dto/FinanceDtos';
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';
import type {
  CreateRevaluationBody,
  EInvoiceApi,
  MapPartyBody,
  SaveCredentialBody,
  SyncBody,
} from '../../application/ports/EInvoiceApi';

export class EInvoiceApiClient implements EInvoiceApi {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: AuthTokenProvider,
  ) {}

  listEInvoices(
    companyId: number,
    options?: { direction?: InvoiceDirection; pendingOnly?: boolean },
  ): Promise<EInvoicesResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.direction !== undefined) q.set('direction', options.direction);
    if (options?.pendingOnly !== undefined) q.set('pendingOnly', String(options.pendingOnly));
    return this.request<EInvoicesResponse>(`/v1/finance/einvoice?${q.toString()}`);
  }

  syncEInvoices(body: SyncBody): Promise<SyncResult> {
    return this.request<SyncResult>(`/v1/finance/einvoice/sync`, { method: 'POST', body });
  }

  importEInvoice(
    id: number,
    body: { companyId: number; cashflowCatId?: number | null },
  ): Promise<ImportResult> {
    return this.request<ImportResult>(`/v1/finance/einvoice/${id}/import`, {
      method: 'POST',
      body,
    });
  }

  ignoreEInvoice(
    id: number,
    body: { companyId: number; reason?: string | null },
  ): Promise<OkResponse> {
    return this.request<OkResponse>(`/v1/finance/einvoice/${id}/ignore`, { method: 'POST', body });
  }

  saveCredential(body: SaveCredentialBody): Promise<CredentialDto> {
    return this.request<CredentialDto>(`/v1/finance/einvoice/credentials`, { method: 'PUT', body });
  }

  testConnection(body: { companyId: number; provider: ProviderType }): Promise<ProviderTestResult> {
    return this.request<ProviderTestResult>(`/v1/finance/einvoice/credentials/test`, {
      method: 'POST',
      body,
    });
  }

  deleteCredential(companyId: number, provider: ProviderType): Promise<OkResponse> {
    return this.request<OkResponse>(
      `/v1/finance/einvoice/credentials?companyId=${companyId}&provider=${provider}`,
      { method: 'DELETE' },
    );
  }

  listUnmappedParties(companyId: number): Promise<{ parties: UnmappedPartyDto[] }> {
    return this.request<{ parties: UnmappedPartyDto[] }>(
      `/v1/finance/einvoice/parties/unmapped?companyId=${companyId}`,
    );
  }

  mapParty(body: MapPartyBody): Promise<PartyMappingDto> {
    return this.request<PartyMappingDto>(`/v1/finance/einvoice/parties`, { method: 'POST', body });
  }

  // --- FX ---
  getCurrentRates(): Promise<CurrentRatesDto> {
    return this.request<CurrentRatesDto>(`/v1/finance/fx/rates`);
  }

  fetchRates(): Promise<FetchRatesResult> {
    return this.request<FetchRatesResult>(`/v1/finance/fx/rates/fetch`, {
      method: 'POST',
      body: {},
    });
  }

  getRateAt(
    currency: Currency,
    date: string,
  ): Promise<{ currency: Currency; date: string; rate: number }> {
    const q = new URLSearchParams({ currency, date });
    return this.request<{ currency: Currency; date: string; rate: number }>(
      `/v1/finance/fx/rates/at?${q.toString()}`,
    );
  }

  listRevaluations(companyId: number): Promise<RevaluationsResponse> {
    return this.request<RevaluationsResponse>(`/v1/finance/fx/revaluations?companyId=${companyId}`);
  }

  createRevaluation(body: CreateRevaluationBody): Promise<RevaluationDto> {
    return this.request<RevaluationDto>(`/v1/finance/fx/revaluations`, { method: 'POST', body });
  }

  postRevaluation(id: number, companyId: number): Promise<RevaluationDto> {
    return this.request<RevaluationDto>(`/v1/finance/fx/revaluations/${id}/post`, {
      method: 'POST',
      body: { companyId },
    });
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const token = this.tokens.getAccessToken();
    if (token === null || token === '') {
      throw new Error('Auth token yok — önce giriş yapın');
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let bodyStr: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      bodyStr = JSON.stringify(options.body);
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(bodyStr !== undefined ? { body: bodyStr } : {}),
    });
    if (response.status === 204) {
      return undefined as unknown as T;
    }
    const raw = await response.text();
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      if (raw.length > 0) {
        try {
          const b = JSON.parse(raw) as { message?: string };
          if (b.message !== undefined) message = b.message;
        } catch {
          /* fallback */
        }
      }
      throw new Error(message);
    }
    if (raw.length === 0) {
      return undefined as unknown as T;
    }
    return JSON.parse(raw) as T;
  }
}
