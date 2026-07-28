/**
 * Fiziksel ilerleme takibi use-case'leri (FAZ 2).
 *
 * İki ayrı yaşam döngüsü var:
 *   1) ŞABLON (şirket katmanı) — ağırlık iskeleti, projeler arası yeniden kullanılır
 *   2) TAKİP (proje katmanı)  — şablonun bir projeye + lokasyon kümesine uygulanması
 *
 * Takip oluşturulurken şablonun tüm işleri × kapsamdaki tüm lokasyonlar
 * materyalize edilir. Bu bilinçli bir yer/zaman ödünüdür: 12 iş × 50 daire = 600
 * satır, ama saha ekranı tek sorguyla tam tabloyu çekiyor ve şablon sonradan
 * değişse bile girilmiş saha verisi bozulmuyor.
 */
import type { Tracking } from '../../domain/entities/Tracking.js';
import {
  DuplicateProgressTemplateCodeError,
  DuplicateTrackingCodeError,
  InvalidTrackingScopeError,
  LocationNotFoundError,
  ProgressTemplateNotFoundError,
  ProjectNotFoundError,
  TrackingItemNotFoundError,
  TrackingNotActiveError,
  TrackingNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import type { ItemState } from '../../domain/valueObjects/ItemState.js';
import { locationKindLabel } from '../../domain/valueObjects/LocationKind.js';
import {
  scopeAcceptsKind,
  type TrackScope,
  type TrackingStatus,
} from '../../domain/valueObjects/TrackingStatus.js';
import {
  buildTrackingBoard,
  toProgressTemplateDto,
  toTrackingDto,
  type ProgressTemplateDto,
  type TrackingBoardDto,
  type TrackingDto,
  type TrackingListRowDto,
} from '../dto/TrackingDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { LocationRepository } from '../ports/LocationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type {
  ListTemplatesOptions,
  ListTrackingsOptions,
  ProgressTemplateRepository,
  ProjectPhysicalProgress,
  TemplateBodyInput,
  TrackingItemHistoryRow,
  TrackingLocationProgress,
  TrackingProgress,
  TrackingRepository,
} from '../ports/TrackingRepositories.js';

const TEMPLATE_CODE_PREFIX = 'GDS';
const TRACKING_CODE_PREFIX = 'GDT';

function nextCode(existing: ReadonlyArray<{ code: string }>, prefix: string): string {
  const re = new RegExp(`^${prefix}-0*(\\d+)$`, 'i');
  let max = 0;
  for (const e of existing) {
    const m = re.exec(e.code);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

// ===== ŞABLON ===============================================================

export interface CreateTemplateInput {
  companyId: number;
  name: string;
  code?: string | undefined;
  scope?: TrackScope | undefined;
  description?: string | null | undefined;
  pctInProgress?: number | undefined;
  pctHasDefects?: number | undefined;
  createdBy?: number | null | undefined;
  /** Gövde birlikte verilebilir — sihirbazdan tek çağrıyla şablon kurmak için. */
  body?: TemplateBodyInput | undefined;
}

export class CreateProgressTemplateUseCase {
  constructor(private readonly templates: ProgressTemplateRepository) {}

  async execute(input: CreateTemplateInput): Promise<ProgressTemplateDto> {
    const code =
      input.code?.trim() ||
      nextCode(
        await this.templates.listByCompany(input.companyId, { includeInactive: true }),
        TEMPLATE_CODE_PREFIX,
      );

    if (await this.templates.existsByCode(input.companyId, code)) {
      throw new DuplicateProgressTemplateCodeError(code);
    }

    const created = await this.templates.insert({
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      scope: input.scope ?? 'block',
      description: input.description?.trim() || null,
      pctInProgress: input.pctInProgress ?? 50,
      pctHasDefects: input.pctHasDefects ?? 75,
      createdBy: input.createdBy ?? null,
    });

    if (input.body) {
      await this.templates.replaceBody(created.id, input.companyId, input.body);
      const fresh = await this.templates.findById(created.id, input.companyId);
      if (fresh) return toProgressTemplateDto(fresh);
    }
    return toProgressTemplateDto(created);
  }
}

export interface UpdateTemplateInput {
  templateId: number;
  companyId: number;
  name?: string | undefined;
  scope?: TrackScope | undefined;
  description?: string | null | undefined;
  pctInProgress?: number | undefined;
  pctHasDefects?: number | undefined;
}

export class UpdateProgressTemplateUseCase {
  constructor(
    private readonly templates: ProgressTemplateRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateTemplateInput): Promise<ProgressTemplateDto> {
    const existing = await this.templates.findById(input.templateId, input.companyId);
    if (!existing) throw new ProgressTemplateNotFoundError(input.templateId);
    const updated = existing.update(
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.pctInProgress !== undefined ? { pctInProgress: input.pctInProgress } : {}),
        ...(input.pctHasDefects !== undefined ? { pctHasDefects: input.pctHasDefects } : {}),
      },
      this.clock.now(),
    );
    await this.templates.update(updated);
    return toProgressTemplateDto(updated);
  }
}

export interface SaveTemplateBodyInput {
  templateId: number;
  companyId: number;
  body: TemplateBodyInput;
}

export interface SaveTemplateBodyResult {
  template: ProgressTemplateDto;
  /** Bu şablonu kullanan takip sayısı — arayüz "N takip etkilenecek" uyarısı verir. */
  affectedTrackings: number;
}

export class SaveTemplateBodyUseCase {
  constructor(private readonly templates: ProgressTemplateRepository) {}

  async execute(input: SaveTemplateBodyInput): Promise<SaveTemplateBodyResult> {
    const existing = await this.templates.findById(input.templateId, input.companyId);
    if (!existing) throw new ProgressTemplateNotFoundError(input.templateId);

    const affected = await this.templates.usageCount(input.templateId, input.companyId);
    await this.templates.replaceBody(input.templateId, input.companyId, input.body);

    const fresh = await this.templates.findById(input.templateId, input.companyId);
    if (!fresh) throw new ProgressTemplateNotFoundError(input.templateId);
    return { template: toProgressTemplateDto(fresh), affectedTrackings: affected };
  }
}

export class ListProgressTemplatesUseCase {
  constructor(private readonly templates: ProgressTemplateRepository) {}

  async execute(
    input: ListTemplatesOptions & { companyId: number },
  ): Promise<ReadonlyArray<ProgressTemplateDto>> {
    const { companyId, ...opts } = input;
    const list = await this.templates.listByCompany(companyId, opts);
    return list.map(toProgressTemplateDto);
  }
}

export class GetProgressTemplateUseCase {
  constructor(private readonly templates: ProgressTemplateRepository) {}

  async execute(input: { templateId: number; companyId: number }): Promise<ProgressTemplateDto> {
    const t = await this.templates.findById(input.templateId, input.companyId);
    if (!t) throw new ProgressTemplateNotFoundError(input.templateId);
    return toProgressTemplateDto(t);
  }
}

export class DeactivateProgressTemplateUseCase {
  constructor(
    private readonly templates: ProgressTemplateRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { templateId: number; companyId: number }): Promise<ProgressTemplateDto> {
    const existing = await this.templates.findById(input.templateId, input.companyId);
    if (!existing) throw new ProgressTemplateNotFoundError(input.templateId);
    const deactivated = existing.deactivate(this.clock.now());
    await this.templates.update(deactivated);
    return toProgressTemplateDto(deactivated);
  }
}

// ===== TAKİP ================================================================

export interface CreateTrackingInput {
  companyId: number;
  projectId: number;
  templateId: number;
  name: string;
  code?: string | undefined;
  projectWeightPct?: number | undefined;
  plannedStart?: string | null | undefined;
  plannedEnd?: string | null | undefined;
  assignedUserId?: number | null | undefined;
  visibleAll?: boolean | undefined;
  note?: string | null | undefined;
  createdBy?: number | null | undefined;
  /** Kapsam lokasyonları. Ağırlık verilmezse 1 (eşit) sayılır. */
  locationIds: ReadonlyArray<number>;
  locationWeights?: Readonly<Record<string, number>> | undefined;
}

export class CreateTrackingUseCase {
  constructor(
    private readonly trackings: TrackingRepository,
    private readonly templates: ProgressTemplateRepository,
    private readonly projects: ProjectRepository,
    private readonly locations: LocationRepository,
  ) {}

  async execute(input: CreateTrackingInput): Promise<TrackingDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const template = await this.templates.findById(input.templateId, input.companyId);
    if (!template) throw new ProgressTemplateNotFoundError(input.templateId);

    // Kapsam lokasyonlarının hepsi bu projede ve şablonun scope'una uygun tipte
    // olmalı: 'unit' kapsamlı şablona blok bağlanırsa saha ekranı anlamsızlaşır.
    const locations = [];
    for (const locId of input.locationIds) {
      const loc = await this.locations.findById(locId, input.companyId);
      if (!loc || loc.projectId !== input.projectId) throw new LocationNotFoundError(locId);
      if (!scopeAcceptsKind(template.scope, loc.kind)) {
        throw new InvalidTrackingScopeError(template.scope, locationKindLabel(loc.kind));
      }
      locations.push(loc);
    }

    const code =
      input.code?.trim() ||
      nextCode(
        await this.trackings.listByCompany(input.companyId, { includeCancelled: true }),
        TRACKING_CODE_PREFIX,
      );
    if (await this.trackings.existsByCode(input.companyId, code)) {
      throw new DuplicateTrackingCodeError(code);
    }

    const created = await this.trackings.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      templateId: input.templateId,
      code,
      name: input.name.trim(),
      projectWeightPct: input.projectWeightPct ?? 0,
      plannedStart: input.plannedStart ?? project.startDate,
      plannedEnd: input.plannedEnd ?? project.plannedEnd,
      assignedUserId: input.assignedUserId ?? null,
      visibleAll: input.visibleAll ?? true,
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
      locations: locations.map((l, idx) => ({
        locationId: l.id,
        weightPct: input.locationWeights?.[String(l.id)] ?? 1,
        sortOrder: idx,
      })),
    });
    return toTrackingDto(created);
  }
}

