/**
 * PurchasingApi — backend /v1/purchasing ile konuşan port.
 *
 * Concrete impl: infrastructure/api/PurchasingApiClient.ts (fetch wrapper).
 * Test'te mock'lanabilir.
 *
 * Tüm metodlar `companyId` taşır (multi-tenant). Yazma işlemleri backend'de
 * 'editor' (>=) rolü ister; UI bunu zorlamaz, hata dönerse kullanıcıya gösterilir.
 */
import type {
  CariClass,
  CurrencyCode,
  PersonType,
  PoStatus,
  PrStatus,
  PurchaseOrderDto,
  PurchaseOrdersResponse,
  PurchaseRequestDto,
  PurchaseRequestsResponse,
  VendorDto,
  VendorsResponse,
} from '../dto/PurchasingDtos';

// ---------------------------------------------------------------------------
// Input (body) tipleri — backend zod şemalarıyla uyumlu.
// ---------------------------------------------------------------------------
export interface CreateVendorBody {
  companyId: number;
  name: string;
  code?: string;
  taxId?: string | null;
  personType?: PersonType;
  cariClass?: CariClass;
  accountCode?: string | null;
}

export interface UpdateVendorBody {
  companyId: number;
  name?: string;
  taxId?: string | null;
  personType?: PersonType;
  cariClass?: CariClass;
  accountCode?: string | null;
}

export interface CreateRequestItemBody {
  description: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
}

export interface CreateRequestBody {
  companyId: number;
  departmentId?: number | null;
  category?: string;
  priority?: string;
  currency?: CurrencyCode;
  justification?: string | null;
  requiredBy?: string | null;
  items: CreateRequestItemBody[];
  submit?: boolean;
}

export interface UpdateRequestBody {
  companyId: number;
  category?: string;
  priority?: string;
  currency?: CurrencyCode;
  justification?: string | null;
  requiredBy?: string | null;
  items?: CreateRequestItemBody[];
}

export interface ChangeRequestStatusBody {
  companyId: number;
  status: PrStatus;
}

export interface CreateOrderLineBody {
  description: string;
  quantity: number;
  unitPrice: number;
  receivedQty?: number;
}

export interface CreateOrderBody {
  companyId: number;
  vendorId: number;
  prId?: number | null;
  currency?: CurrencyCode;
  note?: string | null;
  lines?: CreateOrderLineBody[];
  markOrdered?: boolean;
}

export interface ChangeOrderStatusBody {
  companyId: number;
  status: PoStatus;
}

export interface PurchasingApi {
  // Vendors
  listVendors(
    companyId: number,
    options?: { includeInactive?: boolean; search?: string },
  ): Promise<VendorsResponse>;
  createVendor(body: CreateVendorBody): Promise<VendorDto>;
  updateVendor(id: number, body: UpdateVendorBody): Promise<VendorDto>;
  deactivateVendor(id: number, companyId: number): Promise<VendorDto>;

  // Purchase Requests
  listRequests(
    companyId: number,
    options?: { status?: PrStatus; requesterUserId?: number },
  ): Promise<PurchaseRequestsResponse>;
  createRequest(body: CreateRequestBody): Promise<PurchaseRequestDto>;
  updateRequest(id: number, body: UpdateRequestBody): Promise<PurchaseRequestDto>;
  changeRequestStatus(id: number, body: ChangeRequestStatusBody): Promise<PurchaseRequestDto>;

  // Purchase Orders
  listOrders(
    companyId: number,
    options?: { status?: PoStatus; vendorId?: number },
  ): Promise<PurchaseOrdersResponse>;
  createOrder(body: CreateOrderBody): Promise<PurchaseOrderDto>;
  changeOrderStatus(id: number, body: ChangeOrderStatusBody): Promise<PurchaseOrderDto>;
}
