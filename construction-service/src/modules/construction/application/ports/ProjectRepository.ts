/**
 * ProjectRepository — proje kalıcılık portu.
 * Concrete: infrastructure/persistence/PgProjectRepository.ts
 */
import type { Project } from '../../domain/entities/Project.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { ProjectStatus, ProjectType } from '../../domain/valueObjects/ProjectStatus.js';

export interface NewProjectInput {
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
  createdBy: number | null;
}

export interface ListProjectsOptions {
  includeInactive?: boolean;
  status?: ProjectStatus;
  projectType?: ProjectType;
  search?: string;
}

export interface ProjectRepository {
  insert(input: NewProjectInput): Promise<Project>;
  update(project: Project): Promise<void>;
  findById(id: number, companyId: number): Promise<Project | null>;
  listByCompany(companyId: number, options?: ListProjectsOptions): Promise<ReadonlyArray<Project>>;
  existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean>;
}
