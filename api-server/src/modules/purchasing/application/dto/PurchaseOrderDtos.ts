/**
 * PurchaseOrder DTO'ları.
 */
import type { PurchaseOrder } from '../../domain/entities/PurchaseOrder.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { PoStatus } from '../../domain/valueObjects/PoStatus.js';

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

export function toPurchaseOrderDto(po: PurchaseOrder): PurchaseOrderDto {
  const j = po.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    poNo: j.poNo,
    vendorId: j.vendorId,
    prId: j.prId,
    status: j.status,
    currency: j.currency,
    note: j.note,
    orderedAt: j.orderedAt ? j.orderedAt.toISOString() : null,
    deliveredAt: j.deliveredAt ? j.deliveredAt.toISOString() : null,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    totalAmount: po.totalAmount,
    lines: j.lines.map((l) => ({
      lineNo: l.lineNo,
      description: l.description,
      quantity: l.quantity,
      receivedQty: l.receivedQty,
      unitPrice: l.unitPrice,
    })),
  };
}
