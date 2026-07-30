/**
 * Mekân kırılımı use-case'leri (FAZ 1).
 *
 * Ağaç kısıtları burada uygulanır (LocationKind VO'ya danışarak): kök olabilecek
 * tipler, ebeveyn-çocuk uyumu, aynı ebeveyn altında kod tekilliği. `path`/`depth`
 * DB trigger'ının işi — buradan yazılmaz.
 */
import type { Location } from '../../domain/entities/Location.js';
import {
  DuplicateLocationCodeError,
  InvalidLocationNestingError,
  LocationInUseError,
  LocationNotFoundError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  canBeRoot,
  canNest,
  locationKindLabel,
  type LocationKind,
} from '../../domain/valueObjects/LocationKind.js';
import {
  buildLocationTree,
  toLocationDto,
  type LocationDto,
  type LocationTreeNodeDto,
} from '../dto/LocationDtos.js';
import type { Clock } from '../ports/Clock.js';
import type {
  ListLocationsOptions,
  LocationRepository,
  LocationUsage,
} from '../ports/LocationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';

/** Ebeveyni doğrular ve iç içe geçme kuralını uygular. */
async function resolveParent(
  locations: LocationRepository,
  companyId: number,
  projectId: number,
  parentId: number | null,
  kind: LocationKind,
): Promise<Location | null> {
  if (parentId === null) {
    if (!canBeRoot(kind)) {
      throw new InvalidLocationNestingError('proje kökü', locationKindLabel(kind));
    }
    return null;
  }
  const parent = await locations.findById(parentId, companyId);
  if (!parent) throw new LocationNotFoundError(parentId);
  if (parent.projectId !== projectId) {
    throw new InvalidLocationNestingError(
      `${locationKindLabel(parent.kind)} (başka proje)`,
      locationKindLabel(kind),
    );
  }
  if (!canNest(parent.kind, kind)) {
    throw new InvalidLocationNestingError(locationKindLabel(parent.kind), locationKindLabel(kind));
  }
  return parent;
}

export interface CreateLocationInput {
  companyId: number;
  projectId: number;
  parentId?: number | null | undefined;
  kind: LocationKind;
  code: string;
  name?: string | undefined;
  sortOrder?: number | undefined;
  unitType?: string | null | undefined;
  grossArea?: number | null | undefined;
  netArea?: number | null | undefined;
  landShare?: number | null | undefined;
  facade?: string | null | undefined;
  createdBy?: number | null | undefined;
}

export class CreateLocationUseCase {
  constructor(
    private readonly locations: LocationRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: CreateLocationInput): Promise<LocationDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const parentId = input.parentId ?? null;
    await resolveParent(this.locations, input.companyId, input.projectId, parentId, input.kind);

    const code = input.code.trim();
    if (await this.locations.existsByCode(input.companyId, input.projectId, parentId, code)) {
      throw new DuplicateLocationCodeError(code);
    }

    const created = await this.locations.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      parentId,
      kind: input.kind,
      code,
      // Ad verilmezse kod ada dönüşür: "18" katı/dairesi için ayrı ad girmek
      // 50 daireli blokta gereksiz emek.
      name: input.name?.trim() || code,
      sortOrder: input.sortOrder ?? 0,
      unitType: input.unitType?.trim() || null,
      grossArea: input.grossArea ?? null,
      netArea: input.netArea ?? null,
      landShare: input.landShare ?? null,
      facade: input.facade?.trim() || null,
      createdBy: input.createdBy ?? null,
    });
    return toLocationDto(created);
  }
}

export interface UpdateLocationInput {
  locationId: number;
  companyId: number;
  name?: string | undefined;
  code?: string | undefined;
  sortOrder?: number | undefined;
  unitType?: string | null | undefined;
  grossArea?: number | null | undefined;
  netArea?: number | null | undefined;
  landShare?: number | null | undefined;
  facade?: string | null | undefined;
}

