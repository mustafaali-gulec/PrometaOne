/**
 * Location DTO'ları — REST sınırındaki düz tipler + ağaç kurucu.
 */
import type { Location } from '../../domain/entities/Location.js';
import type { LocationKind } from '../../domain/valueObjects/LocationKind.js';
import { allowedChildrenOf } from '../../domain/valueObjects/LocationKind.js';

export interface LocationDto {
  id: number;
  companyId: number;
  projectId: number;
  parentId: number | null;
  kind: LocationKind;
  code: string;
  name: string;
  sortOrder: number;
  path: string;
  depth: number;
  unitType: string | null;
  grossArea: number | null;
  netArea: number | null;
  landShare: number | null;
  facade: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Bu düğümün altına eklenebilecek tipler — arayüz "Ekle" menüsünü buna göre kurar. */
  allowedChildKinds: ReadonlyArray<LocationKind>;
}

export interface LocationTreeNodeDto extends LocationDto {
  children: LocationTreeNodeDto[];
  /** Alt ağaçtaki bağımsız bölüm sayısı (kendisi unit ise 1). */
  unitCount: number;
  /** Alt ağaçtaki net alan toplamı; hiç değer yoksa null. */
  netAreaTotal: number | null;
}

export function toLocationDto(l: Location): LocationDto {
  const j = l.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    parentId: j.parentId,
    kind: j.kind,
    code: j.code,
    name: j.name,
    sortOrder: j.sortOrder,
    path: j.path,
    depth: j.depth,
    unitType: j.unitType,
    grossArea: j.grossArea,
    netArea: j.netArea,
    landShare: j.landShare,
    facade: j.facade,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    allowedChildKinds: allowedChildrenOf(j.kind),
  };
}

/**
 * Düz listeyi ağaca çevirir ve alt-toplamları (bağımsız bölüm sayısı, net alan)
 * yukarı taşır.
 *
 * Ebeveyni listede OLMAYAN düğümler (filtreleme yüzünden kopmuş alt ağaçlar)
 * kök olarak eklenir — sessizce düşürmek, filtrelenmiş görünümde verinin
 * kaybolmasına yol açar ve kullanıcı bunu "veri gitti" olarak okur.
 */
export function buildLocationTree(locations: ReadonlyArray<Location>): LocationTreeNodeDto[] {
  const nodes = new Map<number, LocationTreeNodeDto>();
  for (const l of locations) {
    nodes.set(l.id, { ...toLocationDto(l), children: [], unitCount: 0, netAreaTotal: null });
  }

  const roots: LocationTreeNodeDto[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRec = (list: LocationTreeNodeDto[]): void => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, 'tr'));
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);

  // Alt-toplamlar: yapraktan köke doğru
  const rollup = (n: LocationTreeNodeDto): void => {
    for (const c of n.children) rollup(c);
    n.unitCount = (n.kind === 'unit' ? 1 : 0) + n.children.reduce((s, c) => s + c.unitCount, 0);
    const own = n.netArea;
    const childSum = n.children.reduce<number | null>(
      (s, c) => (c.netAreaTotal === null ? s : (s ?? 0) + c.netAreaTotal),
      null,
    );
    n.netAreaTotal = own === null && childSum === null ? null : (own ?? 0) + (childSum ?? 0);
  };
  for (const r of roots) rollup(r);

  return roots;
}
