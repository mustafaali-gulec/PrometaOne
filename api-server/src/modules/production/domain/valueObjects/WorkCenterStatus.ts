/**
 * WorkCenterStatus — iş merkezi durumu.
 *   active   → aktif (kapasite planlamasına dahil)
 *   passive  → pasif (arşivlenmiş)
 */
export const WORK_CENTER_STATUSES = ['active', 'passive'] as const;
export type WorkCenterStatus = (typeof WORK_CENTER_STATUSES)[number];

export function isWorkCenterStatus(value: unknown): value is WorkCenterStatus {
  return typeof value === 'string' && (WORK_CENTER_STATUSES as readonly string[]).includes(value);
}
