/**
 * ListPayrollRunsUseCase — bordro koşuları listesi
 * (filter: year, status).
 */
import type { PayrollRunStatus } from '../../domain/valueObjects/PayrollRunStatus.js';
import { toPayrollRunDto, type PayrollRunDto } from '../dto/PayrollRunDto.js';
import type { PayrollRunRepository } from '../ports/PayrollRunRepository.js';

export interface ListPayrollRunsInput {
  companyId: number;
  year?: number;
  status?: PayrollRunStatus;
}

export class ListPayrollRunsUseCase {
  constructor(private readonly payroll: PayrollRunRepository) {}

  async execute(input: ListPayrollRunsInput): Promise<ReadonlyArray<PayrollRunDto>> {
    const filter: { companyId: number; year?: number; status?: PayrollRunStatus } = {
      companyId: input.companyId,
    };
    if (input.year !== undefined) filter.year = input.year;
    if (input.status !== undefined) filter.status = input.status;
    const list = await this.payroll.listRuns(filter);
    return list.map(toPayrollRunDto);
  }
}
