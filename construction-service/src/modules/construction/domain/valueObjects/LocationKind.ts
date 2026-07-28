/**
 * LocationKind — mekân kırılımı seviyeleri. Tablo: cs_locations.kind (005).
 *
 * Ağaç serbest derinlikte değildir; şantiye gerçeğine uygun bir sıra dayatır:
 *
 *   site  → blok | bölge
 *   block → kat  | bölge
 *   floor → bağımsız bölüm
 *   zone  → bölge (kendi içinde alt bölge alabilir: şev > berm gibi)
 *   unit  → yaprak (altına bir şey gelmez)
 *
 * Bu kısıt kasıtlı: "Daire 18'in altında bir blok" gibi anlamsız ağaçlar
 * kurulmasını engeller ve fiziksel ilerleme şablonlarının kapsam (scope)
 * seçimini deterministik yapar.
 */
export const LOCATION_KINDS = ['site', 'block', 'floor', 'unit', 'zone'] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export function isLocationKind(v: unknown): v is LocationKind {
  return typeof v === 'string' && (LOCATION_KINDS as readonly string[]).includes(v);
}

/** Verilen tipin altına hangi tipler gelebilir? */
const ALLOWED_CHILDREN: Readonly<Record<LocationKind, ReadonlyArray<LocationKind>>> = {
  site: ['block', 'zone'],
  block: ['floor', 'zone'],
  floor: ['unit'],
  zone: ['zone'],
  unit: [],
};

/** Kök (parent_id NULL) olarak durabilen tipler. */
const ALLOWED_ROOTS: ReadonlyArray<LocationKind> = ['site', 'block', 'zone'];

export function canBeRoot(kind: LocationKind): boolean {
  return ALLOWED_ROOTS.includes(kind);
}

export function canNest(parent: LocationKind, child: LocationKind): boolean {
  return ALLOWED_CHILDREN[parent].includes(child);
}

export function allowedChildrenOf(parent: LocationKind): ReadonlyArray<LocationKind> {
  return ALLOWED_CHILDREN[parent];
}

/** İnsan-okur etiket (hata mesajlarında kullanılır; UI kendi i18n'ini yapar). */
const LABELS: Readonly<Record<LocationKind, string>> = {
  site: 'saha',
  block: 'blok',
  floor: 'kat',
  unit: 'bağımsız bölüm',
  zone: 'bölge',
};

export function locationKindLabel(kind: LocationKind): string {
  return LABELS[kind];
}