export class UpdateLocationUseCase {
  constructor(
    private readonly locations: LocationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateLocationInput): Promise<LocationDto> {
    const existing = await this.locations.findById(input.locationId, input.companyId);
    if (!existing) throw new LocationNotFoundError(input.locationId);

    if (input.code !== undefined && input.code.trim() !== existing.code) {
      const dup = await this.locations.existsByCode(
        input.companyId,
        existing.projectId,
        existing.parentId,
        input.code.trim(),
        existing.id,
      );
      if (dup) throw new DuplicateLocationCodeError(input.code.trim());
    }

    const updated = existing.update(
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.unitType !== undefined ? { unitType: input.unitType } : {}),
        ...(input.grossArea !== undefined ? { grossArea: input.grossArea } : {}),
        ...(input.netArea !== undefined ? { netArea: input.netArea } : {}),
        ...(input.landShare !== undefined ? { landShare: input.landShare } : {}),
        ...(input.facade !== undefined ? { facade: input.facade } : {}),
      },
      this.clock.now(),
    );
    await this.locations.update(updated);
    // path/depth trigger tarafından yeniden yazıldı — güncel hâli okuyup dön.
    const fresh = await this.locations.findById(input.locationId, input.companyId);
    return toLocationDto(fresh ?? updated);
  }
}

export interface MoveLocationInput {
  locationId: number;
  companyId: number;
  newParentId: number | null;
}

/**
 * Lokasyonu ağaçta başka bir ebeveynin altına taşır (blok yeniden yapılandırma).
 * Alt ağacın path'i DB trigger'ı ile kendiliğinden tazelenir.
 */
export class MoveLocationUseCase {
  constructor(private readonly locations: LocationRepository) {}

  async execute(input: MoveLocationInput): Promise<LocationDto> {
    const existing = await this.locations.findById(input.locationId, input.companyId);
    if (!existing) throw new LocationNotFoundError(input.locationId);

    await resolveParent(
      this.locations,
      input.companyId,
      existing.projectId,
      input.newParentId,
      existing.kind,
    );

    if (
      await this.locations.existsByCode(
        input.companyId,
        existing.projectId,
        input.newParentId,
        existing.code,
        existing.id,
      )
    ) {
      throw new DuplicateLocationCodeError(existing.code);
    }

    await this.locations.moveTo(input.locationId, input.companyId, input.newParentId);
    const fresh = await this.locations.findById(input.locationId, input.companyId);
    if (!fresh) throw new LocationNotFoundError(input.locationId);
    return toLocationDto(fresh);
  }
}

export interface ListLocationsInput extends ListLocationsOptions {
  companyId: number;
  projectId: number;
}

export class ListLocationsUseCase {
  constructor(private readonly locations: LocationRepository) {}

  async execute(input: ListLocationsInput): Promise<ReadonlyArray<LocationDto>> {
    const { companyId, projectId, ...opts } = input;
    const list = await this.locations.listByProject(projectId, companyId, opts);
    return list.map(toLocationDto);
  }
}

export class GetLocationTreeUseCase {
  constructor(private readonly locations: LocationRepository) {}

  async execute(input: ListLocationsInput): Promise<LocationTreeNodeDto[]> {
    const { companyId, projectId, ...opts } = input;
    const list = await this.locations.listByProject(projectId, companyId, opts);
    return buildLocationTree(list);
  }
}

export interface DeleteLocationInput {
  locationId: number;
  companyId: number;
  /** true ise bağlı kayıt varsa bile pasife çeker (sert silmez). */
  deactivateOnly?: boolean | undefined;
}

export interface DeleteLocationResult {
  deleted: boolean;
  location: LocationDto;
}

/**
 * Lokasyon silme. Bağlı kayıt (gider, puantaj, takip...) veya çocuk varsa SERT
 * SİLİNMEZ — hangi kayıtların bağlı olduğu hata mesajında sayılarla döner.
 * `deactivateOnly` ile pasife çekme her zaman mümkündür: mekân artık
 * kullanılmıyor ama geçmiş kayıtların etiketi korunur.
 */
