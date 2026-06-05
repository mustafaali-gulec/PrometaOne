/**
 * PurchaseRequestRepository — satınalma talebi (PR) kalıcılık portu.
 * Concrete: infrastructure/persistence/PgPurchaseRequestRepository.ts
 */
import type {
  PurchaseRequest,
  PurchaseRequestItem,
} from '../../domain/entities/PurchaseRequest.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { PrStatus } from '../../domain/valueObjects/PrStatus.js';

export interface NewPurchaseRequestInput {
  companyId: number;
  prNo: string;
  requesterUserId: number | null;
  departmentId: number | null;
  category: string;
  priority: string;
  status: PrStatus;
  currency: CurrencyCode;
  justification: string | null;
  requiredBy: Date | null;
  items: ReadonlyArray<PurchaseRequestItem>;
}

export interface ListPurchaseRequestsOptions {
  status?: PrStatus;
  requesterUserId?: number;
}

export interface PurchaseRequestRepository {
  insert(input: NewPurchaseRequestInput): Promise<PurchaseRequest>;
  /** Başlığı günceller ve kalemleri tamamen değiştirir (replace). */
  update(pr: PurchaseRequest): Promise<void>;
  findById(id: number, companyId: number): Promise<PurchaseRequest | null>;
  listByCompany(
    companyId: number,
    options?: ListPurchaseRequestsOptions,
  ): Promise<ReadonlyArray<PurchaseRequest>>;
  /** Verilen ön ek ile başlayan pr_no sayısı (numara üretimi için). */
  countByNoPrefix(companyId: number, prefix: string): Promise<number>;
}
