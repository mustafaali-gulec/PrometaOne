/**
 * ReportRunRepository portu — çalıştırma denetim kaydı (metadata-only).
 * Concrete: infrastructure/persistence/PgReportRunRepository.ts
 */
import type { ReportMode, ReportRunStatus } from '../../domain/valueObjects/ReportEnums.js';

export interface NewReportRun {
  companyId: number;
  reportId: number | null;
  mode: ReportMode;
  status: ReportRunStatus;
  rowCount: number | null;
  durationMs: number | null;
  truncated: boolean;
  sqlHash: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  runBy: number | null;
}

export interface ReportRun extends NewReportRun {
  id: number;
  createdAt: Date;
}

export interface ReportRunRepository {
  insert(input: NewReportRun): Promise<{ id: number }>;
  listByCompany(companyId: number, limit?: number): Promise<ReadonlyArray<ReportRun>>;
}
