/**
 * İş programı use-case'leri (FAZ 8).
 *
 * S-EĞRİSİ use-case'te hesaplanır (SQL'de değil): tarih serisi + ağırlık
 * matematiği ScheduleCurve VO'sunda saf fonksiyondur ve birim testlidir.
 * Planlanan eğri hesaptan, fiili eğri İLERLEME GÜNLÜĞÜNDEN gelir — kayıt
 * yoksa fiili çizgi de yoktur (geriye dönük uydurma yok).
 */
import type {
  ActivityKind,
  ScheduleActivity,
  ScheduleActivityUpdate,
} from '../../domain/entities/ScheduleActivity.js';
import {
  ActivityHasChildrenError,
  ConstructionValidationError,
  ProjectNotFoundError,
  ScheduleActivityNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  computeScheduleCurve,
  type CurveActivity,
  type ScheduleCurve,
} from '../../domain/valueObjects/ScheduleCurve.js';
import type { Clock } from '../ports/Clock.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type {
  ProgressLogRow,
  ScheduleRepository,
  ScheduleSummaryRow,
} from '../ports/ScheduleRepository.js';

// ===== DTO ==================================================================

export interface ScheduleActivityDto {
  id: number;
  companyId: number;
  projectId: number;
  parentId: number | null;
  code: string;
  name: string;
  kind: ActivityKind;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  progressPct: number;
  weightPct: number;
  trackingId: number | null;
  boqLineId: number | null;
  locationId: number | null;
  dependsOn: number | null;
  sortOrder: number;
  note: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Gecikme günü (bitmemiş + planlanan bitişi geçmiş); grup satırında null. */
  daysOverdue: number | null;
  /**
   * Bağlı takibin GÜNCEL fiziksel yüzdesi (varsa) — referans. Program yüzdesi
   * beyandır, takip ölçümdür; fark ekranda görünür, otomatik eşitlenmez.
   */
  trackingPct: number | null;
}

function toDto(
  a: ScheduleActivity,
  today: string,
  trackingPcts: ReadonlyMap<number, number>,
): ScheduleActivityDto {
  const j = a.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    parentId: j.parentId,
    code: j.code,
    name: j.name,
    kind: j.kind,
    plannedStart: j.plannedStart,
    plannedEnd: j.plannedEnd,
    actualStart: j.actualStart,
    actualEnd: j.actualEnd,
    progressPct: j.progressPct,
    weightPct: j.weightPct,
    trackingId: j.trackingId,
    boqLineId: j.boqLineId,
    locationId: j.locationId,
    dependsOn: j.dependsOn,
    sortOrder: j.sortOrder,
    note: j.note,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    daysOverdue: a.overdueDays(today),
    trackingPct: j.trackingId === null ? null : (trackingPcts.get(j.trackingId) ?? null),
  };
}

// ===== CRUD =================================================================

export interface CreateActivityInput {
  companyId: number;
  projectId: number;
  parentId?: number | null | undefined;
  code?: string | undefined;
  name: string;
  kind?: ActivityKind | undefined;
  plannedStart: string;
  plannedEnd?: string | undefined;
  weightPct?: number | undefined;
  trackingId?: number | null | undefined;
  boqLineId?: number | null | undefined;
  locationId?: number | null | undefined;
  dependsOn?: number | null | undefined;
  sortOrder?: number | undefined;
  note?: string | null | undefined;
  createdBy?: number | null | undefined;
}

export class CreateActivityUseCase {
  constructor(
    private readonly schedule: ScheduleRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateActivityInput): Promise<ScheduleActivityDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const kind = input.kind ?? 'task';
    // Ebeveyn/öncül aynı projede olmalı — çapraz proje bağı Gantt'ı bozar.
    if (input.parentId !== null && input.parentId !== undefined) {
      const parent = await this.schedule.findById(input.parentId, input.companyId);
      if (!parent || parent.projectId !== input.projectId) {
        throw new ConstructionValidationError('üst aktivite aynı projede bulunamadı');
      }
      if (parent.kind !== 'group') {
        throw new ConstructionValidationError('yalnız grup satırının altına aktivite eklenebilir');
      }
    }
    if (input.dependsOn !== null && input.dependsOn !== undefined) {
      const dep = await this.schedule.findById(input.dependsOn, input.companyId);
      if (!dep || dep.projectId !== input.projectId) {
        throw new ConstructionValidationError('öncül aktivite aynı projede bulunamadı');
      }
    }

