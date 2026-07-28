/**
 * Tracking — şablonun bir projeye uygulanmış hâli ("Güncel Durum Takibi").
 * Tablolar: cs_trackings / cs_tracking_locations (006_physical_progress.sql).
 *
 * `projectWeightPct` takibin proje toplam ilerlemesine etkisidir. Projede birden
 * çok takip olabilir (blok bazlı kaba yapı %45, daire bazlı ince işler %55) ve
 * proje yüzdesi bunların ağırlıklı toplamıdır. Ağırlıklar 100'ün altında kalırsa
 * kalan pay ÖLÇÜLMEYEN iş sayılır ve %0 katkı verir — bu kasıtlı, çünkü
 * ölçülmeyeni ölçülenle aynı hızda ilerliyor varsaymak ilerlemeyi şişirir.
 *
 * Immutable — modül geneli kalıp.
 */
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';
import { canTransitionTracking, type TrackingStatus } from '../valueObjects/TrackingStatus.js';

export interface TrackingLocationProps {
  id: number;
  companyId: number;
  trackingId: number;
  locationId: number;
  /** Lokasyonun takip içi ağırlığı. Varsayılan 1 = eşit; m² oranı da girilebilir. */
  weightPct: number;
  sortOrder: number;
  /** Okuma tarafı zenginleştirmesi (JOIN'den gelir) */
  locationPath?: string;
  locationName?: string;
}

export interface TrackingProps {
  id: number;
  companyId: number;
  projectId: number;
  templateId: number;
  code: string;
  name: string;
  projectWeightPct: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  status: TrackingStatus;
  assignedUserId: number | null;
  visibleAll: boolean;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackingUpdate {
  name?: string;
  projectWeightPct?: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  assignedUserId?: number | null;
  visibleAll?: boolean;
  note?: string | null;
}

function assertWeight(v: number): number {
  if (!Number.isFinite(v) || v < 0 || v > 100) {
    throw new ConstructionValidationError('projeye etki oranı 0-100 aralığında olmalı');
  }
  return v;
}

export class Tracking {
  private constructor(private readonly props: Readonly<TrackingProps>) {}

  static create(props: TrackingProps): Tracking {
    if (props.id <= 0) throw new ConstructionValidationError('Tracking.id pozitif olmalı');
    if (props.companyId <= 0)
      throw new ConstructionValidationError('Tracking.companyId pozitif olmalı');
    if (props.projectId <= 0)
      throw new ConstructionValidationError('Tracking.projectId pozitif olmalı');
    const name = props.name.trim();
    if (name.length === 0) throw new ConstructionValidationError('takip adı boş olamaz');
    if (props.plannedStart && props.plannedEnd && props.plannedStart > props.plannedEnd) {
      throw new ConstructionValidationError('takip başlangıç tarihi bitiş tarihinden sonra olamaz');
    }
    return new Tracking({ ...props, name, projectWeightPct: assertWeight(props.projectWeightPct) });
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
  get templateId(): number {
    return this.props.templateId;
  }
  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get projectWeightPct(): number {
    return this.props.projectWeightPct;
  }
  get plannedStart(): string | null {
    return this.props.plannedStart;
  }
  get plannedEnd(): string | null {
    return this.props.plannedEnd;
  }
  get status(): TrackingStatus {
    return this.props.status;
  }
  get assignedUserId(): number | null {
    return this.props.assignedUserId;
  }
  get visibleAll(): boolean {
    return this.props.visibleAll;
  }
  get note(): string | null {
    return this.props.note;
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

  /** Saha durum girişi yalnız aktif takipte yapılabilir. */
  get acceptsFieldUpdates(): boolean {
    return this.props.status === 'active';
  }

  /**
   * Takvim bazlı BEKLENEN ilerleme — planlanan başlangıç/bitiş arasında doğrusal.
   * Fiili ilerleme ile farkı "sapma"dır (Imperium'daki Sapma kolonu).
   *
   * Tarih yoksa null döner: sapma hesaplanamaz, arayüz "—" gösterir. Bunu 0
   * varsaymak, planı olmayan takibi hep "önde" gösterir ve yanlış rahatlık verir.
   */
  plannedPctAt(asOf: string): number | null {
    const { plannedStart, plannedEnd } = this.props;
    if (!plannedStart || !plannedEnd) return null;
    if (asOf <= plannedStart) return 0;
    if (asOf >= plannedEnd) return 100;
    const start = Date.parse(`${plannedStart}T00:00:00Z`);
    const end = Date.parse(`${plannedEnd}T00:00:00Z`);
    const now = Date.parse(`${asOf}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return ((now - start) / (end - start)) * 100;
  }

  update(changes: TrackingUpdate, now: Date): Tracking {
    const plannedStart =
      changes.plannedStart !== undefined ? changes.plannedStart : this.props.plannedStart;
    const plannedEnd =
      changes.plannedEnd !== undefined ? changes.plannedEnd : this.props.plannedEnd;
    if (plannedStart && plannedEnd && plannedStart > plannedEnd) {
      throw new ConstructionValidationError('takip başlangıç tarihi bitiş tarihinden sonra olamaz');
    }
    const name = changes.name !== undefined ? changes.name.trim() : this.props.name;
    if (name.length === 0) throw new ConstructionValidationError('takip adı boş olamaz');
    return new Tracking({
      ...this.props,
      name,
      projectWeightPct:
        changes.projectWeightPct !== undefined
          ? assertWeight(changes.projectWeightPct)
          : this.props.projectWeightPct,
      plannedStart,
      plannedEnd,
      assignedUserId:
        changes.assignedUserId !== undefined ? changes.assignedUserId : this.props.assignedUserId,
      visibleAll: changes.visibleAll ?? this.props.visibleAll,
      note: changes.note !== undefined ? changes.note?.trim() || null : this.props.note,
      updatedAt: now,
    });
  }

  changeStatus(to: TrackingStatus, now: Date): Tracking {
    if (!canTransitionTracking(this.props.status, to)) {
      throw new InvalidStatusTransitionError(this.props.status, to);
    }
    if (to === this.props.status) return this;
    return new Tracking({ ...this.props, status: to, updatedAt: now });
  }

  toJSON(): Readonly<TrackingProps> {
    return { ...this.props };
  }
}
