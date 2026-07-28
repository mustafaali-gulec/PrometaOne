/**
 * Fiziksel ilerleme takibi DTO'ları.
 */
import type { ProgressTemplate, WeightIssue } from '../../domain/entities/ProgressTemplate.js';
import type { Tracking } from '../../domain/entities/Tracking.js';
import type { ItemState } from '../../domain/valueObjects/ItemState.js';
import type { TrackScope, TrackingStatus } from '../../domain/valueObjects/TrackingStatus.js';
import { locationKindsForScope } from '../../domain/valueObjects/TrackingStatus.js';
import type { TrackingItemRow, TrackingLocationProgress } from '../ports/TrackingRepositories.js';

// ===== ŞABLON ===============================================================

export interface TemplateItemDto {
  id: number;
  code: string;
  name: string;
  weightPct: number;
  sortOrder: number;
  pozId: number | null;
}

export interface TemplateGroupDto {
  id: number;
  code: string;
  name: string;
  weightPct: number;
  sortOrder: number;
  items: TemplateItemDto[];
}

export interface ProgressTemplateDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  scope: TrackScope;
  description: string | null;
  pctInProgress: number;
  pctHasDefects: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  groups: TemplateGroupDto[];
  itemCount: number;
  /** Boş değilse ağırlıklar 100'e tümlenmiyor — arayüz uyarı gösterir. */
  weightIssues: ReadonlyArray<WeightIssue>;
  /** Bu şablonla takip kurarken seçilebilecek lokasyon tipleri. */
  scopeLocationKinds: ReadonlyArray<string>;
}

export function toProgressTemplateDto(t: ProgressTemplate): ProgressTemplateDto {
  const j = t.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    code: j.code,
    name: j.name,
    scope: j.scope,
    description: j.description,
    pctInProgress: j.pctInProgress,
    pctHasDefects: j.pctHasDefects,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    groups: j.groups.map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      weightPct: g.weightPct,
      sortOrder: g.sortOrder,
      items: g.items.map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        weightPct: i.weightPct,
        sortOrder: i.sortOrder,
        pozId: i.pozId,
      })),
    })),
    itemCount: t.itemCount,
    weightIssues: t.weightIssues(),
    scopeLocationKinds: locationKindsForScope(j.scope),
  };
}

// ===== TAKİP ================================================================

