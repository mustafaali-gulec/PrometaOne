/**
 * AssetStatus — zimmet/varlık yaşam döngüsü durum makinesi.
 *
 *   in_stock    ↔ assigned       (atama / iade)
 *   in_stock    ↔ maintenance    (bakıma al / bakımdan dön)
 *   any         → retired        (hurdaya ayır — terminal)
 *   any         → lost           (kayıp — terminal)
 *
 * retired/lost terminaldir; başka duruma geçmez.
 * assigned'a yalnızca in_stock'tan geçilir (önce iade/bakımdan dönüş gerekir).
 */
export type AssetStatus = 'in_stock' | 'assigned' | 'maintenance' | 'retired' | 'lost';

export const ALL_ASSET_STATUSES: ReadonlyArray<AssetStatus> = [
  'in_stock',
  'assigned',
  'maintenance',
  'retired',
  'lost',
];

export const TERMINAL_ASSET_STATUSES: ReadonlyArray<AssetStatus> = ['retired', 'lost'];

export function isTerminalAssetStatus(status: AssetStatus): boolean {
  return TERMINAL_ASSET_STATUSES.includes(status);
}

export function allowedAssetTransitions(from: AssetStatus): ReadonlyArray<AssetStatus> {
  switch (from) {
    case 'in_stock':
      return ['assigned', 'maintenance', 'retired', 'lost'];
    case 'assigned':
      return ['in_stock', 'retired', 'lost'];
    case 'maintenance':
      return ['in_stock', 'retired', 'lost'];
    case 'retired':
    case 'lost':
      return []; // terminal
  }
}

export function isAssetTransitionAllowed(from: AssetStatus, to: AssetStatus): boolean {
  return allowedAssetTransitions(from).includes(to);
}

export class InvalidAssetTransitionError extends Error {
  constructor(
    public readonly from: AssetStatus,
    public readonly to: AssetStatus,
  ) {
    super(`Asset status geçişi yasak: ${from} → ${to}`);
    this.name = 'InvalidAssetTransitionError';
  }
}
