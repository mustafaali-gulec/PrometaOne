/**
 * MovementKind — stok hareketi türü.
 *
 * DB ENUM `stock_movement_kind` (034): in / out / transfer / count.
 *   in       — giriş (satın alma, iade, üretim girişi)
 *   out      — çıkış (satış, sarf, fire, üretim sarfı)
 *   transfer — depolar arası transfer (fromWarehouse − / toWarehouse +)
 *   count    — sayım düzeltmesi (işaretli; + fazlalık, − eksiklik)
 *
 * Stok hareketlerden TÜRETİLİR (saklanan mutable bakiye yoktur).
 */
import { InvalidMovementKindError } from '../errors/WarehouseErrors.js';

export type MovementKind = 'in' | 'out' | 'transfer' | 'count';

export const ALL_MOVEMENT_KINDS: ReadonlyArray<MovementKind> = ['in', 'out', 'transfer', 'count'];

export function isMovementKind(value: unknown): value is MovementKind {
  return typeof value === 'string' && (ALL_MOVEMENT_KINDS as ReadonlyArray<string>).includes(value);
}

export function toMovementKind(value: unknown): MovementKind {
  if (!isMovementKind(value)) {
    throw new InvalidMovementKindError(value);
  }
  return value;
}

/** Hareket no öneki (GİR-2026-0001 vb.). */
export const MOVEMENT_NO_PREFIX: Readonly<Record<MovementKind, string>> = {
  in: 'GİR',
  out: 'ÇIK',
  transfer: 'TRF',
  count: 'SAY',
};