export interface TrackingDto {
  id: number;
  companyId: number;
  projectId: number;
  templateId: number;
  code: string;
  name: string;
  projectWeightPct: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  status: TrackingStatus;
  assignedUserId: number | null;
  visibleAll: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toTrackingDto(t: Tracking): TrackingDto {
  const j = t.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    templateId: j.templateId,
    code: j.code,
    name: j.name,
    projectWeightPct: j.projectWeightPct,
    plannedStart: j.plannedStart,
    plannedEnd: j.plannedEnd,
    status: j.status,
    assignedUserId: j.assignedUserId,
    visibleAll: j.visibleAll,
    note: j.note,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

/** Takip listesi satırı — ilerleme yüzdesi ve sapma ile zenginleştirilmiş. */
export interface TrackingListRowDto extends TrackingDto {
  progressPct: number;
  locationCount: number;
  /** Takvime göre beklenen ilerleme; plan tarihi yoksa null. */
  plannedPct: number | null;
  /** progressPct − plannedPct; plan yoksa null. Negatif = geride. */
  deviationPct: number | null;
}

/**
 * Saha ekranı verisi: lokasyon sekmeleri + o lokasyonun grup/iş matrisi.
 * Imperium'un "İÇERİK" sekmesinin karşılığı.
 */
export interface TrackingBoardDto {
  tracking: TrackingDto;
  templateName: string;
  pctInProgress: number;
  pctHasDefects: number;
  progressPct: number;
  plannedPct: number | null;
  deviationPct: number | null;
  locations: ReadonlyArray<TrackingLocationBoardDto>;
}

export interface TrackingLocationBoardDto {
  trackingLocationId: number;
  locationId: number;
  locationName: string;
  locationPath: string;
  weightPct: number;
  progressPct: number;
  itemCount: number;
  completedCount: number;
  defectCount: number;
  inProgressCount: number;
  groups: ReadonlyArray<TrackingBoardGroupDto>;
}

export interface TrackingBoardGroupDto {
  groupId: number;
  groupName: string;
  groupWeight: number;
  /** Grubun kendi içindeki ağırlıklı ilerlemesi (0-100). */
  progressPct: number;
  items: ReadonlyArray<TrackingBoardItemDto>;
}

export interface TrackingBoardItemDto {
  trackingItemId: number;
  templateItemId: number;
  itemName: string;
  itemWeight: number;
  state: ItemState;
  overridePct: number | null;
  effectivePct: number;
  inspectedBy: number | null;
  inspectedAt: string | null;
  note: string | null;
  pozId: number | null;
}

/**
 * Satır listesini lokasyon → grup → iş ağacına çevirir.
 *
 * Grup ilerlemesi grup İÇİ ağırlıklara göre normalize edilir (grup ağırlığı
 * çarpan olarak girmez): kullanıcı "Temel %52,5 bitti" görmek ister, "Temel'in
 * projeye katkısı %21" bilgisi ayrı bir okumadır ve lokasyon yüzdesinde durur.
 */
export function buildTrackingBoard(
  tracking: TrackingDto,
  templateName: string,
  pctInProgress: number,
  pctHasDefects: number,
  progressPct: number,
  plannedPct: number | null,
  locProgress: ReadonlyArray<TrackingLocationProgress>,
  items: ReadonlyArray<TrackingItemRow>,
): TrackingBoardDto {
  const byLoc = new Map<number, TrackingItemRow[]>();
  for (const it of items) {
    const arr = byLoc.get(it.trackingLocationId);
    if (arr) arr.push(it);
    else byLoc.set(it.trackingLocationId, [it]);
  }

  const locations: TrackingLocationBoardDto[] = locProgress.map((lp) => {
    const rows = byLoc.get(lp.trackingLocationId) ?? [];
    const groupMap = new Map<number, TrackingBoardGroupDto & { items: TrackingBoardItemDto[] }>();

    for (const r of rows) {
      let g = groupMap.get(r.groupId);
      if (!g) {
        g = {
          groupId: r.groupId,
          groupName: r.groupName,
          groupWeight: r.groupWeight,
          progressPct: 0,
          items: [],
        };
        groupMap.set(r.groupId, g);
      }
      g.items.push({
        trackingItemId: r.id,
        templateItemId: r.templateItemId,
        itemName: r.itemName,
        itemWeight: r.itemWeight,
        state: r.state,
        overridePct: r.overridePct,
        effectivePct: r.effectivePct,
        inspectedBy: r.inspectedBy,
        inspectedAt: r.inspectedAt,
        note: r.note,
        pozId: r.pozId,
      });
    }

    const groups = [...groupMap.values()];
    for (const g of groups) {
      const den = g.items.reduce((s, i) => s + i.itemWeight, 0);
      const num = g.items.reduce((s, i) => s + i.effectivePct * i.itemWeight, 0);
      g.progressPct = den === 0 ? 0 : num / den;
    }

    return {
      trackingLocationId: lp.trackingLocationId,
      locationId: lp.locationId,
      locationName: lp.locationName,
      locationPath: lp.locationPath,
      weightPct: lp.weightPct,
      progressPct: lp.progressPct,
      itemCount: lp.itemCount,
      completedCount: lp.completedCount,
      defectCount: lp.defectCount,
      inProgressCount: lp.inProgressCount,
      groups,
    };
  });

  return {
    tracking,
    templateName,
    pctInProgress,
    pctHasDefects,
    progressPct,
    plannedPct,
    deviationPct: plannedPct === null ? null : progressPct - plannedPct,
    locations,
  };
}
