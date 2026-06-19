/**
 * LocationStatus — depo adres/göz durumu.
 *
 * DB ENUM `location_status` (034): active / passive / blocked.
 *   active  — kullanılabilir
 *   passive — pasif (yeni yerleştirme yapılmaz)
 *   blocked — bloke (sayım/karantina; hareket girilemez)
 */
export type LocationStatus = 'active' | 'passive' | 'blocked';

export const ALL_LOCATION_STATUSES: ReadonlyArray<LocationStatus> = [
  'active',
  'passive',
  'blocked',
];

export function isLocationStatus(value: unknown): value is LocationStatus {
  return (
    typeof value === 'string' && (ALL_LOCATION_STATUSES as ReadonlyArray<string>).includes(value)
  );
}