export class DeleteLocationUseCase {
  constructor(
    private readonly locations: LocationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeleteLocationInput): Promise<DeleteLocationResult> {
    const existing = await this.locations.findById(input.locationId, input.companyId);
    if (!existing) throw new LocationNotFoundError(input.locationId);

    if (input.deactivateOnly === true) {
      const deactivated = existing.deactivate(this.clock.now());
      await this.locations.update(deactivated);
      return { deleted: false, location: toLocationDto(deactivated) };
    }

    const usage = await this.locations.usage(input.locationId, input.companyId);
    const blockers = describeUsage(usage);
    if (blockers.length > 0) {
      throw new LocationInUseError(input.locationId, blockers.join(', '));
    }

    await this.locations.hardDelete(input.locationId, input.companyId);
    return { deleted: true, location: toLocationDto(existing) };
  }
}

const USAGE_LABELS: ReadonlyArray<[keyof LocationUsage, string]> = [
  ['children', 'alt mekân'],
  ['boqLines', 'keşif satırı'],
  ['expenses', 'gider'],
  ['timesheets', 'puantaj'],
  ['machineLogs', 'makine kaydı'],
  ['stockMovements', 'stok hareketi'],
  ['measurements', 'yeşil defter kaydı'],
  ['materialRequests', 'malzeme talebi'],
  ['attachments', 'ataşman'],
  ['trackingLocations', 'ilerleme takibi'],
];

function describeUsage(usage: LocationUsage): string[] {
  const out: string[] = [];
  for (const [key, label] of USAGE_LABELS) {
    const n = usage[key];
    if (n > 0) out.push(`${n} ${label}`);
  }
  return out;
}

export class GetLocationUsageUseCase {
  constructor(private readonly locations: LocationRepository) {}

  async execute(input: { locationId: number; companyId: number }): Promise<{
    usage: LocationUsage;
    canHardDelete: boolean;
    blockers: ReadonlyArray<string>;
  }> {
    const existing = await this.locations.findById(input.locationId, input.companyId);
    if (!existing) throw new LocationNotFoundError(input.locationId);
    const usage = await this.locations.usage(input.locationId, input.companyId);
    const blockers = describeUsage(usage);
    return { usage, canHardDelete: blockers.length === 0, blockers };
  }
}

export interface BulkGenerateLocationsInput {
  companyId: number;
  projectId: number;
  parentId?: number | null | undefined;
  blocks: ReadonlyArray<string>;
  floors?: ReadonlyArray<string> | undefined;
  unitsPerFloor?: number | undefined;
  unitNumbering?: 'sequential' | 'per_floor' | undefined;
  defaultUnitType?: string | null | undefined;
  blockNameTemplate?: string | undefined;
  floorNameTemplate?: string | undefined;
  unitNameTemplate?: string | undefined;
  createdBy?: number | null | undefined;
}

/**
 * Toplu mekân üretimi — 3 blok × 8 kat × 4 daire = 3+24+96 düğümü elle girmek
 * kabul edilemez bir emek. Var olan kodlar atlanır, yani sihirbaz tekrar
 * koşturulunca kopya üretmez (yeni blok eklemek için tekrar çalıştırılabilir).
 */
export class BulkGenerateLocationsUseCase {
  constructor(
    private readonly locations: LocationRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: BulkGenerateLocationsInput): Promise<{
    created: ReadonlyArray<LocationDto>;
    createdCount: number;
  }> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const parentId = input.parentId ?? null;
    if (parentId !== null) {
      // Bloklar bu düğümün altına gidecek — 'site' veya 'zone' olmalı
      await resolveParent(this.locations, input.companyId, input.projectId, parentId, 'block');
    }

    const created = await this.locations.bulkGenerate({
      companyId: input.companyId,
      projectId: input.projectId,
      parentId,
      createdBy: input.createdBy ?? null,
      blocks: input.blocks.map((b) => b.trim()).filter((b) => b.length > 0),
      floors: (input.floors ?? []).map((f) => f.trim()).filter((f) => f.length > 0),
      unitsPerFloor: input.unitsPerFloor ?? 0,
      unitNumbering: input.unitNumbering ?? 'per_floor',
      defaultUnitType: input.defaultUnitType?.trim() || null,
      blockNameTemplate: input.blockNameTemplate ?? '{code} Blok',
      floorNameTemplate: input.floorNameTemplate ?? '{code}',
      unitNameTemplate: input.unitNameTemplate ?? '{code}',
    });

    return { created: created.map(toLocationDto), createdCount: created.length };
  }
}