    const created = await this.schedule.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      parentId: input.parentId ?? null,
      code: input.code?.trim() || (await this.nextCode(input.companyId, input.projectId)),
      name: input.name.trim(),
      kind,
      plannedStart: input.plannedStart,
      // Kilometre taşı süresizdir; task'ta bitiş verilmezse tek günlük iş.
      plannedEnd:
        kind === 'milestone' ? input.plannedStart : (input.plannedEnd ?? input.plannedStart),
      weightPct: input.weightPct ?? 0,
      trackingId: input.trackingId ?? null,
      boqLineId: input.boqLineId ?? null,
      locationId: input.locationId ?? null,
      dependsOn: input.dependsOn ?? null,
      sortOrder: input.sortOrder ?? 0,
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
    });
    return toDto(created, this.clock.now().toISOString().slice(0, 10), new Map());
  }

  private async nextCode(companyId: number, projectId: number): Promise<string> {
    const rows = await this.schedule.listByProject(projectId, companyId, {
      includeInactive: true,
    });
    const max = rows.reduce((m, r) => {
      const match = /(\d+)\s*$/.exec(r.toJSON().code);
      return Math.max(m, match === null ? 0 : Number(match[1]));
    }, 0);
    return `AKT-${String(max + 1).padStart(3, '0')}`;
  }
}

export class UpdateActivityUseCase {
  constructor(
    private readonly schedule: ScheduleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: { activityId: number; companyId: number } & ScheduleActivityUpdate,
  ): Promise<ScheduleActivityDto> {
    const activity = await this.schedule.findById(input.activityId, input.companyId);
    if (!activity) throw new ScheduleActivityNotFoundError(input.activityId);

    if (input.parentId !== null && input.parentId !== undefined) {
      if (input.parentId === input.activityId) {
        throw new ConstructionValidationError('aktivite kendinin altına konamaz');
      }
      const parent = await this.schedule.findById(input.parentId, input.companyId);
      if (!parent || parent.projectId !== activity.projectId) {
        throw new ConstructionValidationError('üst aktivite aynı projede bulunamadı');
      }
      if (parent.kind !== 'group') {
        throw new ConstructionValidationError('yalnız grup satırının altına aktivite eklenebilir');
      }
    }
    if (input.dependsOn !== null && input.dependsOn !== undefined) {
      if (input.dependsOn === input.activityId) {
        throw new ConstructionValidationError('aktivite kendine bağımlı olamaz');
      }
      const dep = await this.schedule.findById(input.dependsOn, input.companyId);
      if (!dep || dep.projectId !== activity.projectId) {
        throw new ConstructionValidationError('öncül aktivite aynı projede bulunamadı');
      }
    }

    const { activityId: _a, companyId: _c, ...patch } = input;
    const updated = activity.update(patch, this.clock.now());
    const saved = await this.schedule.update(updated);
    return toDto(saved, this.clock.now().toISOString().slice(0, 10), new Map());
  }
}

export class DeactivateActivityUseCase {
  constructor(private readonly schedule: ScheduleRepository) {}

  async execute(input: { activityId: number; companyId: number }): Promise<{ deleted: boolean }> {
    const activity = await this.schedule.findById(input.activityId, input.companyId);
    if (!activity) throw new ScheduleActivityNotFoundError(input.activityId);
    // Altı dolu grup silinemez: çocuklar sessizce görünmez kalırdı.
    const children = await this.schedule.childCount(input.activityId, input.companyId);
    if (children > 0) {
      throw new ActivityHasChildrenError(input.activityId, children);
    }
    await this.schedule.deactivate(input.activityId, input.companyId);
    return { deleted: true };
  }
}

// ===== İLERLEME =============================================================

