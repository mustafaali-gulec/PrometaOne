/**
 * ListEmployeesUseCase — Employee listesi (filter: status, departmentId, positionId, q).
 */
import type { EmployeeStatus } from '../../domain/valueObjects/EmployeeStatus.js';
import { toEmployeeDto, type EmployeeDto } from '../dto/EmployeeDto.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';

export interface ListEmployeesInput {
  companyId: number;
  status?: EmployeeStatus;
  departmentId?: number;
  positionId?: number;
  /** İsim/soyisim/employee_no üzerinde arar. */
  q?: string;
}

export class ListEmployeesUseCase {
  constructor(private readonly employees: EmployeeRepository) {}

  async execute(input: ListEmployeesInput): Promise<ReadonlyArray<EmployeeDto>> {
    const opts: {
      status?: EmployeeStatus;
      departmentId?: number;
      positionId?: number;
      q?: string;
    } = {};
    if (input.status !== undefined) opts.status = input.status;
    if (input.departmentId !== undefined) opts.departmentId = input.departmentId;
    if (input.positionId !== undefined) opts.positionId = input.positionId;
    if (input.q !== undefined) opts.q = input.q;
    const list = await this.employees.listByCompany(input.companyId, opts);
    return list.map(toEmployeeDto);
  }
}
