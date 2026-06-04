/**
 * GetPayrollRunUseCase — bir bordro koşusunu satırlarıyla (slip verisi) döner.
 *
 * { run, items } — items her çalışanın brüt/kesinti/net kırılımı.
 */
import {
  toPayrollItemDto,
  toPayrollRunDto,
  type PayrollItemDto,
  type PayrollRunDto,
} from '../dto/PayrollRunDto.js';
import { PayrollRunNotFoundError } from '../errors/HrErrors.js';
import type { PayrollRunRepository } from '../ports/PayrollRunRepository.js';

export interface GetPayrollRunInput {
  companyId: number;
  payrollRunId: number;
}

export interface GetPayrollRunResult {
  run: PayrollRunDto;
  items: ReadonlyArray<PayrollItemDto>;
}

export class GetPayrollRunUseCase {
  constructor(private readonly payroll: PayrollRunRepository) {}

  async execute(input: GetPayrollRunInput): Promise<GetPayrollRunResult> {
    const run = await this.payroll.findRunById(input.payrollRunId, input.companyId);
    if (!run) {
      throw new PayrollRunNotFoundError(input.payrollRunId);
    }
    const items = await this.payroll.listItemsForRun(run.id, input.companyId);
    return { run: toPayrollRunDto(run), items: items.map(toPayrollItemDto) };
  }
}
