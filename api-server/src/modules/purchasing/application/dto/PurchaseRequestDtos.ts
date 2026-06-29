/**
 * PurchaseRequest DTO'ları.
 */
import type { PurchaseRequest } from '../../domain/entities/PurchaseRequest.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { PrStatus } from '../../domain/valueObjects/PrStatus.js';

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

export function toPurchaseRequestDto(pr: PurchaseRequest): PurchaseRequestDto {
  const j = pr.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    prNo: j.prNo,
    requesterUserId: j.requesterUserId,
    departmentId: j.departmentId,
    category: j.category,
    priority: j.priority,
    status: j.status,
    currency: j.currency,
    justification: j.justification,
    requiredBy: j.requiredBy ? j.requiredBy.toISOString().slice(0, 10) : null,
    requestedAt: j.requestedAt.toISOString(),
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    totalAmount: pr.totalAmount,
    items: j.items.map((i) => ({
      lineNo: i.lineNo,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      note: i.note,
    })),
  };
}
