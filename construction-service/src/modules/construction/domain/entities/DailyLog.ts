/**
 * DailyLog / DailyLogEntry — şantiye günlüğü (FAZ 3).
 * Tablolar: cs_daily_logs, cs_daily_log_entries (007_daily_log.sql)
 *
 * DailyLog gün başlığıdır ve bir KİLİT durum makinesi taşır:
 *   open ⇄ locked
 * Kilitli günde satır eklenemez/değiştirilemez. Bu, ıslak imzalı günlük raporun
 * karşılığıdır: rapor teslim edildikten sonra geçmişe dönük düzeltme, raporun
 * kanıt değerini yok eder. Kilit açma mümkün ama ayrı yetki ister (route katmanı)
 * ve kim açtığı iz bırakır.
 *
 * DailyLogEntry çok tipli satırdır; hangi alanların zorunlu olduğunu
 * DailyLogKind VO'su söyler ve doğrulama burada yapılır.
 */
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';
import {
  fieldLabel,
  kindSpec,
  logEntryKindLabel,
  type AccidentSeverity,
  type KindField,
  type LogEntryKind,
  type WorkState,
} from '../valueObjects/DailyLogKind.js';

export type DailyLogStatus = 'open' | 'locked';

export interface DailyLogProps {
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
  lockedAt: Date | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyLogUpdate {
  workState?: WorkState;
  tempC?: number | null;
  weatherNote?: string | null;
  noWorkReason?: string | null;
  summary?: string | null;
}

export class DailyLog {
  private constructor(private readonly props: Readonly<DailyLogProps>) {}

