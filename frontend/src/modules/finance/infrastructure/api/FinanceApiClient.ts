/**
 * FinanceApiClient — backend /v1/finance endpoint'leri ile konuşan fetch wrapper.
 *
 * Auth header AuthTokenProvider'dan alınır. Hata response'ları Hono
 * HTTPException `{ message: string }` shape'ine sahip; Error.message buradan
 * dolar. request() helper'ı HrApiClient ile aynı (tek text() okuma — happy-dom
 * ReadableStream lock sorununu önler).
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
} from '../../application/dto/FinanceDtos';
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';
import type {
  BulkSetCellsBody,
  CreateBankAccountBody,
  CreateCategoryBody,
  CreateInvoiceBody,
  CreateKasaAccountBody,
  CreateTransferBody,
  FinanceApi,
  RecordKasaEntryBody,
  RecordPaymentBody,
  RenameCategoryBody,
  ReorderCategoriesBody,
  SetCellBody,
} from '../../application/ports/FinanceApi';

export class FinanceApiClient implements FinanceApi {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: AuthTokenProvider,
  ) {}

  // ===== BUDGET ============================================================
  getBudgetMatrix(
    companyId: number,
    fiscalYear: number,
    currency?: Currency,
  ): Promise<BudgetMatrixDto> {
    const q = new URLSearchParams({
      companyId: String(companyId),
      fiscalYear: String(fiscalYear),
    });
    if (currency !== undefined) q.set('currency', currency);
    return this.request<BudgetMatrixDto>(`/v1/finance/budget/matrix?${q.toString()}`);
  }

  listCategories(companyId: number, section?: CategorySection): Promise<CategoriesResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (section !== undefined) q.set('section', section);
    return this.request<CategoriesResponse>(`/v1/finance/categories?${q.toString()}`);
  }

  createCategory(body: CreateCategoryBody): Promise<CategoryDto> {
    return this.request<CategoryDto>(`/v1/finance/categories`, { method: 'POST', body });
  }

  renameCategory(id: number, body: RenameCategoryBody): Promise<CategoryDto> {
    return this.request<CategoryDto>(`/v1/finance/categories/${id}`, { method: 'PATCH', body });
  }

  reorderCategories(body: ReorderCategoriesBody): Promise<OkResponse> {
    return this.request<OkResponse>(`/v1/finance/categories/reorder`, { method: 'POST', body });
  }

  archiveCategory(id: number, companyId: number): Promise<CategoryDto> {
    return this.request<CategoryDto>(`/v1/finance/categories/${id}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  setCellValue(body: SetCellBody): Promise<OkResponse> {
    return this.request<OkResponse>(`/v1/finance/cells`, { method: 'POST', body });
  }

  bulkSetCells(body: BulkSetCellsBody): Promise<OkResponse> {
    return this.request<OkResponse>(`/v1/finance/cells/bulk`, { method: 'POST', body });
  }

  // ===== CASH ==============================================================
  listBankAccounts(companyId: number): Promise<BankAccountsResponse> {
    return this.request<BankAccountsResponse>(`/v1/finance/bank-accounts?companyId=${companyId}`);
  }

  createBankAccount(body: CreateBankAccountBody): Promise<BankAccountDto> {
    return this.request<BankAccountDto>(`/v1/finance/bank-accounts`, { method: 'POST', body });
  }

  archiveBankAccount(id: number, companyId: number): Promise<BankAccountDto> {
    return this.request<BankAccountDto>(`/v1/finance/bank-accounts/${id}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  listKasaAccounts(companyId: number): Promise<KasaAccountsResponse> {
    return this.request<KasaAccountsResponse>(`/v1/finance/kasa-accounts?companyId=${companyId}`);
  }

  createKasaAccount(body: CreateKasaAccountBody): Promise<KasaAccountDto> {
    return this.request<KasaAccountDto>(`/v1/finance/kasa-accounts`, { method: 'POST', body });
  }

  archiveKasaAccount(id: number, companyId: number): Promise<KasaAccountDto> {
    return this.request<KasaAccountDto>(`/v1/finance/kasa-accounts/${id}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  recordKasaEntry(body: RecordKasaEntryBody): Promise<KasaEntryDto> {
    return this.request<KasaEntryDto>(`/v1/finance/kasa-entries`, { method: 'POST', body });
  }

  listTransfers(companyId: number): Promise<TransfersResponse> {
    return this.request<TransfersResponse>(`/v1/finance/transfers?companyId=${companyId}`);
  }

  createTransfer(body: CreateTransferBody): Promise<TransferDto> {
    return this.request<TransferDto>(`/v1/finance/transfers`, { method: 'POST', body });
  }

  getCashPosition(
    companyId: number,
    endpointType: EndpointType,
    accountId: number,
  ): Promise<CashPositionDto> {
    return this.request<CashPositionDto>(
      `/v1/finance/cash-position/${endpointType}/${accountId}?companyId=${companyId}`,
    );
  }

  // ===== INVOICE ===========================================================
  listInvoices(
    companyId: number,
    options?: { type?: FlowDirection; openOnly?: boolean },
  ): Promise<InvoicesResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.type !== undefined) q.set('type', options.type);
    if (options?.openOnly !== undefined) q.set('openOnly', String(options.openOnly));
    return this.request<InvoicesResponse>(`/v1/finance/invoices?${q.toString()}`);
  }

  getOverdueInvoices(companyId: number): Promise<InvoicesResponse> {
    return this.request<InvoicesResponse>(`/v1/finance/invoices/overdue?companyId=${companyId}`);
  }

  createInvoice(body: CreateInvoiceBody): Promise<InvoiceDto> {
    return this.request<InvoiceDto>(`/v1/finance/invoices`, { method: 'POST', body });
  }

  recordPayment(invoiceId: number, body: RecordPaymentBody): Promise<RecordPaymentResult> {
    return this.request<RecordPaymentResult>(`/v1/finance/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body,
    });
  }

  deletePayment(paymentId: number, companyId: number): Promise<InvoiceDto> {
    return this.request<InvoiceDto>(`/v1/finance/payments/${paymentId}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  // ===== COMMIT-TO-CELLS ===================================================
  commitKasaEntry(id: number, companyId: number): Promise<OkResponse> {
    return this.request<OkResponse>(`/v1/finance/kasa-entries/${id}/commit`, {
      method: 'POST',
      body: { companyId },
    });
  }

  commitTransfer(id: number, companyId: number): Promise<OkResponse> {
    return this.request<OkResponse>(`/v1/finance/transfers/${id}/commit`, {
      method: 'POST',
      body: { companyId },
    });
  }

  commitInvoice(id: number, companyId: number): Promise<OkResponse> {
    return this.request<OkResponse>(`/v1/finance/invoices/${id}/commit`, {
      method: 'POST',
      body: { companyId },
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

    // happy-dom + bazı fetch implementasyonlarında Response body iki kez
    // okunamaz (ReadableStream lock). Tek seferde text() okuyup parse ediyoruz.
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const raw = await response.text();

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      if (raw.length > 0) {
        try {
          const body = JSON.parse(raw) as { message?: string };
          if (body.message !== undefined) message = body.message;
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
