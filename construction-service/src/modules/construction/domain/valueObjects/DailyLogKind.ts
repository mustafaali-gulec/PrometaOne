/**
 * LogEntryKind / AccidentSeverity — şantiye günlüğü kayıt tipleri.
 * Tablolar: cs_daily_log_entries.kind, .severity (007_daily_log.sql)
 *
 * Tek tablo + `kind` ayrımı kullanıldığı için "hangi tipte hangi alan zorunlu"
 * bilgisi bir yerde toplanmak zorunda. O yer burası: DB CHECK'leri yalnız en
 * kritik ikisini (kaza→şiddet, imalat→miktar+birim) koruyor; kalan kurallar
 * burada tanımlanıp entity tarafından uygulanıyor.
 *
 * Alternatif (11 ayrı tablo) reddedildi: satırların çoğu aynı alanları paylaşıyor
 * ve saha ekranı hepsini tek listede gösteriyor.
 */
export const LOG_ENTRY_KINDS = [
  'subcontractor',
  'personnel',
  'equipment',
  'note',
  'delivery',
  'accident',
  'material_used',
  'production',
  'fuel',
  'maintenance',
  'visitor',
] as const;
export type LogEntryKind = (typeof LOG_ENTRY_KINDS)[number];

export function isLogEntryKind(v: unknown): v is LogEntryKind {
  return typeof v === 'string' && (LOG_ENTRY_KINDS as ReadonlyArray<string>).includes(v);
}

export const ACCIDENT_SEVERITIES = [
  'near_miss',
  'first_aid',
  'medical',
  'lost_time',
  'fatal',
] as const;
export type AccidentSeverity = (typeof ACCIDENT_SEVERITIES)[number];

export function isAccidentSeverity(v: unknown): v is AccidentSeverity {
  return typeof v === 'string' && (ACCIDENT_SEVERITIES as ReadonlyArray<string>).includes(v);
}

/**
 * Kayıtlanabilir kaza mı? 'near_miss' (ramak kala) İSG istatistiğinde kaza
 * SAYILMAZ ama mutlaka kaydedilir — önleyici faaliyetin girdisidir.
 */
export function isRecordableAccident(severity: AccidentSeverity): boolean {
  return severity !== 'near_miss';
}

/** Tipin hangi alanları anlamlı taşıdığını tarif eder. */
export interface KindSpec {
  /** Bu tipte doldurulması ZORUNLU alanlar. */
  required: ReadonlyArray<KindField>;
  /** Bu tipte anlamlı olan (opsiyonel) alanlar. */
  optional: ReadonlyArray<KindField>;
  /** Personel/makine köprüsü kurulur mu? (cs_timesheets / cs_machine_logs) */
  bridge?: 'timesheet' | 'machine_log';
}

export type KindField =
  | 'locationId'
  | 'vendorId'
  | 'personnelId'
  | 'machineId'
  | 'materialId'
  | 'boqLineId'
  | 'trackingItemId'
  | 'crewName'
  | 'personName'
  | 'description'
  | 'headcount'
  | 'hours'
  | 'idleHours'
  | 'qty'
  | 'unit'
  | 'amount'
  | 'waybillNo'
  | 'occurredAt'
  | 'severity'
  | 'lostDays';