export interface UpdateTrackingInput {
  trackingId: number;
  companyId: number;
  name?: string | undefined;
  projectWeightPct?: number | undefined;
  plannedStart?: string | null | undefined;
  plannedEnd?: string | null | undefined;
  assignedUserId?: number | null | undefined;
  visibleAll?: boolean | undefined;
  note?: string | null | undefined;
}

export class UpdateTrackingUseCase {
  constructor(
    private readonly trackings: TrackingRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateTrackingInput): Promise<TrackingDto> {
    const existing = await this.trackings.findById(input.trackingId, input.companyId);
    if (!existing) throw new TrackingNotFoundError(input.trackingId);
    const updated = existing.update(
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.projectWeightPct !== undefined
          ? { projectWeightPct: input.projectWeightPct }
          : {}),
        ...(input.plannedStart !== undefined ? { plannedStart: input.plannedStart } : {}),
        ...(input.plannedEnd !== undefined ? { plannedEnd: input.plannedEnd } : {}),
        ...(input.assignedUserId !== undefined ? { assignedUserId: input.assignedUserId } : {}),
        ...(input.visibleAll !== undefined ? { visibleAll: input.visibleAll } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      this.clock.now(),
    );
    await this.trackings.update(updated);
    return toTrackingDto(updated);
  }
}

