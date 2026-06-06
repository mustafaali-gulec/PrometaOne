/**
 * Stok hareket türü + malzeme talebi durum makinesi (cs_stock_move_kind /
 * cs_mreq_status aynaları).
 *
 * Stok etkisi: in/adjust → to_warehouse (+), out/waste → from_warehouse (−),
 * transfer → from (−) + to (+).
 * Talep durumu: draft→submitted→approved→fulfilled ; reject→draft ; cancel.
 */
export const STOCK_MOVE_KINDS = ['in', 'out', 'transfer', 'adjust', 'waste'] as const;
export type StockMoveKind = (typeof STOCK_MOVE_KINDS)[number];

export function isStockMoveKind(v: unknown): v is StockMoveKind {
  return typeof v === 'string' && (STOCK_MOVE_KINDS as ReadonlyArray<string>).includes(v);
}

export const MREQ_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'fulfilled',
  'cancelled',
] as const;
export type MaterialRequestStatus = (typeof MREQ_STATUSES)[number];

export function isMreqStatus(v: unknown): v is MaterialRequestStatus {
  return typeof v === 'string' && (MREQ_STATUSES as ReadonlyArray<string>).includes(v);
}

const ALLOWED: Readonly<Record<MaterialRequestStatus, ReadonlyArray<MaterialRequestStatus>>> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['fulfilled', 'cancelled'],
  rejected: ['draft', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

export function canTransitionMreq(from: MaterialRequestStatus, to: MaterialRequestStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from].includes(to);
}

export function isMreqEditable(status: MaterialRequestStatus): boolean {
  return status === 'draft' || status === 'rejected';
}
