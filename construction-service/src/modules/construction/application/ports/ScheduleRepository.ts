/**
 * ScheduleRepository — iş programı kalıcılık portu (FAZ 8).
 * Concrete: infrastructure/persistence/PgScheduleRepository.ts
 */
import type { ActivityKind, ScheduleActivity } from '../../domain/entities/ScheduleActivity.js';

export interface NewActivityInput {
  companyId: number;
  projectId: number;
  parentId: number | null;
  code: string;
  name: string;
  kind: ActivityKind;
  plannedStart: string;
  plannedEnd: string;
  weightPct: number;
  trackingId: number | null;
  boqLineId: number | null;
  locationId: number | null;
  dependsOn: number | null;
  sortOrder: number;
  note: string | null;
  createdBy: number | null;
}

export interface ProgressLogRow {
  id: number;
  activityId: number;
  asOf: string;
  progressPct: number;
  note: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface ScheduleSummaryRow {
  projectId: number;
  taskCount: number;
  doneCount: number;
  /** Bitmemiş + planlanan bitişi geçmiş. */
  overdueCount: number;
  /** Hiç başlamamış + planlanan başlangıcı geçmiş. */
  notStartedLateCount: number;
  projectStart: string | null;
  projectEnd: string | null;
}

export interface ScheduleRepository {
  insert(input: NewActivityInput): Promise<ScheduleActivity>;
  findById(id: number, companyId: number): Promise<ScheduleActivity | null>;
  listByProject(
    projectId: number,
    companyId: number,
    options?: { includeInactive?: boolean },
  ): Promise<ReadonlyArray<ScheduleActivity>>;
  update(activity: ScheduleActivity): Promise<ScheduleActivity>;
  /** Altında aktif çocuk sayısı — silme öncesi kontrol. */
  childCount(id: number, companyId: number): Promise<number>;
  deactivate(id: number, companyId: number): Promise<void>;
  /**
   * İlerleme + günlük tek transaction'da: aktivite güncellenir, (activity_id,
   * as_of) anahtarıyla günlüğe upsert edilir (aynı güne ikinci kayıt düzeltmedir).
   */
  saveProgress(
    activity: ScheduleActivity,
    asOf: string,
    note: string | null,
    actor: number | null,
  ): Promise<void>;
  progressLog(activityId: number, companyId: number): Promise<ReadonlyArray<ProgressLogRow>>;
  /** Projedeki TÜM yaprakların günlükleri — S-eğrisi girdisi (tek sorgu). */
  progressLogByProject(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<ProgressLogRow>>;
  summary(projectId: number, companyId: number): Promise<ScheduleSummaryRow | null>;
  /** Bağlı takiplerin güncel fiziksel yüzdesi (trackingId → pct). */
  trackingProgress(projectId: number, companyId: number): Promise<ReadonlyMap<number, number>>;
}
