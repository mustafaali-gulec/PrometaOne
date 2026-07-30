/**
 * DailyLogRepository — şantiye günlüğü kalıcılık portu (FAZ 3).
 * Concrete: infrastructure/persistence/PgDailyLogRepository.ts
 */
import type { DailyLog, DailyLogEntry, DailyLogStatus } from '../../domain/entities/DailyLog.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type {
  AccidentSeverity,
  LogEntryKind,
  WorkState,
} from '../../domain/valueObjects/DailyLogKind.js';

export interface NewDailyLogInput {
  companyId: number;
  projectId: number;
  logDate: string;
  workState: WorkState;
  tempC: number | null;
  weatherNote: string | null;
  noWorkReason: string | null;
  summary: string | null;
  createdBy: number | null;
}

export interface NewDailyLogEntryInput {
  companyId: number;
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
  createdBy: number | null;
}

/** Gün başlığı toplamları — cs_v_daily_log_totals view'ından. */
export interface DailyLogTotals {
  logId: number;
  projectId: number;
  logDate: string;
  status: DailyLogStatus;
  workState: WorkState;
  subHeadcount: number;
  subHours: number;
  ownHeadcount: number;
  ownHours: number;
  equipHours: number;
  equipIdleHours: number;
  accidentCount: number;
  /** 'near_miss' hariç gerçek kaza sayısı. */
  realAccidentCount: number;
  lostDays: number;
  productionCount: number;
  deliveryCount: number;
  entryCount: number;
  fileCount: number;
}

/** İş gücü histogramı satırı — cs_v_daily_manpower. */
export interface ManpowerRow {
  logDate: string;
  workState: WorkState;
  ownHeadcount: number;
  ownHours: number;
  subHeadcount: number;
  subHours: number;
  totalHeadcount: number;
  totalHours: number;
}

/** Keşif satırı bazında günlükten toplanan imalat — cs_v_production_actuals. */
export interface ProductionActualRow {
  boqLineId: number;
  unit: string | null;
  producedQty: number;
  firstDate: string;
  lastDate: string;
  entryCount: number;
}

export interface MaterialConsumptionRow {
  materialId: number;
  locationId: number | null;
  unit: string | null;
  consumedQty: number;
  entryCount: number;
}

export interface DailyLogFile {
  id: number;
  logId: number;
  entryId: number | null;
  fileKind: string;
  title: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdBy: number | null;
  createdAt: string;
}

export interface NewDailyLogFileInput {
  companyId: number;
  logId: number;
  entryId: number | null;
  fileKind: string;
  title: string | null;
  fileUrl: string | null;
  contentBase64: string | null;
  mimeType: string | null;
  createdBy: number | null;
}

export interface DailyLogComment {
  id: number;
  logId: number;
  entryId: number | null;
  body: string;
  createdBy: number | null;
  createdAt: string;
}

export interface DailyLogRepository {
  /**
   * Gün başlığını bulur; yoksa OLUŞTURUR. Takvimde bir güne tıklandığında
   * kullanıcı zaten "bugüne kayıt gireceğim" demiş oluyor; ayrı bir "gün aç"
   * adımı gereksiz sürtünme yaratır.
   */
  ensureDay(input: NewDailyLogInput): Promise<DailyLog>;
  findById(id: number, companyId: number): Promise<DailyLog | null>;
  findByDate(projectId: number, companyId: number, logDate: string): Promise<DailyLog | null>;
  update(log: DailyLog): Promise<void>;

  /** Ay takvimi: verilen aralıktaki gün başlıkları + toplamları. */
  listTotals(
    projectId: number,
    companyId: number,
    fromDate: string,
    toDate: string,
  ): Promise<ReadonlyArray<DailyLogTotals>>;
  totalsFor(logId: number, companyId: number): Promise<DailyLogTotals | null>;

  insertEntry(input: NewDailyLogEntryInput): Promise<DailyLogEntry>;
  updateEntry(entry: DailyLogEntry): Promise<void>;
  findEntry(entryId: number, companyId: number): Promise<DailyLogEntry | null>;
  listEntries(logId: number, companyId: number): Promise<ReadonlyArray<DailyLogEntry>>;
  deleteEntry(entryId: number, companyId: number): Promise<boolean>;

  addFile(input: NewDailyLogFileInput): Promise<DailyLogFile>;
  listFiles(logId: number, companyId: number): Promise<ReadonlyArray<DailyLogFile>>;
  deleteFile(fileId: number, companyId: number): Promise<boolean>;

  addComment(input: {
    companyId: number;
    logId: number;
    entryId: number | null;
    body: string;
    createdBy: number | null;
  }): Promise<DailyLogComment>;
  listComments(logId: number, companyId: number): Promise<ReadonlyArray<DailyLogComment>>;

  manpower(
    projectId: number,
    companyId: number,
    fromDate: string,
    toDate: string,
  ): Promise<ReadonlyArray<ManpowerRow>>;
  productionActuals(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<ProductionActualRow>>;
  materialConsumption(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<MaterialConsumptionRow>>;
}
