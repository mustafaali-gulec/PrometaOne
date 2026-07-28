/**
 * Şantiye günlüğü DTO'ları (FAZ 3).
 */
import type { DailyLog, DailyLogEntry, DailyLogStatus } from '../../domain/entities/DailyLog.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type {
  AccidentSeverity,
  LogEntryKind,
  WorkState,
} from '../../domain/valueObjects/DailyLogKind.js';
import { isRecordableAccident, kindSpec } from '../../domain/valueObjects/DailyLogKind.js';
import type {
  DailyLogComment,
  DailyLogFile,
  DailyLogTotals,
  ManpowerRow,
} from '../ports/DailyLogRepository.js';

export interface DailyLogDto {
  id: number;
  companyId: number;
  projectId: number;
  logDate: string;
  status: DailyLogStatus;
  workState: WorkState;
  tempC: number | null;
  weatherNote: string | null;
  noWorkReason: string | null;
  summary: string | null;
  lockedBy: number | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Satır eklenip değiştirilebilir mi? (status === 'open') */
  editable: boolean;
}

export function toDailyLogDto(l: DailyLog): DailyLogDto {
  const j = l.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    logDate: j.logDate,
    status: j.status,
    workState: j.workState,
    tempC: j.tempC,
    weatherNote: j.weatherNote,
    noWorkReason: j.noWorkReason,
    summary: j.summary,
    lockedBy: j.lockedBy,
    lockedAt: j.lockedAt === null ? null : j.lockedAt.toISOString(),
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    editable: l.editable,
  };
}

export interface DailyLogEntryDto {
  id: number;
  logId: number;
  kind: LogEntryKind;
  locationId: number | null;
  vendorId: number | null;
  personnelId: number | null;
  machineId: number | null;
  materialId: number | null;
  boqLineId: number | null;
  trackingItemId: number | null;
  crewName: string | null;
  personName: string | null;
  description: string | null;
  headcount: number | null;
  hours: number | null;
  idleHours: number | null;
  qty: number | null;
  unit: string | null;
  amount: number | null;
  currency: CurrencyCode;
  waybillNo: string | null;
  occurredAt: string | null;
  severity: AccidentSeverity | null;
  lostDays: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function toDailyLogEntryDto(e: DailyLogEntry): DailyLogEntryDto {
  const j = e.toJSON();
  return {
    id: j.id,
    logId: j.logId,
    kind: j.kind,
    locationId: j.locationId,
    vendorId: j.vendorId,
    personnelId: j.personnelId,
    machineId: j.machineId,
    materialId: j.materialId,
    boqLineId: j.boqLineId,
    trackingItemId: j.trackingItemId,
    crewName: j.crewName,
    personName: j.personName,
    description: j.description,
    headcount: j.headcount,
    hours: j.hours,
    idleHours: j.idleHours,
    qty: j.qty,
    unit: j.unit,
    amount: j.amount,
    currency: j.currency,
    waybillNo: j.waybillNo,
    occurredAt: j.occurredAt,
    severity: j.severity,
    lostDays: j.lostDays,
    sortOrder: j.sortOrder,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

/** Kayıt tipi tarifi — arayüz form alanlarını buna göre kurar. */
export interface KindSpecDto {
  kind: LogEntryKind;
  required: ReadonlyArray<string>;
  optional: ReadonlyArray<string>;
  bridge: 'timesheet' | 'machine_log' | null;
}

export function kindSpecDto(kind: LogEntryKind): KindSpecDto {
  const spec = kindSpec(kind);
  return {
    kind,
    required: spec.required,
    optional: spec.optional,
    bridge: spec.bridge ?? null,
  };
}

/** Günün tam görünümü: başlık + toplamlar + tipe göre gruplanmış satırlar. */
export interface DailyLogDayDto {
  log: DailyLogDto;
  totals: DailyLogTotals | null;
  /** Satırlar tipe göre gruplu — saha ekranı her tipi kendi bölümünde gösterir. */
  sections: ReadonlyArray<{ kind: LogEntryKind; entries: ReadonlyArray<DailyLogEntryDto> }>;
  files: ReadonlyArray<DailyLogFile>;
  comments: ReadonlyArray<DailyLogComment>;
}

/** Bölüm sırası: sahada raporun okunma sırası (hava → insan → makine → olay). */
const SECTION_ORDER: ReadonlyArray<LogEntryKind> = [
  'subcontractor',
  'personnel',
  'equipment',
  'production',
  'material_used',
  'delivery',
  'accident',
  'fuel',
  'maintenance',
  'visitor',
  'note',
];

export function buildDayDto(
  log: DailyLogDto,
  totals: DailyLogTotals | null,
  entries: ReadonlyArray<DailyLogEntryDto>,
  files: ReadonlyArray<DailyLogFile>,
  comments: ReadonlyArray<DailyLogComment>,
): DailyLogDayDto {
  const byKind = new Map<LogEntryKind, DailyLogEntryDto[]>();
  for (const e of entries) {
    const arr = byKind.get(e.kind);
    if (arr) arr.push(e);
    else byKind.set(e.kind, [e]);
  }
  // TÜM tipler döner (boş olanlar dahil): saha ekranı "Kayıt Ekle" düğmesini her
  // bölüm için göstermeli, yoksa kullanıcı o tipi hiç bulamaz.
  const sections = SECTION_ORDER.map((kind) => ({
    kind,
    entries: (byKind.get(kind) ?? []).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
  }));
  return { log, totals, sections, files, comments };
}

/**
 * İSG özeti. Kaza sıklık ve ağırlık oranları Türkiye'deki İSG raporlamasının
 * standart iki göstergesidir:
 *   sıklık oranı  = kaza sayısı × 1.000.000 / toplam çalışma saati
 *   ağırlık oranı = kayıp gün × 1.000 / toplam çalışma saati
 * Çalışma saati 0 ise oran TANIMSIZDIR (null) — 0 döndürmek "kaza yok" gibi
 * okunur ve yanlış güven verir.
 */
export interface SafetySummaryDto {
  fromDate: string;
  toDate: string;
  totalHours: number;
  accidentCount: number;
  recordableAccidentCount: number;
  nearMissCount: number;
  lostDays: number;
  frequencyRate: number | null;
  severityRate: number | null;
}

export function buildSafetySummary(
  fromDate: string,
  toDate: string,
  manpower: ReadonlyArray<ManpowerRow>,
  totals: ReadonlyArray<DailyLogTotals>,
  severities: ReadonlyArray<AccidentSeverity>,
): SafetySummaryDto {
  const totalHours = manpower.reduce((s, m) => s + m.totalHours, 0);
  const accidentCount = totals.reduce((s, t) => s + t.accidentCount, 0);
  const lostDays = totals.reduce((s, t) => s + t.lostDays, 0);
  const recordable = severities.filter((sv) => isRecordableAccident(sv)).length;
  const nearMiss = severities.length - recordable;
  return {
    fromDate,
    toDate,
    totalHours,
    accidentCount,
    recordableAccidentCount: recordable,
    nearMissCount: nearMiss,
    lostDays,
    frequencyRate: totalHours === 0 ? null : (recordable * 1_000_000) / totalHours,
    severityRate: totalHours === 0 ? null : (lostDays * 1_000) / totalHours,
  };
}