export class ChangeTrackingStatusUseCase {
  constructor(
    private readonly trackings: TrackingRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    trackingId: number;
    companyId: number;
    status: TrackingStatus;
  }): Promise<TrackingDto> {
    const existing = await this.trackings.findById(input.trackingId, input.companyId);
    if (!existing) throw new TrackingNotFoundError(input.trackingId);
    const moved = existing.changeStatus(input.status, this.clock.now());
    await this.trackings.update(moved);
    return toTrackingDto(moved);
  }
}

export interface ListTrackingsInput extends ListTrackingsOptions {
  companyId: number;
  /** Sapma hesabı için referans tarih; verilmezse bugün. */
  asOf?: string | undefined;
}

export class ListTrackingsUseCase {
  constructor(
    private readonly trackings: TrackingRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ListTrackingsInput): Promise<ReadonlyArray<TrackingListRowDto>> {
    const { companyId, asOf, ...opts } = input;
    const asOfDate = asOf ?? this.clock.now().toISOString().slice(0, 10);
    const list = await this.trackings.listByCompany(companyId, opts);
    const progress = await this.trackings.listTrackingProgress(companyId, {
      trackingIds: list.map((t) => t.id),
    });
    return decorateTrackings(list, progress, asOfDate);
  }
}

/** Takipleri ilerleme + planlanan + sapma ile zenginleştirir (liste ve proje özeti ortak). */
function decorateTrackings(
  list: ReadonlyArray<Tracking>,
  progress: ReadonlyArray<TrackingProgress>,
  asOfDate: string,
): TrackingListRowDto[] {
  const byId = new Map(progress.map((p) => [p.trackingId, p]));
  return list.map((t) => {
    const prog = byId.get(t.id);
    const progressPct = prog?.progressPct ?? 0;
    const plannedPct = t.plannedPctAt(asOfDate);
    return {
      ...toTrackingDto(t),
      progressPct,
      locationCount: prog?.locationCount ?? 0,
      plannedPct,
      deviationPct: plannedPct === null ? null : progressPct - plannedPct,
    };
  });
}

