/**
 * Fiziksel ilerleme takibi kalıcılık portları.
 * Concrete: infrastructure/persistence/PgTrackingRepositories.ts
 */
import type { ProgressTemplate } from '../../domain/entities/ProgressTemplate.js';
import type { Tracking, TrackingLocationProps } from '../../domain/entities/Tracking.js';
import type { ItemState } from '../../domain/valueObjects/ItemState.js';
import type { TrackScope, TrackingStatus } from '../../domain/valueObjects/TrackingStatus.js';

// ===== ŞABLON ===============================================================

export interface NewTemplateInput {
  companyId: number;
  code: string;
  name: string;
  scope: TrackScope;
  description: string | null;
  pctInProgress: number;
  pctHasDefects: number;
  createdBy: number | null;
}

/** Şablon gövdesi tam-değiştirme (replace) ile kaydedilir — kısmi patch yok. */
export interface TemplateBodyInput {
  groups: ReadonlyArray<{
    code: string;
    name: string;
    weightPct: number;
    sortOrder: number;
    items: ReadonlyArray<{
      code: string;
      name: string;
      weightPct: number;
      sortOrder: number;
      pozId: number | null;
    }>;
  }>;
}

export interface ListTemplatesOptions {
  includeInactive?: boolean;
  scope?: TrackScope;
  search?: string;
}

export interface ProgressTemplateRepository {
  insert(input: NewTemplateInput): Promise<ProgressTemplate>;
  update(template: ProgressTemplate): Promise<void>;
  /** Gövdeyi (grup+iş) tamamen değiştirir. Kullanımdaki takipler etkilenmez. */
  replaceBody(templateId: number, companyId: number, body: TemplateBodyInput): Promise<void>;
  findById(id: number, companyId: number): Promise<ProgressTemplate | null>;
  listByCompany(
    companyId: number,
    options?: ListTemplatesOptions,
  ): Promise<ReadonlyArray<ProgressTemplate>>;
  existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean>;
  /** Şablonu kullanan aktif/taslak takip sayısı — gövde değiştirme uyarısı için. */
  usageCount(id: number, companyId: number): Promise<number>;
}

// ===== TAKİP ================================================================

export interface NewTrackingInput {
  companyId: number;
  projectId: number;
  templateId: number;
  code: string;
  name: string;
  projectWeightPct: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  assignedUserId: number | null;
  visibleAll: boolean;
  note: string | null;
  createdBy: number | null;
  /** Kapsam lokasyonları — her biri için şablonun tüm işleri materyalize edilir. */
  locations: ReadonlyArray<{ locationId: number; weightPct: number; sortOrder: number }>;
}

export interface ListTrackingsOptions {
  projectId?: number;
  status?: TrackingStatus;
  includeCancelled?: boolean;
  search?: string;
}

/** Saha durum satırı — okuma modeli (view + JOIN'lerden gelir). */
export interface TrackingItemRow {
  id: number;
  trackingId: number;
  trackingLocationId: number;
  locationId: number;
  locationPath: string;
  templateItemId: number;
  groupId: number;
  groupName: string;
  groupWeight: number;
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

export interface TrackingLocationProgress {
  trackingLocationId: number;
  locationId: number;
  locationPath: string;
  locationName: string;
  weightPct: number;
  progressPct: number;
  itemCount: number;
  completedCount: number;
  defectCount: number;
  inProgressCount: number;
}

export interface TrackingProgress {
  trackingId: number;
  projectId: number;
  projectWeightPct: number;
  progressPct: number;
  locationCount: number;
}

export interface ProjectPhysicalProgress {
  projectId: number;
  progressPct: number;
  /** Takip ağırlıklarının toplamı; <100 ise ölçülmeyen iş payı var. */
  weightSum: number;
  trackingCount: number;
}

export interface SetItemStateInput {
  trackingItemId: number;
  companyId: number;
  state: ItemState;
  overridePct: number | null;
  inspectedBy: number | null;
  inspectedAt: string | null;
  note: string | null;
  changedBy: number | null;
}

export interface TrackingItemHistoryRow {
  id: number;
  trackingItemId: number;
  fromState: ItemState | null;
  toState: ItemState;
  fromPct: number | null;
  toPct: number;
  changedBy: number | null;
  changedAt: string;
  note: string | null;
}

export interface TrackingRepository {
  /** Takibi + kapsam lokasyonlarını + materyalize durum satırlarını tek transaction'da kurar. */
  insert(input: NewTrackingInput): Promise<Tracking>;
  update(tracking: Tracking): Promise<void>;
  findById(id: number, companyId: number): Promise<Tracking | null>;
  listByCompany(
    companyId: number,
    options?: ListTrackingsOptions,
  ): Promise<ReadonlyArray<Tracking>>;
  existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean>;
  listLocations(
    trackingId: number,
    companyId: number,
  ): Promise<ReadonlyArray<TrackingLocationProps>>;
  listItems(trackingId: number, companyId: number): Promise<ReadonlyArray<TrackingItemRow>>;
  findItem(trackingItemId: number, companyId: number): Promise<TrackingItemRow | null>;
  /** Durumu yazar ve geçmişe satır düşer (aynı transaction). */
  setItemState(input: SetItemStateInput): Promise<TrackingItemRow>;
  /** Toplu durum güncelleme — saha ekranında çoklu tik için. */
  setItemStates(inputs: ReadonlyArray<SetItemStateInput>): Promise<ReadonlyArray<TrackingItemRow>>;
  itemHistory(
    trackingItemId: number,
    companyId: number,
  ): Promise<ReadonlyArray<TrackingItemHistoryRow>>;
  locationProgress(
    trackingId: number,
    companyId: number,
  ): Promise<ReadonlyArray<TrackingLocationProgress>>;
  trackingProgress(trackingId: number, companyId: number): Promise<TrackingProgress | null>;
  /**
   * Birden çok takibin ilerlemesini tek sorguda okur. Liste ekranı ve proje
   * özeti bunu kullanır — takip başına ayrı sorgu (N+1) atmamak için.
   */
  listTrackingProgress(
    companyId: number,
    filter: { projectId?: number; trackingIds?: ReadonlyArray<number> },
  ): Promise<ReadonlyArray<TrackingProgress>>;
  projectProgress(projectId: number, companyId: number): Promise<ProjectPhysicalProgress>;
  /**
   * Şablon gövdesi büyüdüğünde eksik durum satırlarını üretir (mevcutlara
   * dokunmaz). Şablona sonradan iş eklenen takipler böylece güncellenir.
   */
  syncItemsWithTemplate(trackingId: number, companyId: number): Promise<number>;
  /** Kapsama yeni lokasyon ekler + satırlarını materyalize eder. */
  addLocations(
    trackingId: number,
    companyId: number,
    locations: ReadonlyArray<{ locationId: number; weightPct: number; sortOrder: number }>,
  ): Promise<ReadonlyArray<TrackingLocationProps>>;
  removeLocation(trackingId: number, companyId: number, trackingLocationId: number): Promise<void>;
}
