/**
 * ExpenseApiClient — backend /v1/expense endpoint'leri ile konuşan fetch
 * wrapper. Auth header AuthTokenProvider'dan alınır. request() helper'ı
 * PurchasingApiClient ile aynı (tek text() okuma — happy-dom ReadableStream
 * lock sorununu önler).
 */
import type {
  BulkUpsertResult,
  ExpenseCardDto,
  ExpenseCardsResponse,
  KasaImportResult,
} from '../../application/dto/ExpenseDtos';
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';
import type {
  BulkUpsertBody,
  CreateExpenseCardBody,
  ExpenseApi,
  ParseKasaImportBody,
  UpdateExpenseCardBody,
} from '../../application/ports/ExpenseApi';

export class ExpenseApiClient implements ExpenseApi {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: AuthTokenProvider,
  ) {}

  // ===== GIDER KARTLARI ====================================================
  listExpenseCards(
    companyId: number,
    options?: { includeInactive?: boolean; search?: string },
  ): Promise<ExpenseCardsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.includeInactive !== undefined)
      q.set('includeInactive', String(options.includeInactive));
    if (options?.search !== undefined && options.search !== '') q.set('search', options.search);
    return this.request<ExpenseCardsResponse>(`/v1/expense/cards?${q.toString()}`);
  }

  createExpenseCard(body: CreateExpenseCardBody): Promise<ExpenseCardDto> {
    return this.request<ExpenseCardDto>(`/v1/expense/cards`, { method: 'POST', body });
  }

  updateExpenseCard(id: number, body: UpdateExpenseCardBody): Promise<ExpenseCardDto> {
    return this.request<ExpenseCardDto>(`/v1/expense/cards/${String(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  deactivateExpenseCard(id: number, companyId: number): Promise<ExpenseCardDto> {
    return this.request<ExpenseCardDto>(
      `/v1/expense/cards/${String(id)}?companyId=${String(companyId)}`,
      { method: 'DELETE' },
    );
  }

  bulkUpsertExpenseCards(body: BulkUpsertBody): Promise<BulkUpsertResult> {
    return this.request<BulkUpsertResult>(`/v1/expense/cards/bulk-upsert`, {
      method: 'POST',
      body,
    });
  }

  // ===== KASA İÇE AKTARIM ==================================================
  parseKasaImport(body: ParseKasaImportBody): Promise<KasaImportResult> {
    return this.request<KasaImportResult>(`/v1/expense/kasa-import/parse`, {
      method: 'POST',
      body,
    });
  }

  // ===== Generic request helper ===========================================
  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const token = this.tokens.getAccessToken();
    if (token === null || token === '') {
      throw new Error('Auth token yok — önce giriş yapın');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
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
          const parsed = JSON.parse(raw) as { message?: string };
          if (parsed.message !== undefined) message = parsed.message;
        } catch {
          // raw JSON değil — fallback HTTP status mesajı
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
