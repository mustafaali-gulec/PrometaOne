/**
 * Purchasing (Satınalma) modülü — Public API + DI.
 *
 * registerPurchasingModule(pool) tüm Pg* repository + use-case'leri wire eder
 * ve Hono router döndürür. index.ts bunu `/v1/purchasing` altına mount eder.
 *
 * Tedarikçi kalıcı bir cari kaydıdır (vendors); PO ona vendor_id ile bağlanır
 * (kullanıcının "tedarikçi cari hesaplarla ilişkili olmalı" talebi).
 */
import type { Pool } from 'pg';

import { SystemClock } from './application/ports/Clock.js';
import {
  ChangePoStatusUseCase,
  CreatePurchaseOrderUseCase,
  ListPurchaseOrdersUseCase,
} from './application/useCases/PurchaseOrderUseCases.js';
import {
  ChangePrStatusUseCase,
  CreatePurchaseRequestUseCase,
  ListPurchaseRequestsUseCase,
  UpdatePurchaseRequestUseCase,
} from './application/useCases/PurchaseRequestUseCases.js';
import {
  CreateVendorUseCase,
  DeactivateVendorUseCase,
  ListVendorsUseCase,
  UpdateVendorUseCase,
} from './application/useCases/VendorUseCases.js';
import { PgPurchaseOrderRepository } from './infrastructure/persistence/PgPurchaseOrderRepository.js';
import { PgPurchaseRequestRepository } from './infrastructure/persistence/PgPurchaseRequestRepository.js';
import { PgVendorRepository } from './infrastructure/persistence/PgVendorRepository.js';
import { createPurchasingRouter, type PurchasingRouterDeps } from './presentation/routes.js';

export function registerPurchasingModule(pool: Pool): ReturnType<typeof createPurchasingRouter> {
  const clock = SystemClock;

  const vendors = new PgVendorRepository(pool);
  const prs = new PgPurchaseRequestRepository(pool);
  const pos = new PgPurchaseOrderRepository(pool);

  const deps: PurchasingRouterDeps = {
    createVendor: new CreateVendorUseCase(vendors),
    listVendors: new ListVendorsUseCase(vendors),
    updateVendor: new UpdateVendorUseCase(vendors, clock),
    deactivateVendor: new DeactivateVendorUseCase(vendors, clock),
    createPurchaseRequest: new CreatePurchaseRequestUseCase(prs, clock),
    listPurchaseRequests: new ListPurchaseRequestsUseCase(prs),
    updatePurchaseRequest: new UpdatePurchaseRequestUseCase(prs, clock),
    changePrStatus: new ChangePrStatusUseCase(prs, clock),
    createPurchaseOrder: new CreatePurchaseOrderUseCase(pos, vendors, prs, clock),
    listPurchaseOrders: new ListPurchaseOrdersUseCase(pos),
    changePoStatus: new ChangePoStatusUseCase(pos, clock),
  };

  return createPurchasingRouter(deps);
}