const SPECS: Readonly<Record<LogEntryKind, KindSpec>> = {
  // Taşeron: firma + kaç kişi + kaç saat + ne yapıldı. Konum şart değil (bazı
  // taşeron işleri saha genelinde yürür).
  subcontractor: {
    required: ['vendorId', 'headcount', 'hours'],
    optional: ['locationId', 'description', 'boqLineId'],
  },
  // Kendi personeli: kişi + saat. Ekip adı boşsa "ekipsiz" sayılır.
  personnel: {
    required: ['personnelId', 'hours'],
    optional: ['locationId', 'crewName', 'description', 'boqLineId'],
    bridge: 'timesheet',
  },
  // Makine: çalışma saati zorunlu, rölanti opsiyonel. Yakıt ayrı tipte
  // ('fuel') tutulur çünkü aynı gün birden çok ikmal olabilir.
  equipment: {
    required: ['machineId', 'hours'],
    optional: ['locationId', 'idleHours', 'description', 'boqLineId'],
    bridge: 'machine_log',
  },
  note: { required: ['description'], optional: ['locationId', 'occurredAt'] },
  // Teslimat: kimden geldi + irsaliye. Saat opsiyonel ama pratikte girilir.
  delivery: {
    required: ['vendorId'],
    optional: ['locationId', 'description', 'waybillNo', 'occurredAt', 'materialId', 'qty', 'unit'],
  },
  // Kaza: şiddet + ne olduğu zorunlu. Kim olduğu personelden ya da serbest addan.
  accident: {
    required: ['severity', 'description'],
    optional: ['locationId', 'personnelId', 'personName', 'vendorId', 'occurredAt', 'lostDays'],
  },
  material_used: {
    required: ['materialId', 'qty', 'unit'],
    optional: ['locationId', 'description', 'boqLineId'],
  },
  // İmalat: ne kadar üretildi. boqLineId doluysa keşfin gerçekleşen miktarına,
  // trackingItemId doluysa fiziksel takibe bağlanır.
  production: {
    required: ['qty', 'unit', 'description'],
    optional: ['locationId', 'boqLineId', 'trackingItemId', 'vendorId'],
  },
  fuel: {
    required: ['machineId', 'qty', 'unit'],
    optional: ['locationId', 'description', 'amount', 'vendorId', 'waybillNo'],
  },
  maintenance: {
    required: ['machineId', 'description'],
    optional: ['locationId', 'amount', 'vendorId', 'occurredAt'],
  },
  visitor: {
    required: ['personName'],
    optional: ['locationId', 'description', 'occurredAt', 'vendorId'],
  },
};

export function kindSpec(kind: LogEntryKind): KindSpec {
  return SPECS[kind];
}

export function isFieldAllowed(kind: LogEntryKind, field: KindField): boolean {
  const spec = SPECS[kind];
  return spec.required.includes(field) || spec.optional.includes(field);
}

/** İnsan-okur alan adı (hata mesajlarında; UI kendi i18n'ini yapar). */
const FIELD_LABELS: Readonly<Record<KindField, string>> = {
  locationId: 'mekân',
  vendorId: 'firma',
  personnelId: 'personel',
  machineId: 'makine',
  materialId: 'malzeme',
  boqLineId: 'keşif satırı',
  trackingItemId: 'takip iş kalemi',
  crewName: 'ekip',
  personName: 'kişi adı',
  description: 'açıklama',
  headcount: 'kişi sayısı',
  hours: 'çalışma saati',
  idleHours: 'rölanti saati',
  qty: 'miktar',
  unit: 'birim',
  amount: 'tutar',
  waybillNo: 'irsaliye no',
  occurredAt: 'saat',
  severity: 'olay şiddeti',
  lostDays: 'kayıp gün',
};

export function fieldLabel(field: KindField): string {
  return FIELD_LABELS[field];
}

const KIND_LABELS: Readonly<Record<LogEntryKind, string>> = {
  subcontractor: 'taşeron kaydı',
  personnel: 'personel kaydı',
  equipment: 'ekipman kaydı',
  note: 'not kaydı',
  delivery: 'teslimat kaydı',
  accident: 'kaza kaydı',
  material_used: 'kullanılan malzeme kaydı',
  production: 'imalat kaydı',
  fuel: 'yakıt/sarf kaydı',
  maintenance: 'bakım/servis kaydı',
  visitor: 'ziyaretçi kaydı',
};

export function logEntryKindLabel(kind: LogEntryKind): string {
  return KIND_LABELS[kind];
}

export const WORK_STATES = ['working', 'not_working', 'partial'] as const;
export type WorkState = (typeof WORK_STATES)[number];

export function isWorkState(v: unknown): v is WorkState {
  return typeof v === 'string' && (WORK_STATES as ReadonlyArray<string>).includes(v);
}
