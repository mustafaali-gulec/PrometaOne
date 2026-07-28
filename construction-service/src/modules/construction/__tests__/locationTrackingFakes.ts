/**
 * FAZ 1+2 test fake'leri — mekân kırılımı ve fiziksel ilerleme takibi için
 * in-memory repository'ler.
 *
 * Ayrı dosyada duruyorlar (fakes.ts'e eklenmiyorlar) çünkü fakes.ts zaten 1000+
 * satır ve bu iki alanın rollup mantığı kendi başına okunması gereken bir birim.
 *
 * ÖNEMLİ: rollup hesapları burada domain'in rollupWeighted fonksiyonuyla
 * yapılır — SQL view'ının kopyası DEĞİL, aynı formülün TypeScript ikizi. İki
 * uygulamanın aynı sonucu vermesi ItemState.rollupWeighted üzerinden garanti
 * altındadır ve view'ın kendisi SQL entegrasyon testiyle doğrulanır.
 */
import type {
  BulkGenerateInput,
  ListLocationsOptions,
  LocationRepository,
  LocationUsage,
  NewLocationInput,
} from '../application/ports/LocationRepository.js';
import type {
  ListTemplatesOptions,
  ListTrackingsOptions,
  NewTemplateInput,
  NewTrackingInput,
  ProgressTemplateRepository,
  ProjectPhysicalProgress,
  SetItemStateInput,
  TemplateBodyInput,
  TrackingItemHistoryRow,
  TrackingItemRow,
  TrackingLocationProgress,
  TrackingProgress,
  TrackingRepository,
} from '../application/ports/TrackingRepositories.js';
import { Location } from '../domain/entities/Location.js';
import { ProgressTemplate, type TemplateGroupProps } from '../domain/entities/ProgressTemplate.js';
import { Tracking, type TrackingLocationProps } from '../domain/entities/Tracking.js';
import { itemStatePct, rollupWeighted, type ItemState } from '../domain/valueObjects/ItemState.js';

const T0 = new Date('2026-06-06T00:00:00.000Z');

// ===== LOCATIONS ============================================================

export class InMemoryLocationRepository implements LocationRepository {
  private items: Location[] = [];
  private seq = 0;
  /** Silme engelini test etmek için elle şişirilebilir sahte kullanım sayacı. */
  usageOverrides = new Map<number, Partial<LocationUsage>>();

  private pathOf(parentId: number | null, name: string): { path: string; depth: number } {
    if (parentId === null) return { path: name, depth: 0 };
    const parent = this.items.find((l) => l.id === parentId);
    if (!parent) throw new Error(`fake: parent ${parentId} yok`);
    return { path: `${parent.path} > ${name}`, depth: parent.depth + 1 };
  }

  async insert(input: NewLocationInput): Promise<Location> {
    this.seq += 1;
    const { path, depth } = this.pathOf(input.parentId, input.name);
    const loc = Location.create({
      id: this.seq,
      companyId: input.companyId,
      projectId: input.projectId,
      parentId: input.parentId,
      kind: input.kind,
      code: input.code,
      name: input.name,
      sortOrder: input.sortOrder,
      path,
      depth,
      unitType: input.unitType,
      grossArea: input.grossArea,
      netArea: input.netArea,
      landShare: input.landShare,
      facade: input.facade,
      active: true,
      createdBy: input.createdBy,
      createdAt: T0,
      updatedAt: T0,
    });
    this.items.push(loc);
    return loc;
  }

  async update(location: Location): Promise<void> {
    const idx = this.items.findIndex(
      (l) => l.id === location.id && l.companyId === location.companyId,
    );
    if (idx < 0) return;
    // DB trigger'ının işini taklit et: path/depth yeniden türet, alt ağacı tazele
    const { path, depth } = this.pathOf(location.parentId, location.name);
    this.items[idx] = Location.create({ ...location.toJSON(), path, depth });
    this.refreshSubtree(location.id);
  }

