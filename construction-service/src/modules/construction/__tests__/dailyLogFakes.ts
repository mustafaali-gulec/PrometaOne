/**
 * Faz 3 (şantiye günlüğü) için bellek-içi repository'ler.
 *
 * Toplamlar (cs_v_daily_log_totals) burada view'ın aynı mantığıyla hesaplanır:
 * taşeron satırında headcount alanı, kendi personelinde satır başına 1 kişi.
 */
import type {
  DailyLogComment,
  DailyLogFile,
  DailyLogRepository,
  DailyLogTotals,
  ManpowerRow,
  MaterialConsumptionRow,
  NewDailyLogEntryInput,
  NewDailyLogFileInput,
  NewDailyLogInput,
  ProductionActualRow,
} from '../application/ports/DailyLogRepository.js';
import type {
  MachineLogRepository,
  NewMachineLogInput,
  NewTimesheetInput,
  TimesheetRepository,
} from '../application/ports/LaborRepositories.js';
import { DailyLog, DailyLogEntry } from '../domain/entities/DailyLog.js';
import { MachineLog } from '../domain/entities/MachineLog.js';
import { Timesheet } from '../domain/entities/Timesheet.js';

const NOW = new Date('2026-07-28T09:00:00.000Z');

export class InMemoryDailyLogRepository implements DailyLogRepository {
  private logSeq = 0;
  private entrySeq = 0;
  private fileSeq = 0;
  private commentSeq = 0;
  readonly logs = new Map<number, DailyLog>();
  readonly entries: DailyLogEntry[] = [];
  readonly files: DailyLogFile[] = [];
  readonly comments: DailyLogComment[] = [];

