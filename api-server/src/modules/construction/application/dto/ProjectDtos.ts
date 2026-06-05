/**
 * Project DTO'ları — REST sınırında kullanılan düz tipler.
 */
import type { Project } from '../../domain/entities/Project.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { ProjectStatus, ProjectType } from '../../domain/valueObjects/ProjectStatus.js';

export interface ProjectDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  projectType: ProjectType;
  status: ProjectStatus;
  orgUnitId: number | null;
  managerUserId: number | null;
  location: string | null;
  startDate: string | null;
  plannedEnd: string | null;
  budgetAmount: number;
  currency: CurrencyCode;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toProjectDto(p: Project): ProjectDto {
  const j = p.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    code: j.code,
    name: j.name,
    projectType: j.projectType,
    status: j.status,
    orgUnitId: j.orgUnitId,
    managerUserId: j.managerUserId,
    location: j.location,
    startDate: j.startDate,
    plannedEnd: j.plannedEnd,
    budgetAmount: j.budgetAmount,
    currency: j.currency,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}
