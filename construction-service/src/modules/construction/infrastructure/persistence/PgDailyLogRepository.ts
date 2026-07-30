/**
 * PgDailyLogRepository — DailyLogRepository PG implementasyonu (FAZ 3).
 * Tablolar/view'lar: 007_daily_log.sql
 *
 * BIGINT ↔ string: node-pg int8'i STRING döndürür. Bu dosyadaki TÜM id ve
 * NUMERIC alanlar mapper'da Number()'a çevrilir — çevirmemek `entry.logId !==
 * input.logId` gibi katı karşılaştırmaları sessizce bozar
 * (bkz. 0793b9f, aynı hata Faz 1-2'de yaşandı).
 */
import type { Pool } from 'pg';

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
} from '../../application/ports/DailyLogRepository.js';
import { DailyLog, DailyLogEntry, type DailyLogStatus } from '../../domain/entities/DailyLog.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type {
  AccidentSeverity,
  LogEntryKind,
  WorkState,
} from '../../domain/valueObjects/DailyLogKind.js';

interface LogRow {
  id: string;
  company_id: number;
  project_id: string;
  log_date: string;
  status: DailyLogStatus;
  work_state: WorkState;
  temp_c: string | null;
  weather_note: string | null;
  no_work_reason: string | null;
  summary: string | null;
  locked_by: number | null;
  locked_at: Date | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const LOG_COLS =
  'id, company_id, project_id, log_date::text AS log_date, status, work_state, temp_c, ' +
  'weather_note, no_work_reason, summary, locked_by, locked_at, created_by, created_at, updated_at';

const n = (v: string | null): number | null => (v === null ? null : Number(v));

function rowToLog(r: LogRow): DailyLog {
  return DailyLog.create({
    id: Number(r.id),
    companyId: Number(r.company_id),
    projectId: Number(r.project_id),
    logDate: r.log_date,
    status: r.status,
    workState: r.work_state,
    tempC: n(r.temp_c),
    weatherNote: r.weather_note,
    noWorkReason: r.no_work_reason,
    summary: r.summary,
    lockedBy: r.locked_by === null ? null : Number(r.locked_by),
    lockedAt: r.locked_at,
    createdBy: r.created_by === null ? null : Number(r.created_by),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

interface EntryRow {
  id: string;
  company_id: number;
  log_id: string;
  kind: LogEntryKind;
  location_id: string | null;
  vendor_id: string | null;
  personnel_id: string | null;
  machine_id: string | null;
  material_id: string | null;
  boq_line_id: string | null;
  tracking_item_id: string | null;
  crew_name: string | null;
  person_name: string | null;
  description: string | null;
  headcount: number | null;
  hours: string | null;
  idle_hours: string | null;
  qty: string | null;
  unit: string | null;
  amount: string | null;
  currency: CurrencyCode;
  waybill_no: string | null;
  occurred_at: string | null;
  severity: AccidentSeverity | null;
  lost_days: number | null;
  sort_order: number;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const ENTRY_COLS =
  'id, company_id, log_id, kind, location_id, vendor_id, personnel_id, machine_id, material_id, ' +
  'boq_line_id, tracking_item_id, crew_name, person_name, description, headcount, hours, ' +
  'idle_hours, qty, unit, amount, currency, waybill_no, occurred_at::text AS occurred_at, ' +
  'severity, lost_days, sort_order, created_by, created_at, updated_at';

function rowToEntry(r: EntryRow): DailyLogEntry {
  return DailyLogEntry.create({
    id: Number(r.id),
    companyId: Number(r.company_id),
    logId: Number(r.log_id),
    kind: r.kind,
    locationId: r.location_id === null ? null : Number(r.location_id),
    vendorId: r.vendor_id === null ? null : Number(r.vendor_id),
    personnelId: r.personnel_id === null ? null : Number(r.personnel_id),
    machineId: r.machine_id === null ? null : Number(r.machine_id),
    materialId: r.material_id === null ? null : Number(r.material_id),
    boqLineId: r.boq_line_id === null ? null : Number(r.boq_line_id),
    trackingItemId: r.tracking_item_id === null ? null : Number(r.tracking_item_id),
    crewName: r.crew_name,
    personName: r.person_name,
    description: r.description,
    headcount: r.headcount === null ? null : Number(r.headcount),
    hours: n(r.hours),
    idleHours: n(r.idle_hours),
    qty: n(r.qty),
    unit: r.unit,
    amount: n(r.amount),
    currency: r.currency,
    waybillNo: r.waybill_no,
    // TIME kolonu 'HH:MM:SS' döner; saniyeyi kırpıp 'HH:MM' veriyoruz (arayüz
    // <input type="time"> bunu bekler).
    occurredAt: r.occurred_at === null ? null : r.occurred_at.slice(0, 5),
    severity: r.severity,
    lostDays: r.lost_days === null ? null : Number(r.lost_days),
    sortOrder: r.sort_order,
    createdBy: r.created_by === null ? null : Number(r.created_by),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

interface TotalsRow {
  log_id: string;
  project_id: string;
  log_date: string;
  status: DailyLogStatus;
  work_state: WorkState;
  sub_headcount: string;
  sub_hours: string;
  own_headcount: string;
  own_hours: string;
  equip_hours: string;
  equip_idle_hours: string;
  accident_count: string;
  real_accident_count: string;
  lost_days: string;
  production_count: string;
  delivery_count: string;
  entry_count: string;
  file_count: string;
}

const TOTALS_COLS =
  'log_id, project_id, log_date::text AS log_date, status, work_state, sub_headcount, sub_hours, ' +
  'own_headcount, own_hours, equip_hours, equip_idle_hours, accident_count, real_accident_count, ' +
  'lost_days, production_count, delivery_count, entry_count, file_count';

function rowToTotals(r: TotalsRow): DailyLogTotals {
  return {
    logId: Number(r.log_id),
    projectId: Number(r.project_id),
    logDate: r.log_date,
    status: r.status,
    workState: r.work_state,
    subHeadcount: Number(r.sub_headcount),
    subHours: Number(r.sub_hours),
    ownHeadcount: Number(r.own_headcount),
    ownHours: Number(r.own_hours),
    equipHours: Number(r.equip_hours),
    equipIdleHours: Number(r.equip_idle_hours),
    accidentCount: Number(r.accident_count),
    realAccidentCount: Number(r.real_accident_count),
    lostDays: Number(r.lost_days),
    productionCount: Number(r.production_count),
    deliveryCount: Number(r.delivery_count),
    entryCount: Number(r.entry_count),
    fileCount: Number(r.file_count),
  };
}

export class PgDailyLogRepository implements DailyLogRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * ON CONFLICT DO UPDATE değil DO NOTHING + tekrar SELECT: gün zaten varsa
   * kullanıcının girdiği hava/özet bilgisini EZMEMEK gerekir. ensureDay yalnız
   * "gün başlığı var olsun" garantisi verir, içeriğine dokunmaz.
   */
  async ensureDay(input: NewDailyLogInput): Promise<DailyLog> {
    const ins = await this.pool.query<LogRow>(
      `INSERT INTO cs_daily_logs
         (company_id, project_id, log_date, work_state, temp_c, weather_note,
          no_work_reason, summary, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (company_id, project_id, log_date) DO NOTHING
       RETURNING ${LOG_COLS}`,
      [
        input.companyId,
        input.projectId,
        input.logDate,
        input.workState,
        input.tempC,
        input.weatherNote,
        input.noWorkReason,
        input.summary,
        input.createdBy,
      ],
    );
    const created = ins.rows[0];
    if (created) return rowToLog(created);

    const existing = await this.findByDate(input.projectId, input.companyId, input.logDate);
    if (!existing) throw new Error(`cs_daily_logs upsert edilemedi: ${input.logDate}`);
    return existing;
  }

  async findById(id: number, companyId: number): Promise<DailyLog | null> {
    const r = await this.pool.query<LogRow>(
      `SELECT ${LOG_COLS} FROM cs_daily_logs WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToLog(row) : null;
  }

  async findByDate(
    projectId: number,
    companyId: number,
    logDate: string,
  ): Promise<DailyLog | null> {
    const r = await this.pool.query<LogRow>(
      `SELECT ${LOG_COLS} FROM cs_daily_logs
        WHERE project_id = $1 AND company_id = $2 AND log_date = $3`,
      [projectId, companyId, logDate],
    );
    const row = r.rows[0];
    return row ? rowToLog(row) : null;
  }

  async update(log: DailyLog): Promise<void> {
    const j = log.toJSON();
    await this.pool.query(
      `UPDATE cs_daily_logs
          SET status = $1, work_state = $2, temp_c = $3, weather_note = $4,
              no_work_reason = $5, summary = $6, locked_by = $7, locked_at = $8,
              updated_at = NOW()
        WHERE id = $9 AND company_id = $10`,
      [
        j.status,
        j.workState,
        j.tempC,
        j.weatherNote,
        j.noWorkReason,
        j.summary,
        j.lockedBy,
        j.lockedAt,
        j.id,
        j.companyId,
      ],
    );
  }

  async listTotals(
    projectId: number,
    companyId: number,
    fromDate: string,
    toDate: string,
  ): Promise<ReadonlyArray<DailyLogTotals>> {
    const r = await this.pool.query<TotalsRow>(
      `SELECT ${TOTALS_COLS} FROM cs_v_daily_log_totals
        WHERE project_id = $1 AND company_id = $2 AND log_date BETWEEN $3 AND $4
        ORDER BY log_date`,
      [projectId, companyId, fromDate, toDate],
    );
    return r.rows.map(rowToTotals);
  }

  async totalsFor(logId: number, companyId: number): Promise<DailyLogTotals | null> {
    const r = await this.pool.query<TotalsRow>(
      `SELECT ${TOTALS_COLS} FROM cs_v_daily_log_totals WHERE log_id = $1 AND company_id = $2`,
      [logId, companyId],
    );
    const row = r.rows[0];
    return row ? rowToTotals(row) : null;
  }

  async insertEntry(input: NewDailyLogEntryInput): Promise<DailyLogEntry> {
    const r = await this.pool.query<EntryRow>(
      `INSERT INTO cs_daily_log_entries
         (company_id, log_id, kind, location_id, vendor_id, personnel_id, machine_id,
          material_id, boq_line_id, tracking_item_id, crew_name, person_name, description,
          headcount, hours, idle_hours, qty, unit, amount, currency, waybill_no,
          occurred_at, severity, lost_days, sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
               $21,$22,$23,$24,$25,$26)
       RETURNING ${ENTRY_COLS}`,
      [
        input.companyId,
        input.logId,
        input.kind,
        input.locationId,
        input.vendorId,
        input.personnelId,
        input.machineId,
        input.materialId,
        input.boqLineId,
        input.trackingItemId,
        input.crewName,
        input.personName,
        input.description,
        input.headcount,
        input.hours,
        input.idleHours,
        input.qty,
        input.unit,
        input.amount,
        input.currency,
        input.waybillNo,
        input.occurredAt,
        input.severity,
        input.lostDays,
        input.sortOrder,
        input.createdBy,
      ],
    );
    return rowToEntry(r.rows[0]!);
  }

  async updateEntry(entry: DailyLogEntry): Promise<void> {
    const j = entry.toJSON();
    await this.pool.query(
      `UPDATE cs_daily_log_entries
          SET kind = $1, location_id = $2, vendor_id = $3, personnel_id = $4, machine_id = $5,
              material_id = $6, boq_line_id = $7, tracking_item_id = $8, crew_name = $9,
              person_name = $10, description = $11, headcount = $12, hours = $13,
              idle_hours = $14, qty = $15, unit = $16, amount = $17, currency = $18,
              waybill_no = $19, occurred_at = $20, severity = $21, lost_days = $22,
              sort_order = $23, updated_at = NOW()
        WHERE id = $24 AND company_id = $25`,
      [
        j.kind,
        j.locationId,
        j.vendorId,
        j.personnelId,
        j.machineId,
        j.materialId,
        j.boqLineId,
        j.trackingItemId,
        j.crewName,
        j.personName,
        j.description,
        j.headcount,
        j.hours,
        j.idleHours,
        j.qty,
        j.unit,
        j.amount,
        j.currency,
        j.waybillNo,
        j.occurredAt,
        j.severity,
        j.lostDays,
        j.sortOrder,
        j.id,
        j.companyId,
      ],
    );
  }

  async findEntry(entryId: number, companyId: number): Promise<DailyLogEntry | null> {
    const r = await this.pool.query<EntryRow>(
      `SELECT ${ENTRY_COLS} FROM cs_daily_log_entries WHERE id = $1 AND company_id = $2`,
      [entryId, companyId],
    );
    const row = r.rows[0];
    return row ? rowToEntry(row) : null;
  }

  async listEntries(logId: number, companyId: number): Promise<ReadonlyArray<DailyLogEntry>> {
    const r = await this.pool.query<EntryRow>(
      `SELECT ${ENTRY_COLS} FROM cs_daily_log_entries
        WHERE log_id = $1 AND company_id = $2
        ORDER BY kind, sort_order, id`,
      [logId, companyId],
    );
    return r.rows.map(rowToEntry);
  }

  async deleteEntry(entryId: number, companyId: number): Promise<boolean> {
    const r = await this.pool.query(
      `DELETE FROM cs_daily_log_entries WHERE id = $1 AND company_id = $2`,
      [entryId, companyId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async addFile(input: NewDailyLogFileInput): Promise<DailyLogFile> {
    const buf = input.contentBase64 === null ? null : Buffer.from(input.contentBase64, 'base64');
    const r = await this.pool.query<{
      id: string;
      log_id: string;
      entry_id: string | null;
      file_kind: string;
      title: string | null;
      file_url: string | null;
      mime_type: string | null;
      size_bytes: number | null;
      created_by: number | null;
      created_at: Date;
    }>(
      `INSERT INTO cs_daily_log_files
         (company_id, log_id, entry_id, file_kind, title, file_url, content, mime_type, size_bytes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, log_id, entry_id, file_kind, title, file_url, mime_type, size_bytes, created_by, created_at`,
      [
        input.companyId,
        input.logId,
        input.entryId,
        input.fileKind,
        input.title,
        input.fileUrl,
        buf,
        input.mimeType,
        buf === null ? null : buf.length,
        input.createdBy,
      ],
    );
    const row = r.rows[0]!;
    return {
      id: Number(row.id),
      logId: Number(row.log_id),
      entryId: row.entry_id === null ? null : Number(row.entry_id),
      fileKind: row.file_kind,
      title: row.title,
      fileUrl: row.file_url,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      createdBy: row.created_by === null ? null : Number(row.created_by),
      createdAt: row.created_at.toISOString(),
    };
  }

  async listFiles(logId: number, companyId: number): Promise<ReadonlyArray<DailyLogFile>> {
    // content SEÇİLMEZ: galeri listesi binary taşımamalı, indirme ayrı uçtan.
    const r = await this.pool.query<{
      id: string;
      log_id: string;
      entry_id: string | null;
      file_kind: string;
      title: string | null;
      file_url: string | null;
      mime_type: string | null;
      size_bytes: number | null;
      created_by: number | null;
      created_at: Date;
    }>(
      `SELECT id, log_id, entry_id, file_kind, title, file_url, mime_type, size_bytes,
              created_by, created_at
         FROM cs_daily_log_files
        WHERE log_id = $1 AND company_id = $2
        ORDER BY created_at`,
      [logId, companyId],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      logId: Number(row.log_id),
      entryId: row.entry_id === null ? null : Number(row.entry_id),
      fileKind: row.file_kind,
      title: row.title,
      fileUrl: row.file_url,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      createdBy: row.created_by === null ? null : Number(row.created_by),
      createdAt: row.created_at.toISOString(),
    }));
  }

  async deleteFile(fileId: number, companyId: number): Promise<boolean> {
    const r = await this.pool.query(
      `DELETE FROM cs_daily_log_files WHERE id = $1 AND company_id = $2`,
      [fileId, companyId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async addComment(input: {
    companyId: number;
    logId: number;
    entryId: number | null;
    body: string;
    createdBy: number | null;
  }): Promise<DailyLogComment> {
    const r = await this.pool.query<{
      id: string;
      log_id: string;
      entry_id: string | null;
      body: string;
      created_by: number | null;
      created_at: Date;
    }>(
      `INSERT INTO cs_daily_log_comments (company_id, log_id, entry_id, body, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, log_id, entry_id, body, created_by, created_at`,
      [input.companyId, input.logId, input.entryId, input.body, input.createdBy],
    );
    const row = r.rows[0]!;
    return {
      id: Number(row.id),
      logId: Number(row.log_id),
      entryId: row.entry_id === null ? null : Number(row.entry_id),
      body: row.body,
      createdBy: row.created_by === null ? null : Number(row.created_by),
      createdAt: row.created_at.toISOString(),
    };
  }

  async listComments(logId: number, companyId: number): Promise<ReadonlyArray<DailyLogComment>> {
    const r = await this.pool.query<{
      id: string;
      log_id: string;
      entry_id: string | null;
      body: string;
      created_by: number | null;
      created_at: Date;
    }>(
      `SELECT id, log_id, entry_id, body, created_by, created_at
         FROM cs_daily_log_comments
        WHERE log_id = $1 AND company_id = $2
        ORDER BY created_at`,
      [logId, companyId],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      logId: Number(row.log_id),
      entryId: row.entry_id === null ? null : Number(row.entry_id),
      body: row.body,
      createdBy: row.created_by === null ? null : Number(row.created_by),
      createdAt: row.created_at.toISOString(),
    }));
  }

  async manpower(
    projectId: number,
    companyId: number,
    fromDate: string,
    toDate: string,
  ): Promise<ReadonlyArray<ManpowerRow>> {
    const r = await this.pool.query<{
      log_date: string;
      work_state: WorkState;
      own_headcount: string;
      own_hours: string;
      sub_headcount: string;
      sub_hours: string;
      total_headcount: string;
      total_hours: string;
    }>(
      `SELECT log_date::text AS log_date, work_state, own_headcount, own_hours,
              sub_headcount, sub_hours, total_headcount, total_hours
         FROM cs_v_daily_manpower
        WHERE project_id = $1 AND company_id = $2 AND log_date BETWEEN $3 AND $4
        ORDER BY log_date`,
      [projectId, companyId, fromDate, toDate],
    );
    return r.rows.map((row) => ({
      logDate: row.log_date,
      workState: row.work_state,
      ownHeadcount: Number(row.own_headcount),
      ownHours: Number(row.own_hours),
      subHeadcount: Number(row.sub_headcount),
      subHours: Number(row.sub_hours),
      totalHeadcount: Number(row.total_headcount),
      totalHours: Number(row.total_hours),
    }));
  }

  async productionActuals(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<ProductionActualRow>> {
    const r = await this.pool.query<{
      boq_line_id: string;
      unit: string | null;
      produced_qty: string;
      first_date: string;
      last_date: string;
      entry_count: string;
    }>(
      `SELECT boq_line_id, unit, produced_qty, first_date::text AS first_date,
              last_date::text AS last_date, entry_count
         FROM cs_v_production_actuals
        WHERE project_id = $1 AND company_id = $2
        ORDER BY boq_line_id`,
      [projectId, companyId],
    );
    return r.rows.map((row) => ({
      boqLineId: Number(row.boq_line_id),
      unit: row.unit,
      producedQty: Number(row.produced_qty),
      firstDate: row.first_date,
      lastDate: row.last_date,
      entryCount: Number(row.entry_count),
    }));
  }

  async materialConsumption(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<MaterialConsumptionRow>> {
    const r = await this.pool.query<{
      material_id: string;
      location_id: string | null;
      unit: string | null;
      consumed_qty: string;
      entry_count: string;
    }>(
      `SELECT material_id, location_id, unit, consumed_qty, entry_count
         FROM cs_v_material_consumption
        WHERE project_id = $1 AND company_id = $2
        ORDER BY material_id`,
      [projectId, companyId],
    );
    return r.rows.map((row) => ({
      materialId: Number(row.material_id),
      locationId: row.location_id === null ? null : Number(row.location_id),
      unit: row.unit,
      consumedQty: Number(row.consumed_qty),
      entryCount: Number(row.entry_count),
    }));
  }
}