  async ensureDay(input: NewDailyLogInput): Promise<DailyLog> {
    const existing = await this.findByDate(input.projectId, input.companyId, input.logDate);
    if (existing) return existing;
    this.logSeq += 1;
    const log = DailyLog.create({
      id: this.logSeq,
      companyId: input.companyId,
      projectId: input.projectId,
      logDate: input.logDate,
      status: 'open',
      workState: input.workState,
      tempC: input.tempC,
      weatherNote: input.weatherNote,
      noWorkReason: input.noWorkReason,
      summary: input.summary,
      lockedBy: null,
      lockedAt: null,
      createdBy: input.createdBy,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.logs.set(log.id, log);
    return log;
  }

  async findById(id: number, companyId: number): Promise<DailyLog | null> {
    const l = this.logs.get(id);
    return Promise.resolve(l && l.companyId === companyId ? l : null);
  }

  async findByDate(
    projectId: number,
    companyId: number,
    logDate: string,
  ): Promise<DailyLog | null> {
    return Promise.resolve(
      [...this.logs.values()].find(
        (l) => l.projectId === projectId && l.companyId === companyId && l.logDate === logDate,
      ) ?? null,
    );
  }

  async update(log: DailyLog): Promise<void> {
    this.logs.set(log.id, log);
    return Promise.resolve();
  }

  private totalsOf(log: DailyLog): DailyLogTotals {
    const mine = this.entries.filter((e) => e.logId === log.id);
    const sum = (
      pred: (e: DailyLogEntry) => boolean,
      pick: (e: DailyLogEntry) => number | null,
    ): number => mine.filter(pred).reduce((s, e) => s + (pick(e) ?? 0), 0);
    return {
      logId: log.id,
      projectId: log.projectId,
      logDate: log.logDate,
      status: log.status,
      workState: log.workState,
      subHeadcount: sum(
        (e) => e.kind === 'subcontractor',
        (e) => e.headcount,
      ),
      subHours: sum(
        (e) => e.kind === 'subcontractor',
        (e) => e.hours,
      ),
      // View ile aynı: kendi personelinde satır başına 1 kişi
      ownHeadcount: mine.filter((e) => e.kind === 'personnel').length,
      ownHours: sum(
        (e) => e.kind === 'personnel',
        (e) => e.hours,
      ),
      equipHours: sum(
        (e) => e.kind === 'equipment',
        (e) => e.hours,
      ),
      equipIdleHours: sum(
        (e) => e.kind === 'equipment',
        (e) => e.idleHours,
      ),
      accidentCount: mine.filter((e) => e.kind === 'accident').length,
      realAccidentCount: mine.filter((e) => e.kind === 'accident' && e.severity !== 'near_miss')
        .length,
      lostDays: sum(
        (e) => e.kind === 'accident',
        (e) => e.lostDays,
      ),
      productionCount: mine.filter((e) => e.kind === 'production').length,
      deliveryCount: mine.filter((e) => e.kind === 'delivery').length,
      entryCount: mine.length,
      fileCount: this.files.filter((f) => f.logId === log.id).length,
    };
  }

  async listTotals(
    projectId: number,
    companyId: number,
    fromDate: string,
    toDate: string,
  ): Promise<ReadonlyArray<DailyLogTotals>> {
    return Promise.resolve(
      [...this.logs.values()]
        .filter(
          (l) =>
            l.projectId === projectId &&
            l.companyId === companyId &&
            l.logDate >= fromDate &&
            l.logDate <= toDate,
        )
        .sort((a, b) => a.logDate.localeCompare(b.logDate))
        .map((l) => this.totalsOf(l)),
    );
  }

  async totalsFor(logId: number, companyId: number): Promise<DailyLogTotals | null> {
    const l = this.logs.get(logId);
    return Promise.resolve(l && l.companyId === companyId ? this.totalsOf(l) : null);
  }

  async insertEntry(input: NewDailyLogEntryInput): Promise<DailyLogEntry> {
    this.entrySeq += 1;
    const e = DailyLogEntry.create({
      ...input,
      id: this.entrySeq,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.entries.push(e);
    return Promise.resolve(e);
  }

  async updateEntry(entry: DailyLogEntry): Promise<void> {
    const idx = this.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) this.entries[idx] = entry;
    return Promise.resolve();
  }

  async findEntry(entryId: number, companyId: number): Promise<DailyLogEntry | null> {
    return Promise.resolve(
      this.entries.find((e) => e.id === entryId && e.companyId === companyId) ?? null,
    );
  }

  async listEntries(logId: number, companyId: number): Promise<ReadonlyArray<DailyLogEntry>> {
    return Promise.resolve(
      this.entries.filter((e) => e.logId === logId && e.companyId === companyId),
    );
  }

  async deleteEntry(entryId: number, companyId: number): Promise<boolean> {
    const idx = this.entries.findIndex((e) => e.id === entryId && e.companyId === companyId);
    if (idx < 0) return Promise.resolve(false);
    this.entries.splice(idx, 1);
    return Promise.resolve(true);
  }

  async addFile(input: NewDailyLogFileInput): Promise<DailyLogFile> {
    this.fileSeq += 1;
    const f: DailyLogFile = {
      id: this.fileSeq,
      logId: input.logId,
      entryId: input.entryId,
      fileKind: input.fileKind,
      title: input.title,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType,
      sizeBytes:
        input.contentBase64 === null ? null : Buffer.from(input.contentBase64, 'base64').length,
      createdBy: input.createdBy,
      createdAt: NOW.toISOString(),
    };
    this.files.push(f);
    return Promise.resolve(f);
  }

  async listFiles(logId: number, _companyId: number): Promise<ReadonlyArray<DailyLogFile>> {
    return Promise.resolve(this.files.filter((f) => f.logId === logId));
  }

  async deleteFile(fileId: number, _companyId: number): Promise<boolean> {
    const idx = this.files.findIndex((f) => f.id === fileId);
    if (idx < 0) return Promise.resolve(false);
    this.files.splice(idx, 1);
    return Promise.resolve(true);
  }

  async addComment(input: {
    companyId: number;
    logId: number;
    entryId: number | null;
    body: string;
    createdBy: number | null;
  }): Promise<DailyLogComment> {
    this.commentSeq += 1;
    const c: DailyLogComment = {
      id: this.commentSeq,
      logId: input.logId,
      entryId: input.entryId,
      body: input.body,
      createdBy: input.createdBy,
      createdAt: NOW.toISOString(),
    };
    this.comments.push(c);
    return Promise.resolve(c);
  }

  async listComments(logId: number, _companyId: number): Promise<ReadonlyArray<DailyLogComment>> {
    return Promise.resolve(this.comments.filter((c) => c.logId === logId));
  }

  async manpower(
    projectId: number,
    companyId: number,
    fromDate: string,
    toDate: string,
  ): Promise<ReadonlyArray<ManpowerRow>> {
    const totals = await this.listTotals(projectId, companyId, fromDate, toDate);
    return totals.map((t) => ({
      logDate: t.logDate,
      workState: t.workState,
      ownHeadcount: t.ownHeadcount,
      ownHours: t.ownHours,
      subHeadcount: t.subHeadcount,
      subHours: t.subHours,
      totalHeadcount: t.ownHeadcount + t.subHeadcount,
      totalHours: t.ownHours + t.subHours,
    }));
  }

  async productionActuals(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<ProductionActualRow>> {
    const byLine = new Map<number, ProductionActualRow>();
    for (const e of this.entries) {
      if (e.kind !== 'production' || e.boqLineId === null || e.companyId !== companyId) continue;
      const log = this.logs.get(e.logId);
      if (!log || log.projectId !== projectId) continue;
      const cur = byLine.get(e.boqLineId);
      if (cur) {
        byLine.set(e.boqLineId, {
          ...cur,
          producedQty: cur.producedQty + (e.qty ?? 0),
          firstDate: log.logDate < cur.firstDate ? log.logDate : cur.firstDate,
          lastDate: log.logDate > cur.lastDate ? log.logDate : cur.lastDate,
          entryCount: cur.entryCount + 1,
        });
      } else {
        byLine.set(e.boqLineId, {
          boqLineId: e.boqLineId,
          unit: e.unit,
          producedQty: e.qty ?? 0,
          firstDate: log.logDate,
          lastDate: log.logDate,
          entryCount: 1,
        });
      }
    }
    return Promise.resolve([...byLine.values()]);
  }

  async materialConsumption(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<MaterialConsumptionRow>> {
    const key = (m: number, l: number | null): string => `${String(m)}|${String(l ?? 0)}`;
    const acc = new Map<string, MaterialConsumptionRow>();
    for (const e of this.entries) {
      if (e.kind !== 'material_used' || e.materialId === null || e.companyId !== companyId)
        continue;
      const log = this.logs.get(e.logId);
      if (!log || log.projectId !== projectId) continue;
      const k = key(e.materialId, e.locationId);
      const cur = acc.get(k);
      if (cur) {
        acc.set(k, {
          ...cur,
          consumedQty: cur.consumedQty + (e.qty ?? 0),
          entryCount: cur.entryCount + 1,
        });
      } else {
        acc.set(k, {
          materialId: e.materialId,
          locationId: e.locationId,
          unit: e.unit,
          consumedQty: e.qty ?? 0,
          entryCount: 1,
        });
      }
    }
    return Promise.resolve([...acc.values()]);
  }
}

/** Köprü doğrulaması için: yazılan puantaj satırlarını biriktirir. */
export class RecordingTimesheetRepository implements TimesheetRepository {
  private seq = 0;
  readonly upserts: NewTimesheetInput[] = [];

  async upsert(input: NewTimesheetInput): Promise<Timesheet> {
    this.upserts.push(input);
    this.seq += 1;
    return Promise.resolve(
      Timesheet.create({
        id: this.seq,
        companyId: input.companyId,
        personnelId: input.personnelId,
        workDate: input.workDate,
        hours: input.hours,
        overtime: input.overtime,
        statusCode: input.statusCode,
        boqLineId: input.boqLineId,
        createdBy: input.createdBy,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  }

  async delete(_id: number, _companyId: number): Promise<boolean> {
    return Promise.resolve(true);
  }

  async listByProject(): Promise<ReadonlyArray<Timesheet>> {
    return Promise.resolve([]);
  }
}

/** Köprü doğrulaması için: yazılan makine kayıtlarını biriktirir. */
export class RecordingMachineLogRepository implements MachineLogRepository {
  private seq = 0;
  readonly inserts: NewMachineLogInput[] = [];

  async insert(input: NewMachineLogInput): Promise<MachineLog> {
    this.inserts.push(input);
    this.seq += 1;
    return Promise.resolve(
      MachineLog.create({
        id: this.seq,
        companyId: input.companyId,
        machineId: input.machineId,
        projectId: input.projectId,
        logDate: input.logDate,
        workHours: input.workHours,
        fuelLiters: input.fuelLiters,
        fuelCost: input.fuelCost,
        maintCost: input.maintCost,
        boqLineId: input.boqLineId,
        note: input.note,
        createdBy: input.createdBy,
        createdAt: NOW,
      }),
    );
  }

  async delete(_id: number, _companyId: number): Promise<boolean> {
    return Promise.resolve(true);
  }

  async listByProject(): Promise<ReadonlyArray<MachineLog>> {
    return Promise.resolve([]);
  }
}
