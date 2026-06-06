/**
 * İş Gücü & Makine use-case'leri: personel, puantaj (upsert), makine, makine
 * logu + proje işçilik/makine maliyet özeti. Tüm yazımlar proje/varlık doğrular.
 */
import {
  DuplicateMachineCodeError,
  MachineNotFoundError,
  PersonnelNotFoundError,
  ProjectNotFoundError,
  TimesheetNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import { round2 } from '../../domain/valueObjects/Currency.js';
import type { MachineKind } from '../../domain/valueObjects/Labor.js';
import {
  toMachineDto,
  toMachineLogDto,
  toPersonnelDto,
  toTimesheetDto,
  type LaborCostSummaryDto,
  type MachineDto,
  type MachineLogDto,
  type PersonnelDto,
  type TimesheetDto,
} from '../dto/LaborDtos.js';
import type { Clock } from '../ports/Clock.js';
import type {
  LaborCostRepository,
  MachineLogRepository,
  MachineRepository,
  PersonnelRepository,
  TimesheetRepository,
} from '../ports/LaborRepositories.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';

// ===== PERSONNEL ============================================================
export interface CreatePersonnelInput {
  companyId: number;
  projectId: number;
  fullName: string;
  employeeId?: number | null | undefined;
  vendorId?: number | null | undefined;
  trade?: string | null | undefined;
  dailyCost?: number | undefined;
  isSubcontractor?: boolean | undefined;
  createdBy?: number | null | undefined;
}
export class CreatePersonnelUseCase {
  constructor(
    private readonly personnel: PersonnelRepository,
    private readonly projects: ProjectRepository,
  ) {}
  async execute(input: CreatePersonnelInput): Promise<PersonnelDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const created = await this.personnel.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      employeeId: input.employeeId ?? null,
      vendorId: input.vendorId ?? null,
      fullName: input.fullName.trim(),
      trade: input.trade?.trim() || null,
      dailyCost: round2(input.dailyCost ?? 0),
      isSubcontractor: input.isSubcontractor ?? false,
      createdBy: input.createdBy ?? null,
    });
    return toPersonnelDto(created);
  }
}
export class ListPersonnelUseCase {
  constructor(private readonly personnel: PersonnelRepository) {}
  async execute(input: { companyId: number; projectId: number }): Promise<PersonnelDto[]> {
    const list = await this.personnel.listByProject(input.projectId, input.companyId);
    return list.map(toPersonnelDto);
  }
}
export interface UpdatePersonnelInput {
  companyId: number;
  personnelId: number;
  fullName?: string | undefined;
  trade?: string | null | undefined;
  dailyCost?: number | undefined;
  vendorId?: number | null | undefined;
  isSubcontractor?: boolean | undefined;
}
export class UpdatePersonnelUseCase {
  constructor(
    private readonly personnel: PersonnelRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: UpdatePersonnelInput): Promise<PersonnelDto> {
    const p = await this.personnel.findById(input.personnelId, input.companyId);
    if (!p) throw new PersonnelNotFoundError(input.personnelId);
    const updated = p.update(
      {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.trade !== undefined ? { trade: input.trade } : {}),
        ...(input.dailyCost !== undefined ? { dailyCost: round2(input.dailyCost) } : {}),
        ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
        ...(input.isSubcontractor !== undefined ? { isSubcontractor: input.isSubcontractor } : {}),
      },
      this.clock.now(),
    );
    await this.personnel.update(updated);
    return toPersonnelDto(updated);
  }
}
export class DeactivatePersonnelUseCase {
  constructor(
    private readonly personnel: PersonnelRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: { companyId: number; personnelId: number }): Promise<PersonnelDto> {
    const p = await this.personnel.findById(input.personnelId, input.companyId);
    if (!p) throw new PersonnelNotFoundError(input.personnelId);
    const d = p.deactivate(this.clock.now());
    await this.personnel.update(d);
    return toPersonnelDto(d);
  }
}

// ===== TIMESHEETS ===========================================================
export interface SaveTimesheetInput {
  companyId: number;
  personnelId: number;
  workDate: string;
  hours?: number | undefined;
  overtime?: number | undefined;
  statusCode?: string | undefined;
  boqLineId?: number | null | undefined;
  createdBy?: number | null | undefined;
}
export class SaveTimesheetUseCase {
  constructor(
    private readonly timesheets: TimesheetRepository,
    private readonly personnel: PersonnelRepository,
  ) {}
  async execute(input: SaveTimesheetInput): Promise<TimesheetDto> {
    const p = await this.personnel.findById(input.personnelId, input.companyId);
    if (!p) throw new PersonnelNotFoundError(input.personnelId);
    const saved = await this.timesheets.upsert({
      companyId: input.companyId,
      personnelId: input.personnelId,
      workDate: input.workDate,
      hours: input.hours ?? 0,
      overtime: input.overtime ?? 0,
      statusCode: input.statusCode?.trim() || 'P',
      boqLineId: input.boqLineId ?? null,
      createdBy: input.createdBy ?? null,
    });
    return toTimesheetDto(saved);
  }
}
export class ListTimesheetsUseCase {
  constructor(private readonly timesheets: TimesheetRepository) {}
  async execute(input: {
    companyId: number;
    projectId: number;
    fromDate?: string;
    toDate?: string;
  }): Promise<TimesheetDto[]> {
    const list = await this.timesheets.listByProject(
      input.projectId,
      input.companyId,
      input.fromDate,
      input.toDate,
    );
    return list.map(toTimesheetDto);
  }
}
export class DeleteTimesheetUseCase {
  constructor(private readonly timesheets: TimesheetRepository) {}
  async execute(input: { companyId: number; timesheetId: number }): Promise<void> {
    const ok = await this.timesheets.delete(input.timesheetId, input.companyId);
    if (!ok) throw new TimesheetNotFoundError(input.timesheetId);
  }
}

