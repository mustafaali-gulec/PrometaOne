/**
 * CreateDepartmentUseCase — yeni bir Department oluşturur.
 *
 * Manager opsiyonel — başta NULL olabilir, sonradan AssignDepartmentManagerUseCase
 * ile atanabilir (ADR-0005 ↔ chicken-egg sebebi).
 */
import { DepartmentCode } from '../../domain/valueObjects/DepartmentCode.js';
import { toDepartmentDto, type DepartmentDto } from '../dto/DepartmentDto.js';
import { OrgUnitCompanyMismatchError, OrgUnitNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';
import type { OrgUnitRepository } from '../ports/OrgUnitRepository.js';

export interface CreateDepartmentInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  orgUnitId: number | null;
  name: string;
  code: string | null;
}

export class CreateDepartmentUseCase {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly orgUnits: OrgUnitRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: CreateDepartmentInput): Promise<DepartmentDto> {
    if (input.orgUnitId !== null) {
      const ou = await this.orgUnits.findById(input.orgUnitId, input.companyId);
      if (!ou) {
        throw new OrgUnitNotFoundError(input.orgUnitId);
      }
      if (ou.companyId !== input.companyId) {
        throw new OrgUnitCompanyMismatchError(input.orgUnitId, input.companyId);
      }
    }

    if (input.code !== null) {
      DepartmentCode.create(input.code); // validate
    }

    const created = await this.departments.insert({
      companyId: input.companyId,
      orgUnitId: input.orgUnitId,
      name: input.name,
      code: input.code,
      managerEmployeeId: null,
      active: true,
    });

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.department.created',
      details: { id: created.id, name: created.name, orgUnitId: created.orgUnitId },
    });

    return toDepartmentDto(created);
  }
}
