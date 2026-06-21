/**
 * ScheduledReportRepository portu — zamanlanmış rapor kalıcılığı.
 * Concrete: infrastructure/persistence/PgScheduledReportRepository.ts
 * Tablo: scheduled_reports (036_reporting.sql).
 */
import type { ReportRunStatus } from '../../domain/valueObjects/ReportEnums.js';

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export interface NewScheduledReport {
  companyId: number;
  reportId: number;
  frequency: ScheduleFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string; // "HH:MM"
  recipients: string[];
  paramValues: Record<string, unknown>;
  format: string; // 'xlsx'
  enabled: boolean;
  createdBy: number | null;
}

export type UpdateScheduledReportFields = Partial<
  Omit<NewScheduledReport, 'companyId' | 'reportId' | 'createdBy'>
>;

export interface ScheduledReport extends NewScheduledReport {
  id: number;
  lastRunAt: Date | null;
  lastStatus: ReportRunStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledReportRepository {
  insert(input: NewScheduledReport): Promise<ScheduledReport>;
  update(
    id: number,
    companyId: number,
    fields: UpdateScheduledReportFields,
  ): Promise<ScheduledReport | null>;
  remove(id: number, companyId: number): Promise<void>;
  findById(id: number, companyId: number): Promise<ScheduledReport | null>;
  listByCompany(companyId: number, reportId?: number): Promise<ReadonlyArray<ScheduledReport>>;
  /** Cron için — TÜM şirketlerde enabled olanlar. */
  listEnabled(): Promise<ReadonlyArray<ScheduledReport>>;
  markRun(id: number, status: ReportRunStatus, at: Date): Promise<void>;
}
