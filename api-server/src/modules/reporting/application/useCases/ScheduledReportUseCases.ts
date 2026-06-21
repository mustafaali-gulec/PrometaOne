/**
 * Zamanlanmış rapor (scheduled_reports) CRUD use-case'leri.
 */
import { ReportDefinitionNotFoundError } from '../../domain/errors/ReportingErrors.js';
import type { ReportDefinitionRepository } from '../ports/ReportDefinitionRepository.js';
import type {
  NewScheduledReport,
  ScheduledReport,
  ScheduledReportRepository,
  UpdateScheduledReportFields,
} from '../ports/ScheduledReportRepository.js';

export class CreateScheduledReportUseCase {
  constructor(
    private readonly schedules: ScheduledReportRepository,
    private readonly definitions: ReportDefinitionRepository,
  ) {}

  async execute(input: NewScheduledReport): Promise<ScheduledReport> {
    // Rapor tanımı bu şirkette var mı?
    const def = await this.definitions.findById(input.reportId, input.companyId);
    if (!def) throw new ReportDefinitionNotFoundError(input.reportId);
    return this.schedules.insert(input);
  }
}

export interface UpdateScheduledReportInput extends UpdateScheduledReportFields {
  id: number;
  companyId: number;
}

export class UpdateScheduledReportUseCase {
  constructor(private readonly schedules: ScheduledReportRepository) {}

  async execute(input: UpdateScheduledReportInput): Promise<ScheduledReport | null> {
    const { id, companyId, ...fields } = input;
    return this.schedules.update(id, companyId, fields);
  }
}

export class DeleteScheduledReportUseCase {
  constructor(private readonly schedules: ScheduledReportRepository) {}

  async execute(input: { id: number; companyId: number }): Promise<{ deleted: true }> {
    await this.schedules.remove(input.id, input.companyId);
    return { deleted: true };
  }
}

export class ListScheduledReportsUseCase {
  constructor(private readonly schedules: ScheduledReportRepository) {}

  async execute(input: {
    companyId: number;
    reportId?: number;
  }): Promise<ReadonlyArray<ScheduledReport>> {
    return this.schedules.listByCompany(input.companyId, input.reportId);
  }
}
