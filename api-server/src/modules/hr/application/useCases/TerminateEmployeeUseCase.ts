/**
 * TerminateEmployeeUseCase — Employee'yi işten ayırır (status=terminated).
 *
 * terminationDate opsiyonel — verilmezse clock.now() kullanılır.
 * Zaten terminated ise EmployeeAlreadyTerminatedError fırlatır.
 */
import { toEmployeeDto, type EmployeeDto } from '../dto/EmployeeDto.js';
import { EmployeeAlreadyTerminatedError, EmployeeNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';

export interface TerminateEmployeeInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  employeeId: number;
  /** Verilmezse clock.now() kullanılır. */
  terminationDate?: Date | string;
  reason?: string;
}

export class TerminateEmployeeUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: TerminateEmployeeInput): Promise<EmployeeDto> {
    const emp = await this.employees.findById(input.employeeId, input.companyId);
    if (!emp) {
      throw new EmployeeNotFoundError(input.employeeId);
    }
    if (emp.status === 'terminated') {
      throw new EmployeeAlreadyTerminatedError(emp.id);
    }

    const now = this.clock.now();
    const termDate =
      input.terminationDate === undefined
        ? null
        : input.terminationDate instanceof Date
          ? input.terminationDate
          : new Date(input.terminationDate);

    const terminated = emp.terminate(now, termDate);
    await this.employees.update(terminated);

    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.employee.terminated',
      details: {
        id: emp.id,
        fullName: emp.fullName,
        terminationDate: terminated.terminationDate?.toISOString(),
        reason: input.reason ?? null,
      },
    });

    return toEmployeeDto(terminated);
  }
}
