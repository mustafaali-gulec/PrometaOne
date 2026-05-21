/**
 * ArchiveDepartmentUseCase — Department'i arşivler (active=false).
 * Aktif çalışan varsa DepartmentHasActiveEmployeesError fırlatır.
 */
import { toDepartmentDto, type DepartmentDto } from '../dto/DepartmentDto.js';
import { DepartmentHasActiveEmployeesError, DepartmentNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';

export interface ArchiveDepartmentInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
}

export class ArchiveDepartmentUseCase {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: ArchiveDepartmentInput): Promise<DepartmentDto> {
    const existing = await this.departments.findById(input.id, input.companyId);
    if (!existing) {
      throw new DepartmentNotFoundError(input.id);
    }

    const hasActive = await this.departments.hasActiveEmployees(existing.id, input.companyId);
    if (hasActive) {
      throw new DepartmentHasActiveEmployeesError(existing.id);
    }

    const archived = existing.archive(this.clock.now());
    if (archived === existing) {
      return toDepartmentDto(existing);
    }

    await this.departments.update(archived);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.department.archived',
      details: { id: existing.id, name: existing.name },
    });

    return toDepartmentDto(archived);
  }
}
