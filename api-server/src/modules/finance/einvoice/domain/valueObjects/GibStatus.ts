/**
 * GibStatus — GİB / entegratör tarafındaki fatura durumu.
 *
 * GİB durum kodları zamanla değişebildiği için strict union yerine "bilinen
 * değerler + serbest string" yaklaşımı: bilinmeyen kod gelirse reddetmek yerine
 * olduğu gibi taşırız (cache kaydı kaybolmasın). `normalizeGibStatus` bilinen
 * değeri döndürür, boş/null'ı null'a indirger.
 */
export type KnownGibStatus = 'KABUL_EDILDI' | 'RED' | 'ISLENIYOR' | 'BEKLEMEDE' | 'IADE_EDILDI';

export const ALL_KNOWN_GIB_STATUSES: ReadonlyArray<KnownGibStatus> = [
  'KABUL_EDILDI',
  'RED',
  'ISLENIYOR',
  'BEKLEMEDE',
  'IADE_EDILDI',
];

export function isKnownGibStatus(value: unknown): value is KnownGibStatus {
  return (
    typeof value === 'string' && (ALL_KNOWN_GIB_STATUSES as ReadonlyArray<string>).includes(value)
  );
}

/** Boş/whitespace → null; aksi halde trim'lenmiş string (bilinmese de korunur). */
export function normalizeGibStatus(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
