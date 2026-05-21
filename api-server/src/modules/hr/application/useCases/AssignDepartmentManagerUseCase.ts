/**
 * AssignDepartmentManagerUseCase — bir Department'e manager atar (Employee FK).
 * employeeId = null verirse mevcut manager bağını koparır.
 */
import { toDepartmentDto, type DepartmentDto } from '../dto/DepartmentDto.js';
import { DepartmentNotFoundError, EmployeeNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';

export interface AssignDepartmentManagerInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  departmentId: number;
  /** null → mevcut manager bağını kopar. */
  employeeId: number | null;
}

export class AssignDepartmentManagerUseCase {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: AssignDepartmentManagerInput): Promise<DepartmentDto> {
    const dept = await this.departments.findById(input.departmentId, input.companyId);
    if (!dept) {
      throw new DepartmentNotFoundError(input.departmentId);
    }

    if (input.employeeId !== null) {
      const emp = await this.employees.findById(input.employeeId, input.companyId);
      if (!emp) {
        throw new EmployeeNotFoundError(input.employeeId);
      }
      // Manager Employee aynı şirkete + aktif olmalı; terminated manager olamaz
      if (emp.status === 'terminated') {
        throw new Error(`Employee (id=${emp.id}) terminated — manager olarak atanamaz`);
      }
    }

    const updated = dept.assignManager(input.employeeId, this.clock.now());
    if (updated === dept) {
      return toDepartmentDto(dept);
    }
    await this.departments.update(updated);

    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.department.manager_assigned',
      details: {
        departmentId: dept.id,
        from: dept.managerEmployeeId,
        to: input.employeeId,
      },
    });

    return toDepartmentDto(updated);
  }
}