  static create(props: DailyLogProps): DailyLog {
    if (props.id <= 0) throw new ConstructionValidationError('DailyLog.id pozitif olmalı');
    if (props.companyId <= 0)
      throw new ConstructionValidationError('DailyLog.companyId pozitif olmalı');
    if (props.projectId <= 0)
      throw new ConstructionValidationError('DailyLog.projectId pozitif olmalı');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(props.logDate)) {
      throw new ConstructionValidationError('DailyLog.logDate YYYY-MM-DD olmalı');
    }
    if (props.status === 'locked' && (props.lockedAt === null || props.lockedBy === null)) {
      throw new ConstructionValidationError('kilitli günlükte kilitleyen ve kilit zamanı zorunlu');
    }
    return new DailyLog(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get projectId(): number {
    return this.props.projectId;
  }
  get logDate(): string {
    return this.props.logDate;
  }
  get status(): DailyLogStatus {
    return this.props.status;
  }
  get workState(): WorkState {
    return this.props.workState;
  }
  get tempC(): number | null {
    return this.props.tempC;
  }
  get weatherNote(): string | null {
    return this.props.weatherNote;
  }
  get noWorkReason(): string | null {
    return this.props.noWorkReason;
  }
  get summary(): string | null {
    return this.props.summary;
  }
  get lockedBy(): number | null {
    return this.props.lockedBy;
  }
  get lockedAt(): Date | null {
    return this.props.lockedAt;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Satır eklenip değiştirilebilir mi? */
  get editable(): boolean {
    return this.props.status === 'open';
  }

  update(changes: DailyLogUpdate, now: Date): DailyLog {
    if (!this.editable) {
      throw new ConstructionValidationError(
        `kilitli günlük düzenlenemez (${this.props.logDate}) — önce kilidi açın`,
      );
    }
    const workState = changes.workState ?? this.props.workState;
    const noWorkReason =
      changes.noWorkReason !== undefined ? changes.noWorkReason : this.props.noWorkReason;
    // Çalışılmayan gün gerekçesiz kalmamalı: "neden çalışılmadı" sorusu
    // hakediş süre uzatımı taleplerinde delil olarak kullanılır.
    if (workState === 'not_working' && (noWorkReason === null || noWorkReason.trim() === '')) {
      throw new ConstructionValidationError('çalışılmayan gün için gerekçe zorunlu');
    }
    return new DailyLog({
      ...this.props,
      workState,
      tempC: changes.tempC !== undefined ? changes.tempC : this.props.tempC,
      weatherNote:
        changes.weatherNote !== undefined
          ? changes.weatherNote?.trim() || null
          : this.props.weatherNote,
      noWorkReason: noWorkReason?.trim() || null,
      summary: changes.summary !== undefined ? changes.summary?.trim() || null : this.props.summary,
      updatedAt: now,
    });
  }

  lock(userId: number | null, now: Date): DailyLog {
    if (this.props.status === 'locked') return this;
    if (userId === null) {
      throw new ConstructionValidationError('günlüğü kilitleyen kullanıcı belirlenemedi');
    }
    return new DailyLog({
      ...this.props,
      status: 'locked',
      lockedBy: userId,
      lockedAt: now,
      updatedAt: now,
    });
  }

  unlock(now: Date): DailyLog {
    if (this.props.status === 'open') return this;
    // lockedBy/lockedAt SIFIRLANMAZ: son kilitleyenin izi kalır, "bu gün bir
    // kez kapatılıp sonra açıldı" bilgisi denetimde önemlidir.
    return new DailyLog({ ...this.props, status: 'open', updatedAt: now });
  }

  changeStatus(to: DailyLogStatus, userId: number | null, now: Date): DailyLog {
    if (to === this.props.status) return this;
    if (to === 'locked') return this.lock(userId, now);
    if (to === 'open') return this.unlock(now);
    throw new InvalidStatusTransitionError(this.props.status, to);
  }

  toJSON(): Readonly<DailyLogProps> {
    return { ...this.props };
  }
}

// ===== SATIR ================================================================

export interface DailyLogEntryProps {
  id: number;
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
  createdAt: Date;
  updatedAt: Date;
}

/** Alan → props anahtarı eşlemesi (doğrulamada kullanılır). */
const FIELD_TO_PROP: Readonly<Record<KindField, keyof DailyLogEntryDraft>> = {
  locationId: 'locationId',
  vendorId: 'vendorId',
  personnelId: 'personnelId',
  machineId: 'machineId',
  materialId: 'materialId',
  boqLineId: 'boqLineId',
  trackingItemId: 'trackingItemId',
  crewName: 'crewName',
  personName: 'personName',
  description: 'description',
  headcount: 'headcount',
  hours: 'hours',
  idleHours: 'idleHours',
  qty: 'qty',
  unit: 'unit',
  amount: 'amount',
  waybillNo: 'waybillNo',
  occurredAt: 'occurredAt',
  severity: 'severity',
  lostDays: 'lostDays',
};

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

/**
 * Henüz kaydedilmemiş satır — id ve zaman damgaları DB'den gelecek.
 */
export type DailyLogEntryDraft = Omit<DailyLogEntryProps, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Tip başına alan kurallarını doğrular. AYRI BİR FONKSİYON olması kasıtlı:
 * use-case bunu INSERT'ten ÖNCE çağırabilsin.
 *
 * Önceden doğrulama yalnız `DailyLogEntry.create` içinde yapılıyordu ve create
 * ancak DB'den okuma sırasında çağrıldığı için sıra şuydu: geçersiz satır
 * INSERT edilir → geri okunurken doğrulama patlar → istemci 400 alır ama SATIR
 * DB'DE KALIR. Kalan satır o günün tüm okumalarını kalıcı olarak 400'e düşürüyor,
 * yani bir yazım hatası günü kullanılamaz hale getiriyordu. Canlı duman testinde
 * bu şekilde yakalandı.
 */
export function assertValidEntry(props: DailyLogEntryDraft): void {
  if (props.logId <= 0) {
    throw new ConstructionValidationError('DailyLogEntry.logId pozitif olmalı');
  }

  const spec = kindSpec(props.kind);

  // Zorunlu alanlar dolu mu?
  for (const field of spec.required) {
    if (isBlank(props[FIELD_TO_PROP[field]])) {
      throw new ConstructionValidationError(
        `${logEntryKindLabel(props.kind)} için ${fieldLabel(field)} zorunlu`,
      );
    }
  }

  // Tipe uygun olmayan alan doldurulmuş mu? Sessizce kabul etmek, raporda
  // görünmeyen ama DB'de duran veri üretir; kullanıcı girdiğini sanır.
  for (const [field, prop] of Object.entries(FIELD_TO_PROP) as [
    KindField,
    keyof DailyLogEntryDraft,
  ][]) {
    if (isBlank(props[prop])) continue;
    if (!spec.required.includes(field) && !spec.optional.includes(field)) {
      throw new ConstructionValidationError(
        `${logEntryKindLabel(props.kind)} ${fieldLabel(field)} alanını taşımaz`,
      );
    }
  }

  // Sayısal sınırlar
  for (const [key, labelKey] of [
    ['headcount', 'headcount'],
    ['hours', 'hours'],
    ['idleHours', 'idleHours'],
    ['qty', 'qty'],
    ['amount', 'amount'],
    ['lostDays', 'lostDays'],
  ] as [keyof DailyLogEntryDraft, KindField][]) {
    const v = props[key];
    if (v === null || v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new ConstructionValidationError(`${fieldLabel(labelKey)} negatif olamaz`);
    }
  }

  // Kayıp gün yalnız iş-günü kaybına yol açan olaylarda anlamlı
  if (
    props.lostDays !== null &&
    props.lostDays > 0 &&
    props.severity !== null &&
    props.severity !== 'lost_time' &&
    props.severity !== 'fatal'
  ) {
    throw new ConstructionValidationError(
      "kayıp gün yalnız 'iş günü kaybı' veya 'ölümlü' olaylarda girilebilir",
    );
  }
}

export class DailyLogEntry {
  private constructor(private readonly props: Readonly<DailyLogEntryProps>) {}

  static create(props: DailyLogEntryProps): DailyLogEntry {
    if (props.id <= 0) throw new ConstructionValidationError('DailyLogEntry.id pozitif olmalı');
    assertValidEntry(props);

    return new DailyLogEntry({
      ...props,
      crewName: props.crewName?.trim() || null,
      personName: props.personName?.trim() || null,
      description: props.description?.trim() || null,
      unit: props.unit?.trim() || null,
      waybillNo: props.waybillNo?.trim() || null,
    });
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get logId(): number {
    return this.props.logId;
  }
  get kind(): LogEntryKind {
    return this.props.kind;
  }
  get locationId(): number | null {
    return this.props.locationId;
  }
  get vendorId(): number | null {
    return this.props.vendorId;
  }
  get personnelId(): number | null {
    return this.props.personnelId;
  }
  get machineId(): number | null {
    return this.props.machineId;
  }
  get materialId(): number | null {
    return this.props.materialId;
  }
  get boqLineId(): number | null {
    return this.props.boqLineId;
  }
  get trackingItemId(): number | null {
    return this.props.trackingItemId;
  }
  get crewName(): string | null {
    return this.props.crewName;
  }
  get personName(): string | null {
    return this.props.personName;
  }
  get description(): string | null {
    return this.props.description;
  }
  get headcount(): number | null {
    return this.props.headcount;
  }
  get hours(): number | null {
    return this.props.hours;
  }
  get idleHours(): number | null {
    return this.props.idleHours;
  }
  get qty(): number | null {
    return this.props.qty;
  }
  get unit(): string | null {
    return this.props.unit;
  }
  get amount(): number | null {
    return this.props.amount;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
  }
  get waybillNo(): string | null {
    return this.props.waybillNo;
  }
  get occurredAt(): string | null {
    return this.props.occurredAt;
  }
  get severity(): AccidentSeverity | null {
    return this.props.severity;
  }
  get lostDays(): number | null {
    return this.props.lostDays;
  }
  get sortOrder(): number {
    return this.props.sortOrder;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Bu satır cs_timesheets / cs_machine_logs köprüsü kurar mı? */
  get bridge(): 'timesheet' | 'machine_log' | undefined {
    return kindSpec(this.props.kind).bridge;
  }

  toJSON(): Readonly<DailyLogEntryProps> {
    return { ...this.props };
  }
}
