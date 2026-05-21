/**
 * PositionDto — REST response için.
 */
import type { Position } from '../../domain/entities/Position.js';
import type { PositionStatus } from '../../domain/valueObjects/PositionStatus.js';

export interface PositionDto {
  id: number;
  companyId: number;
  departmentId: number | null;
  title: string;
  description: string | null;
  status: PositionStatus;
  headcountTarget: number;
  minSalary: number | null;
  maxSalary: number | null;
  createdAt: string;
  updatedAt: string;
}

export function toPositionDto(p: Position): PositionDto {
  return {
    id: p.id,
    companyId: p.companyId,
    departmentId: p.departmentId,
    title: p.title,
    description: p.description,
    status: p.status,
    headcountTarget: p.headcountTarget,
    minSalary: p.minSalary,
    maxSalary: p.maxSalary,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