  private refreshSubtree(parentId: number): void {
    for (let i = 0; i < this.items.length; i += 1) {
      const child = this.items[i]!;
      if (child.parentId !== parentId) continue;
      const { path, depth } = this.pathOf(child.parentId, child.name);
      this.items[i] = Location.create({ ...child.toJSON(), path, depth });
      this.refreshSubtree(child.id);
    }
  }

  async moveTo(id: number, companyId: number, newParentId: number | null): Promise<void> {
    const idx = this.items.findIndex((l) => l.id === id && l.companyId === companyId);
    if (idx < 0) return;
    const current = this.items[idx]!;
    const { path, depth } = this.pathOf(newParentId, current.name);
    this.items[idx] = Location.create({
      ...current.toJSON(),
      parentId: newParentId,
      path,
      depth,
    });
    this.refreshSubtree(id);
  }

  async findById(id: number, companyId: number): Promise<Location | null> {
    return this.items.find((l) => l.id === id && l.companyId === companyId) ?? null;
  }

  async listByProject(
    projectId: number,
    companyId: number,
    options: ListLocationsOptions = {},
  ): Promise<ReadonlyArray<Location>> {
    let subtree: Set<number> | null = null;
    if (options.subtreeOf !== undefined) {
      subtree = new Set<number>();
      const walk = (id: number): void => {
        subtree!.add(id);
        for (const c of this.items.filter((l) => l.parentId === id)) walk(c.id);
      };
      walk(options.subtreeOf);
    }
    return this.items
      .filter((l) => {
        if (l.projectId !== projectId || l.companyId !== companyId) return false;
        if (options.includeInactive !== true && !l.active) return false;
        if (options.kind !== undefined && l.kind !== options.kind) return false;
        if (subtree && !subtree.has(l.id)) return false;
        if (options.search !== undefined && options.search.trim() !== '') {
          const q = options.search.trim().toLowerCase();
          if (
            !l.name.toLowerCase().includes(q) &&
            !l.code.toLowerCase().includes(q) &&
            !l.path.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort(
        (a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
      );
  }

  async existsByCode(
    companyId: number,
    projectId: number,
    parentId: number | null,
    code: string,
    excludeId?: number,
  ): Promise<boolean> {
    return this.items.some(
      (l) =>
        l.companyId === companyId &&
        l.projectId === projectId &&
        l.parentId === parentId &&
        l.code === code &&
        l.id !== excludeId,
    );
  }

  async usage(id: number, _companyId: number): Promise<LocationUsage> {
    const base: LocationUsage = {
      children: this.items.filter((l) => l.parentId === id).length,
      boqLines: 0,
      expenses: 0,
      timesheets: 0,
      machineLogs: 0,
      stockMovements: 0,
      measurements: 0,
      materialRequests: 0,
      attachments: 0,
      trackingLocations: 0,
    };
    return { ...base, ...(this.usageOverrides.get(id) ?? {}) };
  }

  async hardDelete(id: number, companyId: number): Promise<void> {
    this.items = this.items.filter((l) => !(l.id === id && l.companyId === companyId));
  }

  async bulkGenerate(input: BulkGenerateInput): Promise<ReadonlyArray<Location>> {
    const created: Location[] = [];
    const apply = (tpl: string, code: string): string =>
      tpl.includes('{code}') ? tpl.replaceAll('{code}', code) : `${tpl}${code}`;

    const ensure = async (
      parentId: number | null,
      kind: 'block' | 'floor' | 'unit',
      code: string,
      name: string,
      sortOrder: number,
      unitType: string | null,
    ): Promise<number> => {
      const found = this.items.find(
        (l) =>
          l.companyId === input.companyId &&
          l.projectId === input.projectId &&
          l.parentId === parentId &&
          l.code === code,
      );
      if (found) return found.id;
      const loc = await this.insert({
        companyId: input.companyId,
        projectId: input.projectId,
        parentId,
        kind,
        code,
        name,
        sortOrder,
        unitType,
        grossArea: null,
        netArea: null,
        landShare: null,
        facade: null,
        createdBy: input.createdBy,
      });
      created.push(loc);
      return loc.id;
    };

    let blockIdx = 0;
    for (const blockCode of input.blocks) {
      const blockId = await ensure(
        input.parentId,
        'block',
        blockCode,
        apply(input.blockNameTemplate, blockCode),
        blockIdx++,
        null,
      );
      if (input.floors.length === 0) continue;
      let unitSeq = 1;
      let floorIdx = 0;
      for (const floorCode of input.floors) {
        const floorId = await ensure(
          blockId,
          'floor',
          floorCode,
          apply(input.floorNameTemplate, floorCode),
          floorIdx++,
          null,
        );
        for (let u = 1; u <= input.unitsPerFloor; u += 1) {
          const unitCode = String(input.unitNumbering === 'sequential' ? unitSeq++ : u);
          await ensure(
            floorId,
            'unit',
            unitCode,
            apply(input.unitNameTemplate, unitCode),
            u,
            input.defaultUnitType,
          );
        }
      }
    }
    return created;
  }
}

// ===== PROGRESS TEMPLATES ===================================================

export class InMemoryProgressTemplateRepository implements ProgressTemplateRepository {
  private items: ProgressTemplate[] = [];
  private seq = 0;
  private groupSeq = 0;
  private itemSeq = 0;
  /** usageCount()'un döndüreceği değeri testte sabitlemek için. */
  usageCounts = new Map<number, number>();

  async insert(input: NewTemplateInput): Promise<ProgressTemplate> {
    this.seq += 1;
    const t = ProgressTemplate.create({
      id: this.seq,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      scope: input.scope,
      description: input.description,
      pctInProgress: input.pctInProgress,
      pctHasDefects: input.pctHasDefects,
      active: true,
      createdBy: input.createdBy,
      createdAt: T0,
      updatedAt: T0,
      groups: [],
    });
    this.items.push(t);
    return t;
  }

  async update(template: ProgressTemplate): Promise<void> {
    const idx = this.items.findIndex(
      (t) => t.id === template.id && t.companyId === template.companyId,
    );
    // Gövde update() ile taşınmaz; mevcut grupları koru.
    if (idx >= 0) {
      this.items[idx] = ProgressTemplate.create({
        ...template.toJSON(),
        groups: this.items[idx]!.groups,
      });
    }
  }

  async replaceBody(templateId: number, companyId: number, body: TemplateBodyInput): Promise<void> {
    const idx = this.items.findIndex((t) => t.id === templateId && t.companyId === companyId);
    if (idx < 0) return;
    const groups: TemplateGroupProps[] = body.groups.map((g) => {
      this.groupSeq += 1;
      const groupId = this.groupSeq;
      return {
        id: groupId,
        companyId,
        templateId,
        code: g.code,
        name: g.name,
        weightPct: g.weightPct,
        sortOrder: g.sortOrder,
        items: g.items.map((i) => {
          this.itemSeq += 1;
          return {
            id: this.itemSeq,
            companyId,
            groupId,
            code: i.code,
            name: i.name,
            weightPct: i.weightPct,
            sortOrder: i.sortOrder,
            pozId: i.pozId,
          };
        }),
      };
    });
    this.items[idx] = ProgressTemplate.create({ ...this.items[idx]!.toJSON(), groups });
  }

  async findById(id: number, companyId: number): Promise<ProgressTemplate | null> {
    return this.items.find((t) => t.id === id && t.companyId === companyId) ?? null;
  }

  async listByCompany(
    companyId: number,
    options: ListTemplatesOptions = {},
  ): Promise<ReadonlyArray<ProgressTemplate>> {
    return this.items.filter((t) => {
      if (t.companyId !== companyId) return false;
      if (options.includeInactive !== true && !t.active) return false;
      if (options.scope !== undefined && t.scope !== options.scope) return false;
      return true;
    });
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    return this.items.some(
      (t) => t.companyId === companyId && t.code === code && t.id !== excludeId,
    );
  }

  async usageCount(id: number, _companyId: number): Promise<number> {
    return this.usageCounts.get(id) ?? 0;
  }
}

// ===== TRACKINGS ============================================================

interface FakeItem {
  id: number;
  companyId: number;
  trackingId: number;
  trackingLocationId: number;
  templateItemId: number;
  state: ItemState;
  overridePct: number | null;
  inspectedBy: number | null;
  inspectedAt: string | null;
  note: string | null;
}

export class InMemoryTrackingRepository implements TrackingRepository {
  private trackings: Tracking[] = [];
  private locations: TrackingLocationProps[] = [];
  private items: FakeItem[] = [];
  private history: TrackingItemHistoryRow[] = [];
  private seq = 0;
  private locSeq = 0;
  private itemSeq = 0;
  private histSeq = 0;

  constructor(
    private readonly templates: InMemoryProgressTemplateRepository,
    private readonly locationRepo: InMemoryLocationRepository,
  ) {}

  async insert(input: NewTrackingInput): Promise<Tracking> {
    this.seq += 1;
    const t = Tracking.create({
      id: this.seq,
      companyId: input.companyId,
      projectId: input.projectId,
      templateId: input.templateId,
      code: input.code,
      name: input.name,
      projectWeightPct: input.projectWeightPct,
      plannedStart: input.plannedStart,
      plannedEnd: input.plannedEnd,
      status: 'draft',
      assignedUserId: input.assignedUserId,
      visibleAll: input.visibleAll,
      note: input.note,
      createdBy: input.createdBy,
      createdAt: T0,
      updatedAt: T0,
    });
    this.trackings.push(t);
    for (const loc of input.locations) {
      await this.attachLocation(input.companyId, t.id, input.templateId, loc);
    }
    return t;
  }

  private async attachLocation(
    companyId: number,
    trackingId: number,
    templateId: number,
    loc: { locationId: number; weightPct: number; sortOrder: number },
  ): Promise<TrackingLocationProps> {
    this.locSeq += 1;
    const dbLoc = await this.locationRepo.findById(loc.locationId, companyId);
    const tl: TrackingLocationProps = {
      id: this.locSeq,
      companyId,
      trackingId,
      locationId: loc.locationId,
      weightPct: loc.weightPct,
      sortOrder: loc.sortOrder,
      locationPath: dbLoc?.path ?? '',
      locationName: dbLoc?.name ?? '',
    };
    this.locations.push(tl);

    const template = await this.templates.findById(templateId, companyId);
    for (const g of template?.groups ?? []) {
      for (const i of g.items) {
        this.itemSeq += 1;
        this.items.push({
          id: this.itemSeq,
          companyId,
          trackingId,
          trackingLocationId: tl.id,
          templateItemId: i.id,
          state: 'not_started',
          overridePct: null,
          inspectedBy: null,
          inspectedAt: null,
          note: null,
        });
      }
    }
    return tl;
  }

  async update(tracking: Tracking): Promise<void> {
    const idx = this.trackings.findIndex(
      (t) => t.id === tracking.id && t.companyId === tracking.companyId,
    );
    if (idx >= 0) this.trackings[idx] = tracking;
  }

  async findById(id: number, companyId: number): Promise<Tracking | null> {
    return this.trackings.find((t) => t.id === id && t.companyId === companyId) ?? null;
  }

  async listByCompany(
    companyId: number,
    options: ListTrackingsOptions = {},
  ): Promise<ReadonlyArray<Tracking>> {
    return this.trackings.filter((t) => {
      if (t.companyId !== companyId) return false;
      if (options.projectId !== undefined && t.projectId !== options.projectId) return false;
      if (options.status !== undefined) return t.status === options.status;
      if (options.includeCancelled !== true && t.status === 'cancelled') return false;
      return true;
    });
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    return this.trackings.some(
      (t) => t.companyId === companyId && t.code === code && t.id !== excludeId,
    );
  }

  async listLocations(
    trackingId: number,
    companyId: number,
  ): Promise<ReadonlyArray<TrackingLocationProps>> {
    return this.locations
      .filter((l) => l.trackingId === trackingId && l.companyId === companyId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /** Şablon meta verisini iş satırına bağlar (Pg tarafındaki JOIN'in karşılığı). */
  private async enrich(it: FakeItem): Promise<TrackingItemRow | null> {
    const tracking = this.trackings.find((t) => t.id === it.trackingId);
    if (!tracking) return null;
    const template = await this.templates.findById(tracking.templateId, it.companyId);
    if (!template) return null;
    for (const g of template.groups) {
      const ti = g.items.find((x) => x.id === it.templateItemId);
      if (!ti) continue;
      const tl = this.locations.find((l) => l.id === it.trackingLocationId);
      return {
        id: it.id,
        trackingId: it.trackingId,
        trackingLocationId: it.trackingLocationId,
        locationId: tl?.locationId ?? 0,
        locationPath: tl?.locationPath ?? '',
        templateItemId: it.templateItemId,
        groupId: g.id,
        groupName: g.name,
        groupWeight: g.weightPct,
        itemName: ti.name,
        itemWeight: ti.weightPct,
        state: it.state,
        overridePct: it.overridePct,
        effectivePct: itemStatePct(
          it.state,
          { inProgress: template.pctInProgress, hasDefects: template.pctHasDefects },
          it.overridePct,
        ),
        inspectedBy: it.inspectedBy,
        inspectedAt: it.inspectedAt,
        note: it.note,
        pozId: ti.pozId,
      };
    }
    return null;
  }

  async listItems(trackingId: number, companyId: number): Promise<ReadonlyArray<TrackingItemRow>> {
    const out: TrackingItemRow[] = [];
    for (const it of this.items.filter(
      (x) => x.trackingId === trackingId && x.companyId === companyId,
    )) {
      const row = await this.enrich(it);
      if (row) out.push(row);
    }
    return out;
  }

  async findItem(trackingItemId: number, companyId: number): Promise<TrackingItemRow | null> {
    const it = this.items.find((x) => x.id === trackingItemId && x.companyId === companyId);
    return it ? this.enrich(it) : null;
  }

  async setItemState(input: SetItemStateInput): Promise<TrackingItemRow> {
    const rows = await this.setItemStates([input]);
    const row = rows[0];
    if (!row) throw new Error(`fake: item ${input.trackingItemId} yok`);
    return row;
  }

  async setItemStates(
    inputs: ReadonlyArray<SetItemStateInput>,
  ): Promise<ReadonlyArray<TrackingItemRow>> {
    const out: TrackingItemRow[] = [];
    for (const input of inputs) {
      const idx = this.items.findIndex(
        (x) => x.id === input.trackingItemId && x.companyId === input.companyId,
      );
      if (idx < 0) continue;
      const before = await this.enrich(this.items[idx]!);
      this.items[idx] = {
        ...this.items[idx]!,
        state: input.state,
        overridePct: input.overridePct,
        inspectedBy: input.inspectedBy,
        inspectedAt: input.inspectedAt,
        note: input.note,
      };
      const after = await this.enrich(this.items[idx]);
      this.histSeq += 1;
      this.history.push({
        id: this.histSeq,
        trackingItemId: input.trackingItemId,
        fromState: before?.state ?? null,
        toState: input.state,
        fromPct: before?.effectivePct ?? null,
        toPct: after?.effectivePct ?? 0,
        changedBy: input.changedBy,
        changedAt: T0.toISOString(),
        note: input.note,
      });
      if (after) out.push(after);
    }
    return out;
  }

  async itemHistory(
    trackingItemId: number,
    _companyId: number,
  ): Promise<ReadonlyArray<TrackingItemHistoryRow>> {
    return this.history.filter((h) => h.trackingItemId === trackingItemId).reverse();
  }

  async locationProgress(
    trackingId: number,
    companyId: number,
  ): Promise<ReadonlyArray<TrackingLocationProgress>> {
    const rows = await this.listItems(trackingId, companyId);
    const locs = await this.listLocations(trackingId, companyId);
    return locs.map((l) => {
      const mine = rows.filter((r) => r.trackingLocationId === l.id);
      return {
        trackingLocationId: l.id,
        locationId: l.locationId,
        locationPath: l.locationPath ?? '',
        locationName: l.locationName ?? '',
        weightPct: l.weightPct,
        progressPct: rollupWeighted(
          mine.map((r) => ({
            pct: r.effectivePct,
            itemWeight: r.itemWeight,
            groupWeight: r.groupWeight,
          })),
        ),
        itemCount: mine.length,
        completedCount: mine.filter((r) => r.state === 'completed').length,
        defectCount: mine.filter((r) => r.state === 'has_defects').length,
        inProgressCount: mine.filter((r) => r.state === 'in_progress').length,
      };
    });
  }

  async trackingProgress(trackingId: number, companyId: number): Promise<TrackingProgress | null> {
    const t = await this.findById(trackingId, companyId);
    if (!t) return null;
    const locs = await this.locationProgress(trackingId, companyId);
    const den = locs.reduce((s, l) => s + l.weightPct, 0);
    const num = locs.reduce((s, l) => s + l.progressPct * l.weightPct, 0);
    return {
      trackingId,
      projectId: t.projectId,
      projectWeightPct: t.projectWeightPct,
      progressPct: den === 0 ? 0 : num / den,
      locationCount: locs.length,
    };
  }

  async listTrackingProgress(
    companyId: number,
    filter: { projectId?: number; trackingIds?: ReadonlyArray<number> },
  ): Promise<ReadonlyArray<TrackingProgress>> {
    const out: TrackingProgress[] = [];
    for (const t of this.trackings) {
      if (t.companyId !== companyId) continue;
      if (filter.projectId !== undefined && t.projectId !== filter.projectId) continue;
      if (filter.trackingIds !== undefined && !filter.trackingIds.includes(t.id)) continue;
      const p = await this.trackingProgress(t.id, companyId);
      if (p) out.push(p);
    }
    return out;
  }

  async projectProgress(projectId: number, companyId: number): Promise<ProjectPhysicalProgress> {
    let sum = 0;
    let weightSum = 0;
    let count = 0;
    for (const t of this.trackings) {
      if (t.projectId !== projectId || t.companyId !== companyId) continue;
      if (t.status === 'cancelled') continue;
      const p = await this.trackingProgress(t.id, companyId);
      if (!p) continue;
      sum += p.progressPct * p.projectWeightPct;
      weightSum += p.projectWeightPct;
      count += 1;
    }
    return { projectId, progressPct: sum / 100, weightSum, trackingCount: count };
  }

  async syncItemsWithTemplate(trackingId: number, companyId: number): Promise<number> {
    const t = await this.findById(trackingId, companyId);
    if (!t) return 0;
    const template = await this.templates.findById(t.templateId, companyId);
    if (!template) return 0;
    const locs = await this.listLocations(trackingId, companyId);
    let added = 0;
    for (const l of locs) {
      for (const g of template.groups) {
        for (const i of g.items) {
          const exists = this.items.some(
            (x) => x.trackingLocationId === l.id && x.templateItemId === i.id,
          );
          if (exists) continue;
          this.itemSeq += 1;
          this.items.push({
            id: this.itemSeq,
            companyId,
            trackingId,
            trackingLocationId: l.id,
            templateItemId: i.id,
            state: 'not_started',
            overridePct: null,
            inspectedBy: null,
            inspectedAt: null,
            note: null,
          });
          added += 1;
        }
      }
    }
    return added;
  }

  async addLocations(
    trackingId: number,
    companyId: number,
    locations: ReadonlyArray<{ locationId: number; weightPct: number; sortOrder: number }>,
  ): Promise<ReadonlyArray<TrackingLocationProps>> {
    const t = await this.findById(trackingId, companyId);
    if (!t) return [];
    for (const loc of locations) {
      await this.attachLocation(companyId, trackingId, t.templateId, loc);
    }
    return this.listLocations(trackingId, companyId);
  }

  async removeLocation(
    trackingId: number,
    companyId: number,
    trackingLocationId: number,
  ): Promise<void> {
    this.locations = this.locations.filter(
      (l) =>
        !(l.id === trackingLocationId && l.trackingId === trackingId && l.companyId === companyId),
    );
    this.items = this.items.filter((i) => i.trackingLocationId !== trackingLocationId);
  }
}
