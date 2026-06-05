/**
 * Purchasing (Satınalma) frontend modülü — Public API.
 *
 * App.jsx ve diğer modüllere yalnız bu barrel üzerinden açılır.
 */

// --- DTO tipleri ----------------------------------------------------------
export type {
  CariClass,
  CurrencyCode,
  PersonType,
  PoStatus,
  PrStatus,
  PurchaseOrderDto,
  PurchaseOrderLineDto,
  PurchaseOrdersResponse,
  PurchaseRequestDto,
  PurchaseRequestItemDto,
  PurchaseRequestsResponse,
  VendorDto,
  VendorsResponse,
} from './application/dto/PurchasingDtos';

// --- Ports ----------------------------------------------------------------
export type {
  ChangeOrderStatusBody,
  ChangeRequestStatusBody,
  CreateOrderBody,
  CreateOrderLineBody,
  CreateRequestBody,
  CreateRequestItemBody,
  CreateVendorBody,
  PurchasingApi,
  UpdateRequestBody,
  UpdateVendorBody,
} from './application/ports/PurchasingApi';
export type { AuthTokenProvider } from './application/ports/AuthTokenProvider';
export { StaticAuthTokenProvider } from './application/ports/AuthTokenProvider';

// --- Infrastructure -------------------------------------------------------
export { PurchasingApiClient } from './infrastructure/api/PurchasingApiClient';

// --- Hooks ----------------------------------------------------------------
export { useVendors } from './presentation/hooks/useVendors';
export type { UseVendorsOptions, UseVendorsResult } from './presentation/hooks/useVendors';
export { usePurchaseRequests } from './presentation/hooks/usePurchaseRequests';
export type {
  UsePurchaseRequestsOptions,
  UsePurchaseRequestsResult,
} from './presentation/hooks/usePurchaseRequests';
export { usePurchaseOrders } from './presentation/hooks/usePurchaseOrders';
export type {
  UsePurchaseOrdersOptions,
  UsePurchaseOrdersResult,
} from './presentation/hooks/usePurchaseOrders';

// --- Components -----------------------------------------------------------
export { VendorsTable } from './presentation/components/VendorsTable';
export type { VendorsTableProps } from './presentation/components/VendorsTable';
export { PurchaseRequestsTable } from './presentation/components/PurchaseRequestsTable';
export type { PurchaseRequestsTableProps } from './presentation/components/PurchaseRequestsTable';
export { PurchaseOrdersTable } from './presentation/components/PurchaseOrdersTable';
export type { PurchaseOrdersTableProps } from './presentation/components/PurchaseOrdersTable';

// --- Demo -----------------------------------------------------------------
export { PurchasingPage } from './demo/PurchasingPage';
export type { PurchasingPageProps, PurchasingTab } from './demo/PurchasingPage';
