/**
 * Assignment — Saha görevlendirmesi (FAZ 6).
 * Tablo: cs_assignments (011_quality_safety.sql)
 *
 * Monolitin görev sisteminin İKİZİ DEĞİL: buradaki görevlendirme mekân ağacına
 * ve bir kaynak belgeye (hasar-eksiklik / RFI / denetim / günlük rapor / takip)
 * bağlı saha işidir. Kaynak bağı polimorfiktir (sourceKind + sourceId) ve FK
 * yoktur — kaynak kayıt pasife çekilse bile "şu iş verilmişti" izi kalmalı.
 *
 * `done` daima %100'e çekilir; "tamamlandı ama %60" satırı hem raporu hem DB
 * kısıtını bozar. `open`a dönen görev yüzdesini KORUR — yapılan iş silinmez.
 */
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';
import {
  canTransitionAssignment,
  normalizeProgress,
  overdueDays,
  type AssignmentSource,
  type AssignmentStatus,
  type Priority,
} from '../valueObjects/QualitySafety.js';

export interface AssignmentProps {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  title: string;
  description: string | null;
  assignedToUserId: number | null;
  vendorId: number | null;
  assignedBy: number | null;
  priority: Priority;
  status: AssignmentStatus;
  startDate: string | null;
  dueDate: string | null;
  doneAt: Date | null;
  progressPct: number;
  sourceKind: AssignmentSource | null;
  sourceId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentUpdate {
  locationId?: number | null;
  title?: string;
  description?: string | null;
  assignedToUserId?: number | null;
  vendorId?: number | null;
  priority?: Priority;
  startDate?: string | null;
  dueDate?: string | null;
  progressPct?: number;
}

export class Assignment {
  private constructor(private readonly props: Readonly<AssignmentProps>) {}

  static create(props: AssignmentProps): Assignment {
    if (props.title.trim() === '') {
      throw new ConstructionValidationError('görev başlığı boş olamaz');
    }
    if (props.code.trim() === '') {
      throw new ConstructionValidationError('görev kodu boş olamaz');
    }
    // Yarım referans aramada bulunmaz: tip varsa kimlik de olmalı (DB'de CHECK var).
    if ((props.sourceKind === null) !== (props.sourceId === null)) {
      throw new ConstructionValidationError('kaynak tipi ve kaynak kimliği birlikte verilmeli');
    }
    if (props.startDate !== null && props.dueDate !== null && props.startDate > props.dueDate) {
      throw new ConstructionValidationError('başlangıç tarihi bitiş tarihinden sonra olamaz');
    }
    return new Assignment({
      ...props,
      progressPct: normalizeProgress(props.status, props.progressPct),
    });
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get status(): AssignmentStatus {
    return this.props.status;
  }
  get progressPct(): number {
    return this.props.progressPct;
  }
  get open(): boolean {
    return this.props.status === 'open' || this.props.status === 'in_progress';
  }

  overdueDays(today: string): number | null {
    return overdueDays(this.props.dueDate, this.open, today);
  }

  update(patch: AssignmentUpdate, now: Date): Assignment {
    if (patch.title !== undefined && patch.title.trim() === '') {
      throw new ConstructionValidationError('görev başlığı boş olamaz');
    }
    const startDate = patch.startDate ?? this.props.startDate;
    const dueDate = patch.dueDate ?? this.props.dueDate;
    if (startDate !== null && dueDate !== null && startDate > dueDate) {
      throw new ConstructionValidationError('başlangıç tarihi bitiş tarihinden sonra olamaz');
    }

    const next: AssignmentProps = { ...this.props, ...patch, updatedAt: now };
    if (patch.progressPct !== undefined) {
      // %100 girmek görevi BİTMİŞ SAYMAZ: bitirme kararı ayrı bir eylemdir
      // (kim ne zaman bitirdi izi durum değişiminde tutulur). Ama 'done' bir
      // görevin yüzdesi 100'ün altına düşürülemez.
      next.progressPct = normalizeProgress(this.props.status, patch.progressPct);
    }
    return new Assignment(next);
  }

  changeStatus(to: AssignmentStatus, now: Date): Assignment {
    const from = this.props.status;
    if (from === to) return this;
    if (!canTransitionAssignment(from, to)) {
      throw new InvalidStatusTransitionError(from, to);
    }
    const next: AssignmentProps = { ...this.props, status: to, updatedAt: now };
    if (to === 'done') {
      next.doneAt = now;
      next.progressPct = 100;
    } else {
      // Bitmiş görev geri açılırsa yüzde 100'de KALIR — kullanıcı gerçek
      // ilerlemeyi kendisi düzeltir; otomatik düşürmek yapılan işi yok sayar.
      next.doneAt = null;
    }
    return new Assignment(next);
  }

  toJSON(): AssignmentProps {
    return { ...this.props };
  }
}
