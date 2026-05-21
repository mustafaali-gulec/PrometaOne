/**
 * DepartmentDto — REST response için.
 */
import type { Department } from '../../domain/entities/Department.js';

export interface DepartmentDto {
  id: number;
  companyId: number;
  orgUnitId: number | null;
  name: string;
  code: string | null;
  managerEmployeeId: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toDepartmentDto(d: Department): DepartmentDto {
  return {
    id: d.id,
    companyId: d.companyId,
    orgUnitId: d.orgUnitId,
    name: d.name,
    code: d.code?.value ?? null,
    managerEmployeeId: d.managerEmployeeId,
    active: d.active,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}
