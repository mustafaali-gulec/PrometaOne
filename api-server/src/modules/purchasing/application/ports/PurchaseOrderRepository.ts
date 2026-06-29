/**
 * PurchaseOrderRepository — satınalma siparişi (PO) kalıcılık portu.
 * Concrete: infrastructure/persistence/PgPurchaseOrderRepository.ts
 */
import type { PurchaseOrder, PurchaseOrderLine } from '../../domain/entities/PurchaseOrder.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { PoStatus } from '../../domain/valueObjects/PoStatus.js';

export interface NewPurchaseOrderInput {
  companyId: number;
  poNo: string;
  vendorId: number;
  prId: number | null;
  status: PoStatus;
  currency: CurrencyCode;
  note: string | null;
  orderedAt: Date | null;
  createdBy: number | null;
  lines: ReadonlyArray<PurchaseOrderLine>;
}

export interface ListPurchaseOrdersOptions {
  status?: PoStatus;
  vendorId?: number;
}

export interface PurchaseOrderRepository {
  insert(input: NewPurchaseOrderInput): Promise<PurchaseOrder>;
  /** Başlığı günceller ve satırları tamamen değiştirir (replace). */
  update(po: PurchaseOrder): Promise<void>;
  findById(id: number, companyId: number): Promise<PurchaseOrder | null>;
  listByCompany(
    companyId: number,
    options?: ListPurchaseOrdersOptions,
  ): Promise<ReadonlyArray<PurchaseOrder>>;
  /** Verilen ön ek ile başlayan po_no sayısı (numara üretimi için). */
  countByNoPrefix(companyId: number, prefix: string): Promise<number>;
}
