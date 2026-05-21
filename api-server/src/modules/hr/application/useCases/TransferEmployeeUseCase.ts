/**
 * TransferEmployeeUseCase — Employee'yi başka departman/pozisyona aktarır.
 *
 * Validasyonlar:
 *   - Hedef departman aynı şirkette ve aktif olmalı
 *   - Hedef pozisyon varsa aynı şirkette olmalı (kapalı olsa bile transfer OK —
 *     kapatma yeni başvuru almaz, mevcut çalışanları engellemez)
 *   - terminated çalışan transfer edilemez
 */
import { toEmployeeDto, type EmployeeDto } from '../dto/EmployeeDto.js';
import {
  DepartmentNotFoundError,
  EmployeeNotFoundError,
  PositionNotFoundError,
} from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';
import type { PositionRepository } from '../ports/PositionRepository.js';

export interface TransferEmployeeInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  employeeId: number;
  newDepartmentId: number;
  newPositionId: number | null;
}

export class TransferEmployeeUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly departments: DepartmentRepository,
    private readonly positions: PositionRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: TransferEmployeeInput): Promise<EmployeeDto> {
    const emp = await this.employees.findById(input.employeeId, input.companyId);
    if (!emp) {
      throw new EmployeeNotFoundError(input.employeeId);
    }
    if (emp.status === 'terminated') {
      throw new Error(`Employee (id=${emp.id}) terminated — transfer edilemez`);
    }

    const dept = await this.departments.findById(input.newDepartmentId, input.companyId);
    if (!dept) {
      throw new DepartmentNotFoundError(input.newDepartmentId);
    }

    if (input.newPositionId !== null) {
      const pos = await this.positions.findById(input.newPositionId, input.companyId);
      if (!pos) {
        throw new PositionNotFoundError(input.newPositionId);
      }
    }

    const transferred = emp.transferTo(
      input.newDepartmentId,
      input.newPositionId,
      this.clock.now(),
    );
    if (transferred === emp) {
      return toEmployeeDto(emp);
    }

    await this.employees.update(transferred);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.employee.transferred',
      details: {
        id: emp.id,
        fromDepartmentId: emp.departmentId,
        toDepartmentId: input.newDepartmentId,
        fromPositionId: emp.positionId,
        toPositionId: input.newPositionId,
      },
    });

    return toEmployeeDto(transferred);
  }
}
