/**
 * Şantiye günlüğü use-case'leri (FAZ 3).
 *
 * KÖPRÜLER — ikiz veri girişini önlemenin bedeli olarak burada çapraz-agregat
 * yazma var; bilinçli bir karar:
 *   personnel satırı → cs_timesheets    (puantaj ve işçilik maliyeti tek kaynak)
 *   equipment satırı → cs_machine_logs  (makine maliyeti tek kaynak)
 * Alternatif, şantiye şefinin aynı saati bir günlüğe bir puantaja girmesiydi;
 * pratikte ikisi ayrışır ve maliyet raporu güvenilmez hale gelir.
 *
 * Köprü tek yönlüdür: günlük kaynak, puantaj/makine kaydı projeksiyon. Satır
 * silinince projeksiyon da temizlenir.
 */
import { DailyLogEntry } from '../../domain/entities/DailyLog.js';
import type { DailyLogStatus } from '../../domain/entities/DailyLog.js';
import {
  DailyLogEntryNotFoundError,
  DailyLogLockedError,
  DailyLogNotFoundError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type {
  AccidentSeverity,
  LogEntryKind,
  WorkState,
} from '../../domain/valueObjects/DailyLogKind.js';
import {
  buildDayDto,
  buildSafetySummary,
  toDailyLogDto,
  toDailyLogEntryDto,
  type DailyLogDayDto,
  type DailyLogDto,
  type DailyLogEntryDto,
  type SafetySummaryDto,
} from '../dto/DailyLogDtos.js';
import type { Clock } from '../ports/Clock.js';
import type {
  DailyLogComment,
  DailyLogFile,
  DailyLogRepository,
  DailyLogTotals,
  ManpowerRow,
  MaterialConsumptionRow,
  NewDailyLogFileInput,
  ProductionActualRow,
} from '../ports/DailyLogRepository.js';
import type { MachineLogRepository, TimesheetRepository } from '../ports/LaborRepositories.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';

/** Ayın ilk ve son günü (YYYY-MM-DD). */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, '0');
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${String(year)}-${mm}-01`, to: `${String(year)}-${mm}-${String(last)}` };
}

export interface GetDayInput {
  companyId: number;
  projectId: number;
  logDate: string;
  /** Gün kaydı yoksa oluşturulsun mu? Salt-okuma çağrılarında false. */
  create?: boolean | undefined;
  createdBy?: number | null | undefined;
}

/**
 * Günün tam görünümü. `create` true ise gün başlığı yoksa açılır — takvimde bir
 * güne tıklamak zaten "buraya kayıt gireceğim" demektir.
 */
export class GetDailyLogDayUseCase {
  constructor(
    private readonly logs: DailyLogRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: GetDayInput): Promise<DailyLogDayDto | null> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    let log = await this.logs.findByDate(input.projectId, input.companyId, input.logDate);
    if (!log) {
      if (input.create !== true) return null;
      log = await this.logs.ensureDay({
        companyId: input.companyId,
        projectId: input.projectId,
        logDate: input.logDate,
        workState: 'working',
        tempC: null,
        weatherNote: null,
        noWorkReason: null,
        summary: null,
        createdBy: input.createdBy ?? null,
      });
    }

    const [totals, entries, files, comments] = await Promise.all([
      this.logs.totalsFor(log.id, input.companyId),
      this.logs.listEntries(log.id, input.companyId),
      this.logs.listFiles(log.id, input.companyId),
      this.logs.listComments(log.id, input.companyId),
    ]);

    return buildDayDto(
      toDailyLogDto(log),
      totals,
      entries.map(toDailyLogEntryDto),
      files,
      comments,
    );
  }
}

export interface UpdateDayInput {
  companyId: number;
  logId: number;
  workState?: WorkState | undefined;
  tempC?: number | null | undefined;
  weatherNote?: string | null | undefined;
  noWorkReason?: string | null | undefined;
  summary?: string | null | undefined;
}

export class UpdateDailyLogUseCase {
  constructor(
    private readonly logs: DailyLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateDayInput): Promise<DailyLogDto> {
    const log = await this.logs.findById(input.logId, input.companyId);
    if (!log) throw new DailyLogNotFoundError(input.logId);
    if (!log.editable) throw new DailyLogLockedError(log.logDate);
    const updated = log.update(
      {
        ...(input.workState !== undefined ? { workState: input.workState } : {}),
        ...(input.tempC !== undefined ? { tempC: input.tempC } : {}),
        ...(input.weatherNote !== undefined ? { weatherNote: input.weatherNote } : {}),
        ...(input.noWorkReason !== undefined ? { noWorkReason: input.noWorkReason } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
      },
      this.clock.now(),
    );
    await this.logs.update(updated);
    return toDailyLogDto(updated);
  }
}

export class ChangeDailyLogStatusUseCase {
  constructor(
    private readonly logs: DailyLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    logId: number;
    status: DailyLogStatus;
    actorUserId?: number | null | undefined;
  }): Promise<DailyLogDto> {
    const log = await this.logs.findById(input.logId, input.companyId);
    if (!log) throw new DailyLogNotFoundError(input.logId);
    const moved = log.changeStatus(input.status, input.actorUserId ?? null, this.clock.now());
    await this.logs.update(moved);
    return toDailyLogDto(moved);
  }
}

export interface SaveEntryInput {
  companyId: number;
  logId: number;
  /** Doluysa güncelleme, boşsa ekleme. */
  entryId?: number | undefined;
  kind: LogEntryKind;
  locationId?: number | null | undefined;
  vendorId?: number | null | undefined;
  personnelId?: number | null | undefined;
  machineId?: number | null | undefined;
  materialId?: number | null | undefined;
  boqLineId?: number | null | undefined;
  trackingItemId?: number | null | undefined;
  crewName?: string | null | undefined;
  personName?: string | null | undefined;
  description?: string | null | undefined;
  headcount?: number | null | undefined;
  hours?: number | null | undefined;
  idleHours?: number | null | undefined;
  qty?: number | null | undefined;
  unit?: string | null | undefined;
  amount?: number | null | undefined;
  currency?: CurrencyCode | undefined;
  waybillNo?: string | null | undefined;
  occurredAt?: string | null | undefined;
  severity?: AccidentSeverity | null | undefined;
  lostDays?: number | null | undefined;
  sortOrder?: number | undefined;
  createdBy?: number | null | undefined;
}

export class SaveDailyLogEntryUseCase {
  constructor(
    private readonly logs: DailyLogRepository,
    private readonly timesheets: TimesheetRepository,
    private readonly machineLogs: MachineLogRepository,
  ) {}

  async execute(input: SaveEntryInput): Promise<DailyLogEntryDto> {
    const log = await this.logs.findById(input.logId, input.companyId);
    if (!log) throw new DailyLogNotFoundError(input.logId);
    if (!log.editable) throw new DailyLogLockedError(log.logDate);

    const payload = {
      companyId: input.companyId,
      logId: input.logId,
      kind: input.kind,
      locationId: input.locationId ?? null,
      vendorId: input.vendorId ?? null,
      personnelId: input.personnelId ?? null,
      machineId: input.machineId ?? null,
      materialId: input.materialId ?? null,
      boqLineId: input.boqLineId ?? null,
      trackingItemId: input.trackingItemId ?? null,
      crewName: input.crewName ?? null,
      personName: input.personName ?? null,
      description: input.description ?? null,
      headcount: input.headcount ?? null,
      hours: input.hours ?? null,
      idleHours: input.idleHours ?? null,
      qty: input.qty ?? null,
      unit: input.unit ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? 'TRY',
      waybillNo: input.waybillNo ?? null,
      occurredAt: input.occurredAt ?? null,
      severity: input.severity ?? null,
      lostDays: input.lostDays ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdBy: input.createdBy ?? null,
    };

    let saved: DailyLogEntry;
    if (input.entryId !== undefined) {
      const existing = await this.logs.findEntry(input.entryId, input.companyId);
      if (!existing || existing.logId !== input.logId) {
        throw new DailyLogEntryNotFoundError(input.entryId);
      }
      const j = existing.toJSON();
      // Entity.create doğrulamayı tekrar koşar: tip kuralları güncellemede de geçerli.
      saved = DailyLogEntry.create({ ...j, ...payload, id: existing.id, updatedAt: new Date() });
      await this.logs.updateEntry(saved);
    } else {
      saved = await this.logs.insertEntry(payload);
    }

    await this.syncBridge(log.projectId, log.logDate, saved);
    return toDailyLogEntryDto(saved);
  }

  /** Köprü: personel → puantaj, ekipman → makine kaydı. */
  private async syncBridge(
    projectId: number,
    logDate: string,
    entry: DailyLogEntry,
  ): Promise<void> {
    if (entry.bridge === 'timesheet' && entry.personnelId !== null && entry.hours !== null) {
      await this.timesheets.upsert({
        companyId: entry.companyId,
        personnelId: entry.personnelId,
        workDate: logDate,
        hours: entry.hours,
        overtime: 0,
        statusCode: 'P',
        boqLineId: entry.boqLineId,
        createdBy: entry.createdBy,
      });
    }
    if (entry.bridge === 'machine_log' && entry.machineId !== null && entry.hours !== null) {
      await this.machineLogs.insert({
        companyId: entry.companyId,
        machineId: entry.machineId,
        projectId,
        logDate,
        workHours: entry.hours,
        fuelLiters: 0,
        fuelCost: 0,
        maintCost: 0,
        boqLineId: entry.boqLineId,
        note: entry.description,
        createdBy: entry.createdBy,
      });
    }
  }
}

export class DeleteDailyLogEntryUseCase {
  constructor(private readonly logs: DailyLogRepository) {}

  async execute(input: { companyId: number; entryId: number }): Promise<{ deleted: boolean }> {
    const entry = await this.logs.findEntry(input.entryId, input.companyId);
    if (!entry) throw new DailyLogEntryNotFoundError(input.entryId);
    const log = await this.logs.findById(entry.logId, input.companyId);
    if (!log) throw new DailyLogNotFoundError(entry.logId);
    if (!log.editable) throw new DailyLogLockedError(log.logDate);
    const deleted = await this.logs.deleteEntry(input.entryId, input.companyId);
    return { deleted };
  }
}

export interface MonthCalendarInput {
  companyId: number;
  projectId: number;
  year: number;
  month: number;
}

export interface MonthCalendarDto {
  projectId: number;
  fromDate: string;
  toDate: string;
  days: ReadonlyArray<DailyLogTotals>;
}

/** Ay takvimi — her günün toplamları (takvim hücresi göstergeleri). */
export class GetDailyLogMonthUseCase {
  constructor(private readonly logs: DailyLogRepository) {}

  async execute(input: MonthCalendarInput): Promise<MonthCalendarDto> {
    const { from, to } = monthRange(input.year, input.month);
    const days = await this.logs.listTotals(input.projectId, input.companyId, from, to);
    return { projectId: input.projectId, fromDate: from, toDate: to, days };
  }
}

export class AddDailyLogFileUseCase {
  constructor(private readonly logs: DailyLogRepository) {}

  async execute(input: NewDailyLogFileInput): Promise<DailyLogFile> {
    const log = await this.logs.findById(input.logId, input.companyId);
    if (!log) throw new DailyLogNotFoundError(input.logId);
    if (!log.editable) throw new DailyLogLockedError(log.logDate);
    return this.logs.addFile(input);
  }
}

export class DeleteDailyLogFileUseCase {
  constructor(private readonly logs: DailyLogRepository) {}

  async execute(input: { companyId: number; fileId: number }): Promise<{ deleted: boolean }> {
    return { deleted: await this.logs.deleteFile(input.fileId, input.companyId) };
  }
}

/**
 * Yorum ekleme. Kilitli günde de YORUM YAPILABİLİR: kilit veri girişini
 * dondurur, yazışmayı değil — teknik ofis kapanmış bir rapora şerh düşebilmeli.
 */
export class AddDailyLogCommentUseCase {
  constructor(private readonly logs: DailyLogRepository) {}

  async execute(input: {
    companyId: number;
    logId: number;
    entryId?: number | null | undefined;
    body: string;
    createdBy?: number | null | undefined;
  }): Promise<DailyLogComment> {
    const log = await this.logs.findById(input.logId, input.companyId);
    if (!log) throw new DailyLogNotFoundError(input.logId);
    return this.logs.addComment({
      companyId: input.companyId,
      logId: input.logId,
      entryId: input.entryId ?? null,
      body: input.body.trim(),
      createdBy: input.createdBy ?? null,
    });
  }
}

export interface ManpowerReportDto {
  projectId: number;
  fromDate: string;
  toDate: string;
  rows: ReadonlyArray<ManpowerRow>;
  totalOwnHours: number;
  totalSubHours: number;
  totalHours: number;
  /** Çalışılan gün sayısı (not_working hariç). */
  workedDays: number;
  notWorkedDays: number;
  /** Ortalama günlük mevcut (çalışılan günler üzerinden). */
  avgHeadcountPerWorkedDay: number | null;
}

/** İş gücü raporu — adam-gün eğrisinin ve mevcut analizinin girdisi. */
export class GetManpowerReportUseCase {
  constructor(private readonly logs: DailyLogRepository) {}

  async execute(input: {
    companyId: number;
    projectId: number;
    fromDate: string;
    toDate: string;
  }): Promise<ManpowerReportDto> {
    const rows = await this.logs.manpower(
      input.projectId,
      input.companyId,
      input.fromDate,
      input.toDate,
    );
    const worked = rows.filter((r) => r.workState !== 'not_working');
    const totalOwnHours = rows.reduce((s, r) => s + r.ownHours, 0);
    const totalSubHours = rows.reduce((s, r) => s + r.subHours, 0);
    const headSum = worked.reduce((s, r) => s + r.totalHeadcount, 0);
    return {
      projectId: input.projectId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      rows,
      totalOwnHours,
      totalSubHours,
      totalHours: totalOwnHours + totalSubHours,
      workedDays: worked.length,
      notWorkedDays: rows.length - worked.length,
      avgHeadcountPerWorkedDay: worked.length === 0 ? null : headSum / worked.length,
    };
  }
}

/** İSG özeti: kaza sıklık ve ağırlık oranları. */
export class GetSafetySummaryUseCase {
  constructor(private readonly logs: DailyLogRepository) {}

  async execute(input: {
    companyId: number;
    projectId: number;
    fromDate: string;
    toDate: string;
  }): Promise<SafetySummaryDto> {
    const [manpower, totals] = await Promise.all([
      this.logs.manpower(input.projectId, input.companyId, input.fromDate, input.toDate),
      this.logs.listTotals(input.projectId, input.companyId, input.fromDate, input.toDate),
    ]);

    // Şiddet dağılımı için kaza satırlarını topla (gün gün)
    const severities: AccidentSeverity[] = [];
    for (const t of totals) {
      if (t.accidentCount === 0) continue;
      const entries = await this.logs.listEntries(t.logId, input.companyId);
      for (const e of entries) {
        if (e.kind === 'accident' && e.severity !== null) severities.push(e.severity);
      }
    }

    return buildSafetySummary(input.fromDate, input.toDate, manpower, totals, severities);
  }
}

/** Keşif satırı bazında günlükten gelen imalat miktarları (Faz 4'ün girdisi). */
export class GetProductionActualsUseCase {
  constructor(private readonly logs: DailyLogRepository) {}

  async execute(input: {
    companyId: number;
    projectId: number;
  }): Promise<ReadonlyArray<ProductionActualRow>> {
    return this.logs.productionActuals(input.projectId, input.companyId);
  }
}

/** Mekân × malzeme tüketimi (fire analizinin girdisi). */
export class GetMaterialConsumptionUseCase {
  constructor(private readonly logs: DailyLogRepository) {}

  async execute(input: {
    companyId: number;
    projectId: number;
  }): Promise<ReadonlyArray<MaterialConsumptionRow>> {
    return this.logs.materialConsumption(input.projectId, input.companyId);
  }
}
