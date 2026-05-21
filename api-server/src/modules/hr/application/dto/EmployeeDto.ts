/**
 * EmployeeDto — REST response için.
 */
import type { Employee } from '../../domain/entities/Employee.js';
import type { EmployeeStatus } from '../../domain/valueObjects/EmployeeStatus.js';
import type { EmploymentType } from '../../domain/valueObjects/EmploymentType.js';

export interface EmployeeDto {
  id: number;
  companyId: number;
  userId: number | null;
  departmentId: number;
  positionId: number | null;
  employeeNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  tcKimlik: string | null;
  email: string | null;
  /** Normalize edilmiş +90XXXXXXXXXX formatında. */
  phone: string | null;
  /** YYYY-MM-DD. */
  hireDate: string;
  /** YYYY-MM-DD veya null. */
  terminationDate: string | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  sourceApplicationId: number | null;
  createdAt: string;
  updatedAt: string;
}

export function toEmployeeDto(e: Employee): EmployeeDto {
  return {
    id: e.id,
    companyId: e.companyId,
    userId: e.userId,
    departmentId: e.departmentId,
    positionId: e.positionId,
    employeeNo: e.employeeNo.value,
    firstName: e.firstName,
    lastName: e.lastName,
    fullName: e.fullName,
    tcKimlik: e.tcKimlik?.value ?? null,
    email: e.email,
    phone: e.phone?.value ?? null,
    hireDate: e.hireDate.toISOString(),
    terminationDate: e.terminationDate ? e.terminationDate.toISOString().slice(0, 10) : null,
    status: e.status,
    employmentType: e.employmentType,
    sourceApplicationId: e.sourceApplicationId,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}
