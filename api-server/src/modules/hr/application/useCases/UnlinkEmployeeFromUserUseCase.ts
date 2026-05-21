/**
 * UnlinkEmployeeFromUserUseCase — Employee'nin User bağını koparır.
 * Zaten bağlı değilse no-op (DTO döner).
 */
import { toEmployeeDto, type EmployeeDto } from '../dto/EmployeeDto.js';
import { EmployeeNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';

export interface UnlinkEmployeeFromUserInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  employeeId: number;
}

export class UnlinkEmployeeFromUserUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: UnlinkEmployeeFromUserInput): Promise<EmployeeDto> {
    const emp = await this.employees.findById(input.employeeId, input.companyId);
    if (!emp) {
      throw new EmployeeNotFoundError(input.employeeId);
    }

    const previousUserId = emp.userId;
    const unlinked = emp.unlinkUser(this.clock.now());
    if (unlinked === emp) {
      return toEmployeeDto(emp);
    }

    await this.employees.update(unlinked);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.employee.user_unlinked',
      details: { employeeId: emp.id, previousUserId },
    });

    return toEmployeeDto(unlinked);
  }
}
