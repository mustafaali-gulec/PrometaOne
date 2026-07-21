/**
 * AdoptBlob DTO'ları — blob (promet:data) satınalma koleksiyonlarının tek
 * seferlik, idempotent devralınması (POST /v1/purchasing/adopt-blob).
 *
 * Girdi blob alan adlarıyla GEVŞEK gelir (frontend/src/App.jsx'ten doğrulanan
 * gerçek şekiller):
 *   vendors  ← accParties (type: supplier|both) = { id:"party_...", code, name,
 *     taxId (bazı akışlarda taxNumber), personType:'real'|'legal', vatOffice,
 *     address, status:'active'|..., accounting:{ cariClass, accountCode_satici,
 *     accountCode_alici, ... }, ... }
 *   requests ← purchaseRequests = { id:"pr_...", prNo, requesterUsername,
 *     departmentId, status, priority, category, items:[{description, quantity,
 *     unitPrice, total, note}], totalAmount, currency, requestedAt, requiredBy,
 *     justification, linkedPOId, ... }
 *   orders   ← purchaseOrders = { id:"po_...", poNo, vendorId (party clientId),
 *     sourcePRId (pr clientId), status:'draft|sent|confirmed|partial|received|
 *     invoiced|closed|cancelled', items:[{description, quantity, unitPrice,
 *     total, receivedQty, note}], totalAmount, currency, orderedAt,
 *     expectedDelivery, deliveredAt, paymentTerms, deliveryAddress,
 *     notes/note, ... }
 *
 * Normalizasyon (blob → tablo kolonu) AdoptBlobPurchasingUseCase'te yapılır;
 * buradaki Normalized* tipleri repository'nin yazacağı temiz satırlardır.
 */
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { PoStatus } from '../../domain/valueObjects/PoStatus.js';
import type { PrStatus } from '../../domain/valueObjects/PrStatus.js';

// ===== Girdi (gevşek blob kayıtları) ========================================

export interface AdoptBlobInput {
  companyId: number;
  vendors?: ReadonlyArray<Record<string, unknown>> | undefined;
  requests?: ReadonlyArray<Record<string, unknown>> | undefined;
  orders?: ReadonlyArray<Record<string, unknown>> | undefined;
}

// ===== Normalize satırlar (repository sözleşmesi) ===========================

export interface NormalizedVendor {
  clientId: string;
  code: string;
  name: string;
  taxId: string | null;
  personType: 'real' | 'legal';
  cariClass: 'satici' | 'alici';
  accountCode: string | null;
  taxOffice: string | null;
  address: string | null;
  active: boolean;
}

export interface NormalizedPrItem {
  lineNo: number;
  description: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
}

export interface NormalizedRequest {
  clientId: string;
  prNo: string;
  requesterUsername: string | null;
  departmentId: number | null;
  category: string;
  priority: string;
  status: PrStatus;
  currency: CurrencyCode;
  totalAmount: number;
  justification: string | null;
  requiredBy: string | null;
  requestedAt: string | null;
  items: NormalizedPrItem[];
}

export interface NormalizedPoLine {
  lineNo: number;
  description: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
}

export interface NormalizedOrder {
  clientId: string;
  poNo: string;
  /** Blob accParties id'si — repository vendors.client_id üzerinden çözer. */
  vendorClientId: string | null;
  /** Blob purchaseRequests id'si — repository purchase_requests.client_id üzerinden çözer. */
  prClientId: string | null;
  status: PoStatus;
  currency: CurrencyCode;
  totalAmount: number;
  orderedAt: string | null;
  deliveredAt: string | null;
  note: string | null;
  lines: NormalizedPoLine[];
}

// ===== Sonuç ================================================================

export interface AdoptBlobResultDto {
  adopted: { vendors: number; requests: number; orders: number };
  /** Referansı çözülemediği için atlananlar (ör. tedarikçisi bilinmeyen PO). */
  skipped: { orders: number };
  /** clientId → serverId (BIGSERIAL güvenliği için string). */
  idMap: {
    vendors: Record<string, string>;
    requests: Record<string, string>;
    orders: Record<string, string>;
  };
}
