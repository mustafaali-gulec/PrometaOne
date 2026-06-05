/**
 * Construction modülü test fake'leri — in-memory repository'ler + sabit Clock.
 */
import type { Clock } from '../application/ports/Clock.js';
import type {
  ContractRepository,
  ListContractsOptions,
  NewContractInput,
} from '../application/ports/ContractRepository.js';
import type {
  ListProjectsOptions,
  NewProjectInput,
  ProjectRepository,
} from '../application/ports/ProjectRepository.js';
import { Contract } from '../domain/entities/Contract.js';
import { Project } from '../domain/entities/Project.js';

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
}

export class InMemoryProjectRepository implements ProjectRepository {
  private items: Project[] = [];
  private seq = 0;

  async insert(input: NewProjectInput): Promise<Project> {
    this.seq += 1;
    const now = new Date('2026-06-06T00:00:00.000Z');
    const project = Project.create({
      id: this.seq,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      projectType: input.projectType,
      status: input.status,
      orgUnitId: input.orgUnitId,
      managerUserId: input.managerUserId,
      location: input.location,
      startDate: input.startDate,
      plannedEnd: input.plannedEnd,
      budgetAmount: input.budgetAmount,
      currency: input.currency,
      active: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    this.items.push(project);
    return project;
  }

  async update(project: Project): Promise<void> {
    const idx = this.items.findIndex(
      (p) => p.id === project.id && p.companyId === project.companyId,
    );
    if (idx >= 0) this.items[idx] = project;
  }

  async findById(id: number, companyId: number): Promise<Project | null> {
    return this.items.find((p) => p.id === id && p.companyId === companyId) ?? null;
  }

  async listByCompany(
    companyId: number,
    options?: ListProjectsOptions,
  ): Promise<ReadonlyArray<Project>> {
    return this.items.filter((p) => {
      if (p.companyId !== companyId) return false;
      if (options?.includeInactive !== true && !p.active) return false;
      if (options?.status && p.status !== options.status) return false;
      if (options?.projectType && p.projectType !== options.projectType) return false;
      return true;
    });
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    return this.items.some(
      (p) => p.companyId === companyId && p.code === code && p.id !== excludeId,
    );
  }
}

export class InMemoryContractRepository implements ContractRepository {
  private items: Contract[] = [];
  private seq = 0;

  async insert(input: NewContractInput): Promise<Contract> {
    this.seq += 1;
    const now = new Date('2026-06-06T00:00:00.000Z');
    const contract = Contract.create({
      id: this.seq,
      companyId: input.companyId,
      projectId: input.projectId,
      partyKind: input.partyKind,
      vendorId: input.vendorId,
      contractNo: input.contractNo,
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      signDate: input.signDate,
      startDate: input.startDate,
      endDate: input.endDate,
      retentionPct: input.retentionPct,
      advancePct: input.advancePct,
      priceDiffOn: input.priceDiffOn,
      tender: input.tender,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    this.items.push(contract);
    return contract;
  }

  async update(contract: Contract): Promise<void> {
    const idx = this.items.findIndex(
      (c) => c.id === contract.id && c.companyId === contract.companyId,
    );
    if (idx >= 0) this.items[idx] = contract;
  }

  async findById(id: number, companyId: number): Promise<Contract | null> {
    return this.items.find((c) => c.id === id && c.companyId === companyId) ?? null;
  }

  async listByCompany(
    companyId: number,
    options?: ListContractsOptions,
  ): Promise<ReadonlyArray<Contract>> {
    return this.items.filter((c) => {
      if (c.companyId !== companyId) return false;
      if (options?.projectId !== undefined && c.projectId !== options.projectId) return false;
      if (options?.partyKind && c.partyKind !== options.partyKind) return false;
      return true;
    });
  }

  async existsByNo(companyId: number, contractNo: string, excludeId?: number): Promise<boolean> {
    return this.items.some(
      (c) => c.companyId === companyId && c.contractNo === contractNo && c.id !== excludeId,
    );
  }
}
