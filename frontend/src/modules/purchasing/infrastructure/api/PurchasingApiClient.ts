/**
 * PurchasingApiClient — backend /v1/purchasing endpoint'leri ile konuşan fetch
 * wrapper.
 *
 * Auth header AuthTokenProvider'dan alınır. Hata response'ları Hono
 * HTTPException `{ message: string }` shape'ine sahip; Error.message buradan
 * dolar. request() helper'ı FinanceApiClient ile aynı (tek text() okuma —
 * happy-dom ReadableStream lock sorununu önler).
 */
import type {
  PoStatus,
  PrStatus,
  PurchaseOrderDto,
  PurchaseOrdersResponse,
  PurchaseRequestDto,
  PurchaseRequestsResponse,
  VendorDto,
  VendorsResponse,
} from '../../application/dto/PurchasingDtos';
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';
import type {
  ChangeOrderStatusBody,
  ChangeRequestStatusBody,
  CreateOrderBody,
  CreateRequestBody,
  CreateVendorBody,
  PurchasingApi,
  UpdateRequestBody,
  UpdateVendorBody,
} from '../../application/ports/PurchasingApi';

export class PurchasingApiClient implements PurchasingApi {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: AuthTokenProvider,
  ) {}

  // ===== VENDORS ===========================================================
  listVendors(
    companyId: number,
    options?: { includeInactive?: boolean; search?: string },
  ): Promise<VendorsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.includeInactive !== undefined)
      q.set('includeInactive', String(options.includeInactive));
    if (options?.search !== undefined) q.set('search', options.search);
    return this.request<VendorsResponse>(`/v1/purchasing/vendors?${q.toString()}`);
  }

  createVendor(body: CreateVendorBody): Promise<VendorDto> {
    return this.request<VendorDto>(`/v1/purchasing/vendors`, { method: 'POST', body });
  }

  updateVendor(id: number, body: UpdateVendorBody): Promise<VendorDto> {
    return this.request<VendorDto>(`/v1/purchasing/vendors/${String(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  deactivateVendor(id: number, companyId: number): Promise<VendorDto> {
    return this.request<VendorDto>(`/v1/purchasing/vendors/${String(id)}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  // ===== PURCHASE REQUESTS =================================================
  listRequests(
    companyId: number,
    options?: { status?: PrStatus; requesterUserId?: number },
  ): Promise<PurchaseRequestsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.status !== undefined) q.set('status', options.status);
    if (options?.requesterUserId !== undefined)
      q.set('requesterUserId', String(options.requesterUserId));
    return this.request<PurchaseRequestsResponse>(`/v1/purchasing/requests?${q.toString()}`);
  }

  createRequest(body: CreateRequestBody): Promise<PurchaseRequestDto> {
    return this.request<PurchaseRequestDto>(`/v1/purchasing/requests`, { method: 'POST', body });
  }

  updateRequest(id: number, body: UpdateRequestBody): Promise<PurchaseRequestDto> {
    return this.request<PurchaseRequestDto>(`/v1/purchasing/requests/${String(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  changeRequestStatus(id: number, body: ChangeRequestStatusBody): Promise<PurchaseRequestDto> {
    return this.request<PurchaseRequestDto>(`/v1/purchasing/requests/${String(id)}/status`, {
      method: 'POST',
      body,
    });
  }

  // ===== PURCHASE ORDERS ===================================================
  listOrders(
    companyId: number,
    options?: { status?: PoStatus; vendorId?: number },
  ): Promise<PurchaseOrdersResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.status !== undefined) q.set('status', options.status);
    if (options?.vendorId !== undefined) q.set('vendorId', String(options.vendorId));
    return this.request<PurchaseOrdersResponse>(`/v1/purchasing/orders?${q.toString()}`);
  }

  createOrder(body: CreateOrderBody): Promise<PurchaseOrderDto> {
    return this.request<PurchaseOrderDto>(`/v1/purchasing/orders`, { method: 'POST', body });
  }

  changeOrderStatus(id: number, body: ChangeOrderStatusBody): Promise<PurchaseOrderDto> {
    return this.request<PurchaseOrderDto>(`/v1/purchasing/orders/${String(id)}/status`, {
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