// ===== MACHINES =============================================================
export interface CreateMachineInput {
  companyId: number;
  code: string;
  name: string;
  kind?: MachineKind | undefined;
  vendorId?: number | null | undefined;
  hourlyCost?: number | undefined;
  createdBy?: number | null | undefined;
}
export class CreateMachineUseCase {
  constructor(private readonly machines: MachineRepository) {}
  async execute(input: CreateMachineInput): Promise<MachineDto> {
    const code = input.code.trim();
    if (await this.machines.existsByCode(input.companyId, code)) {
      throw new DuplicateMachineCodeError(code);
    }
    const created = await this.machines.insert({
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      kind: input.kind ?? 'owned',
      vendorId: input.vendorId ?? null,
      hourlyCost: round2(input.hourlyCost ?? 0),
      createdBy: input.createdBy ?? null,
    });
    return toMachineDto(created);
  }
}
export class ListMachinesUseCase {
  constructor(private readonly machines: MachineRepository) {}
  async execute(input: { companyId: number; includeInactive?: boolean }): Promise<MachineDto[]> {
    const list = await this.machines.listByCompany(input.companyId, input.includeInactive);
    return list.map(toMachineDto);
  }
}
export interface UpdateMachineInput {
  companyId: number;
  machineId: number;
  name?: string | undefined;
  kind?: MachineKind | undefined;
  vendorId?: number | null | undefined;
  hourlyCost?: number | undefined;
}
export class UpdateMachineUseCase {
  constructor(
    private readonly machines: MachineRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: UpdateMachineInput): Promise<MachineDto> {
    const m = await this.machines.findById(input.machineId, input.companyId);
    if (!m) throw new MachineNotFoundError(input.machineId);
    const updated = m.update(
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
        ...(input.hourlyCost !== undefined ? { hourlyCost: round2(input.hourlyCost) } : {}),
      },
      this.clock.now(),
    );
    await this.machines.update(updated);
    return toMachineDto(updated);
  }
}

// ===== MACHINE LOGS =========================================================
export interface CreateMachineLogInput {
  companyId: number;
  machineId: number;
  projectId: number;
  logDate: string;
  workHours?: number | undefined;
  fuelLiters?: number | undefined;
  fuelCost?: number | undefined;
  maintCost?: number | undefined;
  boqLineId?: number | null | undefined;
  note?: string | null | undefined;
  createdBy?: number | null | undefined;
}
export class CreateMachineLogUseCase {
  constructor(
    private readonly logs: MachineLogRepository,
    private readonly machines: MachineRepository,
    private readonly projects: ProjectRepository,
  ) {}
  async execute(input: CreateMachineLogInput): Promise<MachineLogDto> {
    const machine = await this.machines.findById(input.machineId, input.companyId);
    if (!machine) throw new MachineNotFoundError(input.machineId);
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const created = await this.logs.insert({
      companyId: input.companyId,
      machineId: input.machineId,
      projectId: input.projectId,
      logDate: input.logDate,
      workHours: input.workHours ?? 0,
      fuelLiters: input.fuelLiters ?? 0,
      fuelCost: round2(input.fuelCost ?? 0),
      maintCost: round2(input.maintCost ?? 0),
      boqLineId: input.boqLineId ?? null,
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
    });
    return toMachineLogDto(created);
  }
}
export class ListMachineLogsUseCase {
  constructor(private readonly logs: MachineLogRepository) {}
  async execute(input: { companyId: number; projectId: number }): Promise<MachineLogDto[]> {
    const list = await this.logs.listByProject(input.projectId, input.companyId);
    return list.map(toMachineLogDto);
  }
}
export class DeleteMachineLogUseCase {
  constructor(private readonly logs: MachineLogRepository) {}
  async execute(input: { companyId: number; logId: number }): Promise<void> {
    await this.logs.delete(input.logId, input.companyId);
  }
}

// ===== COST SUMMARY =========================================================
export class GetLaborCostSummaryUseCase {
  constructor(
    private readonly cost: LaborCostRepository,
    private readonly projects: ProjectRepository,
  ) {}
  async execute(input: { companyId: number; projectId: number }): Promise<LaborCostSummaryDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const t = await this.cost.costSummary(input.projectId, input.companyId);
    return {
      projectId: input.projectId,
      laborCost: round2(t.laborCost),
      machineWorkCost: round2(t.machineWorkCost),
      fuelCost: round2(t.fuelCost),
      maintCost: round2(t.maintCost),
      total: round2(t.laborCost + t.machineWorkCost + t.fuelCost + t.maintCost),
    };
  }
}