/** Saha ekranı: lokasyon sekmeleri + grup/iş matrisi + ilerleme/sapma. */
export class GetTrackingBoardUseCase {
  constructor(
    private readonly trackings: TrackingRepository,
    private readonly templates: ProgressTemplateRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    trackingId: number;
    companyId: number;
    asOf?: string | undefined;
  }): Promise<TrackingBoardDto> {
    const tracking = await this.trackings.findById(input.trackingId, input.companyId);
    if (!tracking) throw new TrackingNotFoundError(input.trackingId);

    const template = await this.templates.findById(tracking.templateId, input.companyId);
    if (!template) throw new ProgressTemplateNotFoundError(tracking.templateId);

    const [locProgress, items, prog] = await Promise.all([
      this.trackings.locationProgress(input.trackingId, input.companyId),
      this.trackings.listItems(input.trackingId, input.companyId),
      this.trackings.trackingProgress(input.trackingId, input.companyId),
    ]);

    const asOfDate = input.asOf ?? this.clock.now().toISOString().slice(0, 10);
    return buildTrackingBoard(
      toTrackingDto(tracking),
      template.name,
      template.pctInProgress,
      template.pctHasDefects,
      prog?.progressPct ?? 0,
      tracking.plannedPctAt(asOfDate),
      locProgress,
      items,
    );
  }
}

export interface SetTrackingItemStateInput {
  trackingId: number;
  companyId: number;
  changedBy?: number | null | undefined;
  updates: ReadonlyArray<{
    trackingItemId: number;
    state: ItemState;
    overridePct?: number | null | undefined;
    inspectedBy?: number | null | undefined;
    inspectedAt?: string | null | undefined;
    note?: string | null | undefined;
  }>;
}

/**
 * Saha durum girişi. Yalnız AKTİF takipte kabul edilir — taslak takip henüz
 * onaylanmamış bir iskelettir, tamamlanmış/iptal takip ise kapatılmış bir
 * dönemdir; ikisine de veri girmek raporlanmış yüzdeyi geriye dönük bozar.
 */
export class SetTrackingItemStateUseCase {
  constructor(private readonly trackings: TrackingRepository) {}

  async execute(
    input: SetTrackingItemStateInput,
  ): Promise<ReadonlyArray<TrackingLocationProgress>> {
    const tracking = await this.trackings.findById(input.trackingId, input.companyId);
    if (!tracking) throw new TrackingNotFoundError(input.trackingId);
    if (!tracking.acceptsFieldUpdates) throw new TrackingNotActiveError(tracking.status);

    // Her satırın bu takibe ait olduğunu doğrula: id tahmini ile başka takibin
    // (hatta başka şirketin) satırını yazma girişimini burada kesiyoruz.
    for (const u of input.updates) {
      const row = await this.trackings.findItem(u.trackingItemId, input.companyId);
      if (!row || row.trackingId !== input.trackingId) {
        throw new TrackingItemNotFoundError(u.trackingItemId);
      }
    }

    await this.trackings.setItemStates(
      input.updates.map((u) => ({
        trackingItemId: u.trackingItemId,
        companyId: input.companyId,
        state: u.state,
        overridePct: u.overridePct ?? null,
        inspectedBy: u.inspectedBy ?? input.changedBy ?? null,
        inspectedAt: u.inspectedAt ?? null,
        note: u.note ?? null,
        changedBy: input.changedBy ?? null,
      })),
    );

    return this.trackings.locationProgress(input.trackingId, input.companyId);
  }
}

export class GetTrackingItemHistoryUseCase {
  constructor(private readonly trackings: TrackingRepository) {}

  async execute(input: {
    trackingItemId: number;
    companyId: number;
  }): Promise<ReadonlyArray<TrackingItemHistoryRow>> {
    const row = await this.trackings.findItem(input.trackingItemId, input.companyId);
    if (!row) throw new TrackingItemNotFoundError(input.trackingItemId);
    return this.trackings.itemHistory(input.trackingItemId, input.companyId);
  }
}

