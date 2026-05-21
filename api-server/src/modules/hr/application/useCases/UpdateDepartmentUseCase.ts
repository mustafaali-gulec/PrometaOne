/**
 * UpdateDepartmentUseCase — Department'in name/code/orgUnitId alanlarını günceller.
 * Manager değişimi AssignDepartmentManagerUseCase'de.
 */
import { Department } from '../../domain/entities/Department.js';
import { DepartmentCode } from '../../domain/valueObjects/DepartmentCode.js';
import { toDepartmentDto, type DepartmentDto } from '../dto/DepartmentDto.js';
import { DepartmentNotFoundError, OrgUnitNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';
import type { OrgUnitRepository } from '../ports/OrgUnitRepository.js';

export interface UpdateDepartmentInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
  name?: string;
  code?: string | null;
  orgUnitId?: number | null;
}

export class UpdateDepartmentUseCase {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly orgUnits: OrgUnitRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: UpdateDepartmentInput): Promise<DepartmentDto> {
    const existing = await this.departments.findById(input.id, input.companyId);
    if (!existing) {
      throw new DepartmentNotFoundError(input.id);
    }

    let updated = existing;
    const now = this.clock.now();
    const changes: Record<string, unknown> = {};

    if (input.name !== undefined && input.name.trim() !== existing.name) {
      updated = updated.rename(input.name, now);
      changes.name = { from: existing.name, to: updated.name };
    }

    if (input.orgUnitId !== undefined && input.orgUnitId !== existing.orgUnitId) {
      if (input.orgUnitId !== null) {
        const ou = await this.orgUnits.findById(input.orgUnitId, input.companyId);
        if (!ou) {
          throw new OrgUnitNotFoundError(input.orgUnitId);
        }
      }
      updated = updated.assignToOrgUnit(input.orgUnitId, now);
      changes.orgUnitId = { from: existing.orgUnitId, to: input.orgUnitId };
    }

    if (input.code !== undefined) {
      const newCode = input.code === null ? null : DepartmentCode.create(input.code);
      const currentCodeValue = existing.code?.value ?? null;
      const newCodeValue = newCode?.value ?? null;
      if (newCodeValue !== currentCodeValue) {
        updated = Department.create({
          ...updated.toJSON(),
          code: newCode,
          updatedAt: now,
        });
        changes.code = { from: currentCodeValue, to: newCodeValue };
      }
    }

    if (updated === existing) {
      return toDepartmentDto(existing);
    }

    await this.departments.update(updated);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.department.updated',
      details: { id: updated.id, changes },
    });

    return toDepartmentDto(updated);
  }
}
