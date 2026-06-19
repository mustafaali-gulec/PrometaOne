/**
 * Malzeme (Material) enum value object'leri.
 *
 * DB ENUM'larıyla birebir (034_warehouse.sql):
 *   material_track_method  — none / lot / serial / serialGroup
 *   material_cost_method   — avg / fifo / lifo / actual
 *   material_status        — active / passive
 *   abc_class              — A / B / C  (opsiyonel, NULL = sınıflandırılmamış)
 *
 * negativeControl: 'block' (varsayılan) çıkış/transfer stoku negatife düşüremez;
 * 'allow' negatif stoğa izin verir (ön-fatura / hızlı satış senaryoları).
 */
import {
  InvalidCostMethodError,
  InvalidNegativeControlError,
  InvalidTrackMethodError,
} from '../errors/WarehouseErrors.js';

export type TrackMethod = 'none' | 'lot' | 'serial' | 'serialGroup';
export const ALL_TRACK_METHODS: ReadonlyArray<TrackMethod> = [
  'none',
  'lot',
  'serial',
  'serialGroup',
];
export function isTrackMethod(value: unknown): value is TrackMethod {
  return typeof value === 'string' && (ALL_TRACK_METHODS as ReadonlyArray<string>).includes(value);
}
export function toTrackMethod(value: unknown): TrackMethod {
  if (!isTrackMethod(value)) {
    throw new InvalidTrackMethodError(value);
  }
  return value;
}

export type CostMethod = 'avg' | 'fifo' | 'lifo' | 'actual';
export const ALL_COST_METHODS: ReadonlyArray<CostMethod> = ['avg', 'fifo', 'lifo', 'actual'];
export function isCostMethod(value: unknown): value is CostMethod {
  return typeof value === 'string' && (ALL_COST_METHODS as ReadonlyArray<string>).includes(value);
}
export function toCostMethod(value: unknown): CostMethod {
  if (!isCostMethod(value)) {
    throw new InvalidCostMethodError(value);
  }
  return value;
}

export type MaterialStatus = 'active' | 'passive';
export const ALL_MATERIAL_STATUSES: ReadonlyArray<MaterialStatus> = ['active', 'passive'];
export function isMaterialStatus(value: unknown): value is MaterialStatus {
  return (
    typeof value === 'string' && (ALL_MATERIAL_STATUSES as ReadonlyArray<string>).includes(value)
  );
}

export type AbcClass = 'A' | 'B' | 'C';
export const ALL_ABC_CLASSES: ReadonlyArray<AbcClass> = ['A', 'B', 'C'];
export function isAbcClass(value: unknown): value is AbcClass {
  return typeof value === 'string' && (ALL_ABC_CLASSES as ReadonlyArray<string>).includes(value);
}

export type NegativeControl = 'block' | 'allow';
export const ALL_NEGATIVE_CONTROLS: ReadonlyArray<NegativeControl> = ['block', 'allow'];
export function isNegativeControl(value: unknown): value is NegativeControl {
  return (
    typeof value === 'string' && (ALL_NEGATIVE_CONTROLS as ReadonlyArray<string>).includes(value)
  );
}
export function toNegativeControl(value: unknown): NegativeControl {
  if (!isNegativeControl(value)) {
    throw new InvalidNegativeControlError(value);
  }
  return value;
}
