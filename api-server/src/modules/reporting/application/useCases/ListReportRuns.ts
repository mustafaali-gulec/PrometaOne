/**
 * ListReportRuns — çalıştırma denetim kayıtlarını (metadata) listeler.
 */
import type { ReportRun, ReportRunRepository } from '../ports/ReportRunRepository.js';

export class ListReportRunsUseCase {
  constructor(private readonly repo: ReportRunRepository) {}

  async execute(input: { companyId: number; limit?: number }): Promise<ReadonlyArray<ReportRun>> {
    return this.repo.listByCompany(input.companyId, input.limit ?? 100);
  }
}
