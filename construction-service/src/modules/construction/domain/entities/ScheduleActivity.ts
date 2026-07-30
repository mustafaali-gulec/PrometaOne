/**
 * ScheduleActivity — iş programı aktivitesi (FAZ 8).
 * Tablo: cs_schedule_activities (013_schedule.sql)
 *
 * Üç tip: group (WBS başlığı — eğriye/ağırlığa girmez), task, milestone
 * (süresiz: plannedStart === plannedEnd).
 *
 * FİİLİ TARİHLER İLERLEMEDEN TÜRER: ilk >0 ilerleme fiili başlangıcı, 100
 * fiili bitişi damgalar. Elle tarih girme YOK — "bitti ama fiili bitiş boş"
 * ya da "fiili bitiş var ama %60" gibi çelişik satırlar kurulamaz. 100'den
 * geri düşülürse fiili bitiş silinir (iş yeniden açıldı), fiili başlangıç
 * kalır (başlamışlık geri alınamaz).
 */
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';

export const ACTIVITY_KINDS = ['group', 'task', 'milestone'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ScheduleActivityProps {
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
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleActivityUpdate {
  parentId?: number | null | undefined;
  name?: string | undefined;
  kind?: ActivityKind | undefined;
  plannedStart?: string | undefined;
  plannedEnd?: string | undefined;
  weightPct?: number | undefined;
  trackingId?: number | null | undefined;
  boqLineId?: number | null | undefined;
  locationId?: number | null | undefined;
  dependsOn?: number | null | undefined;
  sortOrder?: number | undefined;
  note?: string | null | undefined;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertInvariants(p: ScheduleActivityProps): void {
  if (p.name.trim() === '') {
    throw new ConstructionValidationError('aktivite adı boş olamaz');
  }
  if (p.code.trim() === '') {
    throw new ConstructionValidationError('aktivite kodu boş olamaz');
  }
  if (!DATE_RE.test(p.plannedStart) || !DATE_RE.test(p.plannedEnd)) {
    throw new ConstructionValidationError('planlanan tarihler YYYY-MM-DD olmalı');
  }
  if (p.plannedStart > p.plannedEnd) {
    throw new ConstructionValidationError('planlanan başlangıç bitişten sonra olamaz');
  }
  if (p.kind === 'milestone' && p.plannedStart !== p.plannedEnd) {
    throw new ConstructionValidationError('kilometre taşının süresi olmaz (başlangıç = bitiş)');
  }
  if (p.progressPct < 0 || p.progressPct > 100) {
    throw new ConstructionValidationError('ilerleme 0-100 aralığında olmalı');
  }
  if (p.weightPct < 0) {
    throw new ConstructionValidationError('ağırlık negatif olamaz');
  }
  if (p.dependsOn !== null && p.dependsOn === p.id) {
    throw new ConstructionValidationError('aktivite kendine bağımlı olamaz');
  }
  if (p.parentId !== null && p.parentId === p.id) {
    throw new ConstructionValidationError('aktivite kendinin altına konamaz');
  }
  if (p.actualEnd !== null && p.actualStart === null) {
    throw new ConstructionValidationError('fiili bitiş fiili başlangıçsız olamaz');
  }
  if (p.actualStart !== null && p.actualEnd !== null && p.actualStart > p.actualEnd) {
    throw new ConstructionValidationError('fiili başlangıç bitişten sonra olamaz');
  }
}

export class ScheduleActivity {
  private constructor(private readonly props: Readonly<ScheduleActivityProps>) {}

  static create(props: ScheduleActivityProps): ScheduleActivity {
    assertInvariants(props);
    return new ScheduleActivity(props);
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
  get kind(): ActivityKind {
    return this.props.kind;
  }
  get progressPct(): number {
    return this.props.progressPct;
  }
  get isLeaf(): boolean {
    return this.props.kind !== 'group';
  }

  /** Gecikme günü: bitmemiş VE planlanan bitişi geçmiş; grup satırında null. */
  overdueDays(today: string): number | null {
    if (!this.isLeaf || this.props.progressPct >= 100) return null;
    if (today <= this.props.plannedEnd) return 0;
    const diff =
      Date.parse(`${today}T00:00:00Z`) - Date.parse(`${this.props.plannedEnd}T00:00:00Z`);
    return Math.max(0, Math.round(diff / 86_400_000));
  }

  update(patch: ScheduleActivityUpdate, now: Date): ScheduleActivity {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Partial<ScheduleActivityProps>;
    const next: ScheduleActivityProps = { ...this.props, ...clean, updatedAt: now };
    // Tip task→milestone'a dönerken süre sıfırlanır (bitiş güne çekilir) —
    // aksi halde invariant reddeder ve kullanıcı nedenini anlamaz.
    if (next.kind === 'milestone' && next.plannedStart !== next.plannedEnd) {
      next.plannedEnd = next.plannedStart;
    }
    assertInvariants(next);
    return new ScheduleActivity(next);
  }

  /**
   * İlerleme kaydı. Fiili tarihler buradan türer:
   *  - ilk >0 → actualStart = asOf (yalnız boşsa; başlamışlık geri alınamaz)
   *  - 100    → actualEnd = asOf
   *  - 100'den geri düşüş → actualEnd silinir (iş yeniden açıldı)
   */
  recordProgress(progressPct: number, asOf: string, now: Date): ScheduleActivity {
    if (this.props.kind === 'group') {
      throw new InvalidStatusTransitionError('group', 'ilerleme');
    }
    if (progressPct < 0 || progressPct > 100) {
      throw new ConstructionValidationError('ilerleme 0-100 aralığında olmalı');
    }
    if (!DATE_RE.test(asOf)) {
      throw new ConstructionValidationError('ilerleme tarihi YYYY-MM-DD olmalı');
    }

    const next: ScheduleActivityProps = { ...this.props, progressPct, updatedAt: now };
    if (progressPct > 0 && this.props.actualStart === null) {
      next.actualStart = asOf;
    }
    if (progressPct >= 100) {
      next.actualEnd = this.props.actualEnd ?? asOf;
    } else {
      next.actualEnd = null;
    }
    // Fiili bitiş fiili başlangıçtan önce olamaz: aynı gün 0→100 girildiyse eşitlenir.
    if (next.actualStart !== null && next.actualEnd !== null && next.actualEnd < next.actualStart) {
      next.actualEnd = next.actualStart;
    }
    assertInvariants(next);
    return new ScheduleActivity(next);
  }

  toJSON(): ScheduleActivityProps {
    return { ...this.props };
  }
}