export interface AddTrackingLocationsInput {
  trackingId: number;
  companyId: number;
  locationIds: ReadonlyArray<number>;
  locationWeights?: Readonly<Record<string, number>> | undefined;
}

export class AddTrackingLocationsUseCase {
  constructor(
    private readonly trackings: TrackingRepository,
    private readonly templates: ProgressTemplateRepository,
    private readonly locations: LocationRepository,
  ) {}

  async execute(
    input: AddTrackingLocationsInput,
  ): Promise<ReadonlyArray<TrackingLocationProgress>> {
    const tracking = await this.trackings.findById(input.trackingId, input.companyId);
    if (!tracking) throw new TrackingNotFoundError(input.trackingId);
    const template = await this.templates.findById(tracking.templateId, input.companyId);
    if (!template) throw new ProgressTemplateNotFoundError(tracking.templateId);

    const existing = await this.trackings.listLocations(input.trackingId, input.companyId);
    const already = new Set(existing.map((e) => e.locationId));
    let sort = existing.length;

    const toAdd: { locationId: number; weightPct: number; sortOrder: number }[] = [];
    for (const locId of input.locationIds) {
      if (already.has(locId)) continue;
      const loc = await this.locations.findById(locId, input.companyId);
      if (!loc || loc.projectId !== tracking.projectId) throw new LocationNotFoundError(locId);
      if (!scopeAcceptsKind(template.scope, loc.kind)) {
        throw new InvalidTrackingScopeError(template.scope, locationKindLabel(loc.kind));
      }
      toAdd.push({
        locationId: locId,
        weightPct: input.locationWeights?.[String(locId)] ?? 1,
        sortOrder: sort++,
      });
    }

    if (toAdd.length > 0) {
      await this.trackings.addLocations(input.trackingId, input.companyId, toAdd);
    }
    return this.trackings.locationProgress(input.trackingId, input.companyId);
  }
}

export class RemoveTrackingLocationUseCase {
  constructor(private readonly trackings: TrackingRepository) {}

  async execute(input: {
    trackingId: number;
    companyId: number;
    trackingLocationId: number;
  }): Promise<ReadonlyArray<TrackingLocationProgress>> {
    const tracking = await this.trackings.findById(input.trackingId, input.companyId);
    if (!tracking) throw new TrackingNotFoundError(input.trackingId);
    await this.trackings.removeLocation(
      input.trackingId,
      input.companyId,
      input.trackingLocationId,
    );
    return this.trackings.locationProgress(input.trackingId, input.companyId);
  }
}

/**
 * Şablona sonradan eklenen işleri var olan takibe yansıtır. Mevcut satırlara
 * DOKUNMAZ — girilmiş saha verisi korunur, yalnız eksik kombinasyonlar
 * 'not_started' olarak eklenir.
 */
export class SyncTrackingWithTemplateUseCase {
  constructor(private readonly trackings: TrackingRepository) {}

  async execute(input: { trackingId: number; companyId: number }): Promise<{ addedItems: number }> {
    const tracking = await this.trackings.findById(input.trackingId, input.companyId);
    if (!tracking) throw new TrackingNotFoundError(input.trackingId);
    const added = await this.trackings.syncItemsWithTemplate(input.trackingId, input.companyId);
    return { addedItems: added };
  }
}

export interface ProjectPhysicalProgressDto extends ProjectPhysicalProgress {
  /** Ağırlık toplamı 100'ün altındaysa ölçülmeyen iş payı. */
  unmeasuredWeight: number;
  trackings: ReadonlyArray<TrackingListRowDto>;
}

/** Proje panelinin "Durum %" göstergesi + hangi takipten ne kadar geldiği. */
export class GetProjectPhysicalProgressUseCase {
  constructor(
    private readonly trackings: TrackingRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    projectId: number;
    companyId: number;
    asOf?: string | undefined;
  }): Promise<ProjectPhysicalProgressDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const asOfDate = input.asOf ?? this.clock.now().toISOString().slice(0, 10);
    const [summary, list, progress] = await Promise.all([
      this.trackings.projectProgress(input.projectId, input.companyId),
      this.trackings.listByCompany(input.companyId, { projectId: input.projectId }),
      this.trackings.listTrackingProgress(input.companyId, { projectId: input.projectId }),
    ]);
    const rows = decorateTrackings(list, progress, asOfDate);

    return {
      ...summary,
      unmeasuredWeight: Math.max(0, 100 - summary.weightSum),
      trackings: rows,
    };
  }
}
