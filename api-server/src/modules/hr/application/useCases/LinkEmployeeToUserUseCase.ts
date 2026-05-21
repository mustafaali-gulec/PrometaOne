/**
 * LinkEmployeeToUserUseCase — Employee'yi bir User'a bağlar.
 *
 * Kurallar (ADR-0005):
 *   - User var olmalı + aktif olmalı (UserLookupPort ile doğrula)
 *   - Employee zaten başka User'a bağlıysa EmployeeAlreadyLinkedError
 *   - User başka Employee'ye bağlıysa UserAlreadyLinkedToEmployeeError
 */
import { toEmployeeDto, type EmployeeDto } from '../dto/EmployeeDto.js';
import {
  EmployeeAlreadyLinkedError,
  EmployeeNotFoundError,
  UserAlreadyLinkedToEmployeeError,
  UserNotFoundForLinkError,
} from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';
import type { UserLookupPort } from '../ports/UserLookupPort.js';

export interface LinkEmployeeToUserInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  employeeId: number;
  userId: number;
}

export class LinkEmployeeToUserUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly users: UserLookupPort,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: LinkEmployeeToUserInput): Promise<EmployeeDto> {
    const emp = await this.employees.findById(input.employeeId, input.companyId);
    if (!emp) {
      throw new EmployeeNotFoundError(input.employeeId);
    }
    if (emp.userId !== null) {
      throw new EmployeeAlreadyLinkedError(emp.id, emp.userId);
    }

    const u = await this.users.findById(input.userId);
    if (!u || !u.active) {
      throw new UserNotFoundForLinkError(input.userId);
    }

    const existingLink = await this.employees.findByUserId(input.userId, input.companyId);
    if (existingLink) {
      throw new UserAlreadyLinkedToEmployeeError(input.userId, existingLink.id);
    }

    const linked = emp.linkUser(input.userId, this.clock.now());
    await this.employees.update(linked);

    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.employee.user_linked',
      details: { employeeId: emp.id, userId: input.userId },
    });

    return toEmployeeDto(linked);
  }
}
