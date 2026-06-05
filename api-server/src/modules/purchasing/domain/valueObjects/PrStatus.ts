/**
 * PrStatus — satınalma talebi (PR) statüsü ve izinli geçiş kuralları.
 */
export const PR_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'ordered',
  'received',
  'closed',
] as const;

export type PrStatus = (typeof PR_STATUSES)[number];

/** Her statüden geçilebilecek statüler. */
const ALLOWED: Readonly<Record<PrStatus, ReadonlyArray<PrStatus>>> = {
  draft: ['pending_approval', 'closed'],
  pending_approval: ['approved', 'rejected', 'draft'],
  approved: ['ordered', 'closed'],
  rejected: [],
  ordered: ['received', 'closed'],
  received: ['closed'],
  closed: [],
};

export function isPrStatus(v: unknown): v is PrStatus {
  return typeof v === 'string' && (PR_STATUSES as ReadonlyArray<string>).includes(v);
}

export function canTransitionPr(from: PrStatus, to: PrStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}
