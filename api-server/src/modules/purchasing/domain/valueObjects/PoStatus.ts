/**
 * PoStatus — satınalma siparişi (PO) statüsü ve izinli geçiş kuralları.
 */
export const PO_STATUSES = [
  'draft',
  'ordered',
  'partial',
  'received',
  'closed',
  'cancelled',
  'invoiced',
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

const ALLOWED: Readonly<Record<PoStatus, ReadonlyArray<PoStatus>>> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['partial', 'received', 'cancelled'],
  partial: ['received', 'cancelled'],
  received: ['invoiced', 'closed'],
  invoiced: ['closed'],
  closed: [],
  cancelled: [],
};

export function isPoStatus(v: unknown): v is PoStatus {
  return typeof v === 'string' && (PO_STATUSES as ReadonlyArray<string>).includes(v);
}

export function canTransitionPo(from: PoStatus, to: PoStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}