export class RecordActivityProgressUseCase {
  constructor(
    private readonly schedule: ScheduleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    activityId: number;
    companyId: number;
    progressPct?: number | undefined;
    /**
     * true → yüzde, bağlı fiziksel takipten ÇEKİLİR (tek tık senkron).
     * Otomatik değil kasıtlı bir eylemdir: program yüzdesi beyandır.
     */
    fromTracking?: boolean | undefined;
    asOf?: string | undefined;
    note?: string | null | undefined;
    actorUserId?: number | null | undefined;
  }): Promise<ScheduleActivityDto> {
    const activity = await this.schedule.findById(input.activityId, input.companyId);
    if (!activity) throw new ScheduleActivityNotFoundError(input.activityId);

    const today = this.clock.now().toISOString().slice(0, 10);
    const asOf = input.asOf ?? today;
    if (asOf > today) {
      // Geleceğe ilerleme yazılamaz: fiili eğri "olacak" değil "oldu" bilgisidir.
      throw new ConstructionValidationError('ilerleme geleceğe kaydedilemez');
    }

    let pct = input.progressPct;
    if (input.fromTracking === true) {
      const j = activity.toJSON();
      if (j.trackingId === null) {
        throw new ConstructionValidationError('aktiviteye bağlı fiziksel takip yok');
      }
      const pcts = await this.schedule.trackingProgress(j.projectId, input.companyId);
      const trackingPct = pcts.get(j.trackingId);
      if (trackingPct === undefined) {
        throw new ConstructionValidationError('bağlı takibin güncel yüzdesi bulunamadı');
      }
      pct = Math.round(trackingPct * 100) / 100;
    }
    if (pct === undefined) {
      throw new ConstructionValidationError('ilerleme yüzdesi ya da fromTracking verilmeli');
    }

    const updated = activity.recordProgress(pct, asOf, this.clock.now());
    await this.schedule.saveProgress(updated, asOf, input.note ?? null, input.actorUserId ?? null);
    return toDto(updated, today, new Map());
  }
}

// ===== OKUMA ================================================================

export interface ProjectScheduleDto {
  activities: ScheduleActivityDto[];
  summary: ScheduleSummaryRow | null;
}

export class GetProjectScheduleUseCase {
  constructor(
    private readonly schedule: ScheduleRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    projectId: number;
    includeInactive?: boolean | undefined;
  }): Promise<ProjectScheduleDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const today = this.clock.now().toISOString().slice(0, 10);
    const [rows, summary, trackingPcts] = await Promise.all([
      this.schedule.listByProject(input.projectId, input.companyId, {
        includeInactive: input.includeInactive ?? false,
      }),
      this.schedule.summary(input.projectId, input.companyId),
      this.schedule.trackingProgress(input.projectId, input.companyId),
    ]);
    return {
      activities: rows.map((a) => toDto(a, today, trackingPcts)),
      summary,
    };
  }
}

export class GetActivityProgressLogUseCase {
  constructor(private readonly schedule: ScheduleRepository) {}

  async execute(input: {
    activityId: number;
    companyId: number;
  }): Promise<ReadonlyArray<ProgressLogRow>> {
    const activity = await this.schedule.findById(input.activityId, input.companyId);
    if (!activity) throw new ScheduleActivityNotFoundError(input.activityId);
    return this.schedule.progressLog(input.activityId, input.companyId);
  }
}

export class GetProjectScheduleCurveUseCase {
  constructor(
    private readonly schedule: ScheduleRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    projectId: number;
    stepDays?: number | undefined;
  }): Promise<ScheduleCurve> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const [rows, logs] = await Promise.all([
      this.schedule.listByProject(input.projectId, input.companyId),
      this.schedule.progressLogByProject(input.projectId, input.companyId),
    ]);

    const logByActivity = new Map<number, { asOf: string; progressPct: number }[]>();
    for (const l of logs) {
      const arr = logByActivity.get(l.activityId);
      const entry = { asOf: l.asOf, progressPct: l.progressPct };
      if (arr) arr.push(entry);
      else logByActivity.set(l.activityId, [entry]);
    }

    // Eğriye yalnız YAPRAKLAR girer; grup satırı rollup'tır.
    const leaves: CurveActivity[] = rows
      .filter((a) => a.isLeaf)
      .map((a) => {
        const j = a.toJSON();
        return {
          id: j.id,
          kind: j.kind as 'task' | 'milestone',
          plannedStart: j.plannedStart,
          plannedEnd: j.plannedEnd,
          weightPct: j.weightPct,
          progressLog: logByActivity.get(j.id) ?? [],
        };
      });

    return computeScheduleCurve(
      leaves,
      this.clock.now().toISOString().slice(0, 10),
      input.stepDays ?? 7,
    );
  }
}
