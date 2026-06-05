/**
 * Proje use-case'leri.
 *
 * CreateProject kod verilmezse `PRJ-NNN` formatında sıradaki kodu üretir.
 * Durum geçişi domain'de (Project.changeStatus) doğrulanır.
 */
import {
  DuplicateProjectCodeError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import { round2 } from '../../domain/valueObjects/Currency.js';
import type { ProjectStatus, ProjectType } from '../../domain/valueObjects/ProjectStatus.js';
import { toProjectDto, type ProjectDto } from '../dto/ProjectDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { ListProjectsOptions, ProjectRepository } from '../ports/ProjectRepository.js';

const CODE_PREFIX = 'PRJ';

async function nextProjectCode(projects: ProjectRepository, companyId: number): Promise<string> {
  const existing = await projects.listByCompany(companyId, { includeInactive: true });
  let max = 0;
  for (const p of existing) {
    const m = /^PRJ-0*(\d+)$/i.exec(p.code);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${CODE_PREFIX}-${String(max + 1).padStart(3, '0')}`;
}

export interface CreateProjectInput {
  companyId: number;
  name: string;
  code?: string | undefined;
  projectType?: ProjectType | undefined;
  orgUnitId?: number | null | undefined;
  managerUserId?: number | null | undefined;
  location?: string | null | undefined;
  startDate?: string | null | undefined;
  plannedEnd?: string | null | undefined;
  budgetAmount?: number | undefined;
  currency?: CurrencyCode | undefined;
  createdBy?: number | null | undefined;
}

export class CreateProjectUseCase {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(input: CreateProjectInput): Promise<ProjectDto> {
    const code = input.code?.trim() || (await nextProjectCode(this.projects, input.companyId));

    if (await this.projects.existsByCode(input.companyId, code)) {
      throw new DuplicateProjectCodeError(code);
    }

    const created = await this.projects.insert({
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      projectType: input.projectType ?? 'private',
      status: 'planning',
      orgUnitId: input.orgUnitId ?? null,
      managerUserId: input.managerUserId ?? null,
      location: input.location?.trim() || null,
      startDate: input.startDate ?? null,
      plannedEnd: input.plannedEnd ?? null,
      budgetAmount: round2(input.budgetAmount ?? 0),
      currency: input.currency ?? 'TRY',
      createdBy: input.createdBy ?? null,
    });
    return toProjectDto(created);
  }
}

export interface ListProjectsInput {
  companyId: number;
  includeInactive?: boolean;
  status?: ProjectStatus;
  projectType?: ProjectType;
  search?: string;
}

export class ListProjectsUseCase {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(input: ListProjectsInput): Promise<ProjectDto[]> {
    const options: ListProjectsOptions = {};
    if (input.includeInactive !== undefined) options.includeInactive = input.includeInactive;
    if (input.status !== undefined) options.status = input.status;
    if (input.projectType !== undefined) options.projectType = input.projectType;
    if (input.search !== undefined) options.search = input.search;
    const list = await this.projects.listByCompany(input.companyId, options);
    return list.map(toProjectDto);
  }
}

export interface UpdateProjectInput {
  companyId: number;
  projectId: number;
  name?: string | undefined;
  projectType?: ProjectType | undefined;
  orgUnitId?: number | null | undefined;
  managerUserId?: number | null | undefined;
  location?: string | null | undefined;
  startDate?: string | null | undefined;
  plannedEnd?: string | null | undefined;
  budgetAmount?: number | undefined;
  currency?: CurrencyCode | undefined;
}

export class UpdateProjectUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateProjectInput): Promise<ProjectDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const updated = project.update(
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.projectType !== undefined ? { projectType: input.projectType } : {}),
        ...(input.orgUnitId !== undefined ? { orgUnitId: input.orgUnitId } : {}),
        ...(input.managerUserId !== undefined ? { managerUserId: input.managerUserId } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.plannedEnd !== undefined ? { plannedEnd: input.plannedEnd } : {}),
        ...(input.budgetAmount !== undefined ? { budgetAmount: round2(input.budgetAmount) } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
      },
      this.clock.now(),
    );
    await this.projects.update(updated);
    return toProjectDto(updated);
  }
}

export interface ChangeProjectStatusInput {
  companyId: number;
  projectId: number;
  status: ProjectStatus;
}

export class ChangeProjectStatusUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ChangeProjectStatusInput): Promise<ProjectDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const updated = project.changeStatus(input.status, this.clock.now());
    await this.projects.update(updated);
    return toProjectDto(updated);
  }
}

export interface DeactivateProjectInput {
  companyId: number;
  projectId: number;
}

export class DeactivateProjectUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeactivateProjectInput): Promise<ProjectDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const deactivated = project.deactivate(this.clock.now());
    await this.projects.update(deactivated);
    return toProjectDto(deactivated);
  }
}
