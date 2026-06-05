/**
 * Purchasing (Satınalma) frontend DTO tipleri — backend /v1/purchasing JSON
 * sözleşmesinin birebir aynası (api-server/src/modules/purchasing/application/dto/*).
 *
 * Para alanları sayı (number) olarak gelir; tutar gösterimi salt görüntülemedir.
 * NOT: backend bigint id'leri runtime'da JSON string olarak serileştirir
 * (örn. "id":"2"); TS tipi `number` kalır (backend DTO ile uyumlu) ve id yalnız
 * React key / URL path param olarak kullanılır (String(id), asla aritmetik yok).
 */

// ---------------------------------------------------------------------------
// Value-object union'ları
// ---------------------------------------------------------------------------
export type PersonType = 'real' | 'legal';
export type CariClass = 'satici' | 'alici';
export type CurrencyCode = 'TRY' | 'USD' | 'EUR';
export type PrStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'ordered'
  | 'received'
  | 'closed';
export type PoStatus =
  | 'draft'
  | 'ordered'
  | 'partial'
  | 'received'
  | 'closed'
  | 'cancelled'
  | 'invoiced';

// ---------------------------------------------------------------------------
// Vendor (Tedarikçi)
// ---------------------------------------------------------------------------
export interface VendorDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  taxId: string | null;
  personType: PersonType;
  cariClass: CariClass;
  accountCode: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VendorsResponse {
  vendors: VendorDto[];
}

// ---------------------------------------------------------------------------
// Purchase Request (Talep)
// ---------------------------------------------------------------------------
export interface PurchaseRequestItemDto {
  lineNo: number;
  description: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
}

export interface PurchaseRequestDto {
  id: number;
  companyId: number;
  prNo: string;
  requesterUserId: number | null;
  departmentId: number | null;
  category: string;
  priority: string;
  status: PrStatus;
  currency: CurrencyCode;
  justification: string | null;
  requiredBy: string | null;
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  items: PurchaseRequestItemDto[];
}

export interface PurchaseRequestsResponse {
  requests: PurchaseRequestDto[];
}

// ---------------------------------------------------------------------------
// Purchase Order (Sipariş)
// ---------------------------------------------------------------------------
export interface PurchaseOrderLineDto {
  lineNo: number;
  description: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
}

export interface PurchaseOrderDto {
  id: number;
  companyId: number;
  poNo: string;
  vendorId: number;
  prId: number | null;
  status: PoStatus;
  currency: CurrencyCode;
  note: string | null;
  orderedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  lines: PurchaseOrderLineDto[];
}

export interface PurchaseOrdersResponse {
  orders: PurchaseOrderDto[];
}
