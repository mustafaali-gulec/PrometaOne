/**
 * CreatePayrollRunUseCase — yeni bordro koşusu oluşturur (status 'draft').
 *
 * Şirket + dönem (yıl/ay) başına tek koşu — duplicate ise
 * PayrollRunPeriodAlreadyExistsError fırlatır.
 */
import { toPayrollRunDto, type PayrollRunDto } from '../dto/PayrollRunDto.js';
import { PayrollRunPeriodAlreadyExistsError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { PayrollRunRepository } from '../ports/PayrollRunRepository.js';

export interface CreatePayrollRunInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  periodYear: number;
  periodMonth: number;
  note?: string | null;
}

export class CreatePayrollRunUseCase {
  constructor(
    private readonly payroll: PayrollRunRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: CreatePayrollRunInput): Promise<PayrollRunDto> {
    const existing = await this.payroll.findRunByPeriod(
      input.companyId,
      input.periodYear,
      input.periodMonth,
    );
    if (existing) {
      throw new PayrollRunPeriodAlreadyExistsError(
        input.companyId,
        input.periodYear,
        input.periodMonth,
      );
    }

    const created = await this.payroll.createRun({
      companyId: input.companyId,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      status: 'draft',
      note: input.note ?? null,
    });

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.payroll.run_created',
      details: {
        id: created.id,
        periodYear: created.periodYear,
        periodMonth: created.periodMonth,
      },
    });

    return toPayrollRunDto(created);
  }
}
