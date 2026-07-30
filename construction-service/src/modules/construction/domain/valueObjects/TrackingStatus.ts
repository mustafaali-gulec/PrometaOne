/**
 * TrackScope / TrackingStatus — DB cs_track_scope & cs_tracking_status ENUM aynası.
 * (006_physical_progress.sql)
 *
 * scope, şablonun hangi mekân seviyesinde uygulandığını söyler ve takip
 * oluşturulurken kapsam lokasyonlarının seçilebileceği lokasyon tipini belirler:
 *   general → projenin kökü tek lokasyon (site/zone)
 *   block   → bloklar
 *   floor   → katlar
 *   unit    → bağımsız bölümler
 */
import type { LocationKind } from './LocationKind.js';

export const TRACK_SCOPES = ['general', 'block', 'floor', 'unit'] as const;
export type TrackScope = (typeof TRACK_SCOPES)[number];

export const TRACKING_STATUSES = ['draft', 'active', 'completed', 'cancelled'] as const;
export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export function isTrackScope(v: unknown): v is TrackScope {
  return typeof v === 'string' && (TRACK_SCOPES as ReadonlyArray<string>).includes(v);
}

export function isTrackingStatus(v: unknown): v is TrackingStatus {
  return typeof v === 'string' && (TRACKING_STATUSES as ReadonlyArray<string>).includes(v);
}

/** scope → kapsam lokasyonu olarak seçilebilen lokasyon tipleri. */
const SCOPE_KINDS: Readonly<Record<TrackScope, ReadonlyArray<LocationKind>>> = {
  general: ['site', 'zone'],
  block: ['block'],
  floor: ['floor'],
  unit: ['unit'],
};

export function locationKindsForScope(scope: TrackScope): ReadonlyArray<LocationKind> {
  return SCOPE_KINDS[scope];
}

export function scopeAcceptsKind(scope: TrackScope, kind: LocationKind): boolean {
  return SCOPE_KINDS[scope].includes(kind);
}

/**
 * İzin verilen takip durum geçişleri.
 *
 * 'completed' → 'active' geri dönüşü bilinçli olarak AÇIK: saha kapatılan bir
 * takipte eksik çıktığında (kabul denetiminde red) takip yeniden açılmalıdır.
 * 'cancelled' terminal — iptal edilen takip proje yüzdesine hiç katılmaz.
 */
const ALLOWED: Readonly<Record<TrackingStatus, ReadonlyArray<TrackingStatus>>> = {
  draft: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: ['active'],
  cancelled: [],
};

export function canTransitionTracking(from: TrackingStatus, to: TrackingStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}
