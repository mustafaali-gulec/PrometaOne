/**
 * FinalizePayrollRunUseCase — bordro koşusunu kesinleştirir (draft → finalized).
 *
 * Yasak geçişte PayrollRun entity InvalidPayrollRunTransitionError fırlatır
 * (örn. zaten finalized).
 */
import { toPayrollRunDto, type PayrollRunDto } from '../dto/PayrollRunDto.js';
import { PayrollRunNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { PayrollRunRepository } from '../ports/PayrollRunRepository.js';

export interface FinalizePayrollRunInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  payrollRunId: number;
}

export class FinalizePayrollRunUseCase {
  constructor(
    private readonly payroll: PayrollRunRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: FinalizePayrollRunInput): Promise<PayrollRunDto> {
    const existing = await this.payroll.findRunById(input.payrollRunId, input.companyId);
    if (!existing) {
      throw new PayrollRunNotFoundError(input.payrollRunId);
    }

    const finalized = existing.finalize(this.clock.now(), input.actorUserId);
    await this.payroll.updateRun(finalized);

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.payroll.run_finalized',
      details: {
        id: existing.id,
        periodYear: existing.periodYear,
        periodMonth: existing.periodMonth,
      },
    });

    return toPayrollRunDto(finalized);
  }
}
