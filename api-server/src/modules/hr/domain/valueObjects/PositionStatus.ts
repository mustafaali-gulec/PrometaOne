/**
 * PositionStatus — pozisyon yaşam döngüsü.
 *
 * Durum makinesi:
 *   draft → open    (yayınla)
 *   open  → closed  (kapat — başvuru almıyor)
 *   draft → closed  (taslağı iptal et)
 *   closed → open   (yeniden aç)
 *
 * Yasak: closed → draft, open → draft (geri taslağa dönmez).
 */
export type PositionStatus = 'draft' | 'open' | 'closed';

export const ALL_POSITION_STATUSES: ReadonlyArray<PositionStatus> = ['draft', 'open', 'closed'];

/**
 * Belirli bir Position status'ünden hangi status'lere geçilebileceğini döner.
 */
export function allowedPositionTransitions(from: PositionStatus): ReadonlyArray<PositionStatus> {
  switch (from) {
    case 'draft':
      return ['open', 'closed'];
    case 'open':
      return ['closed'];
    case 'closed':
      return ['open'];
  }
}

export function isPositionTransitionAllowed(from: PositionStatus, to: PositionStatus): boolean {
  return allowedPositionTransitions(from).includes(to);
}

export class InvalidPositionTransitionError extends Error {
  constructor(
    public readonly from: PositionStatus,
    public readonly to: PositionStatus,
  ) {
    super(`Position status geçişi yasak: ${from} → ${to}`);
    this.name = 'InvalidPositionTransitionError';
  }
}
