/**
 * İş Gücü & Makine kalıcılık portları: personel, puantaj, makine, makine logu.
 */
import type { Machine } from '../../domain/entities/Machine.js';
import type { MachineLog } from '../../domain/entities/MachineLog.js';
import type { Personnel } from '../../domain/entities/Personnel.js';
import type { Timesheet } from '../../domain/entities/Timesheet.js';
import type { MachineKind } from '../../domain/valueObjects/Labor.js';

export interface NewPersonnelInput {
  companyId: number;
  projectId: number;
  employeeId: number | null;
  vendorId: number | null;
  fullName: string;
  trade: string | null;
  dailyCost: number;
  isSubcontractor: boolean;
  createdBy: number | null;
}
export interface PersonnelRepository {
  insert(input: NewPersonnelInput): Promise<Personnel>;
  update(p: Personnel): Promise<void>;
  findById(id: number, companyId: number): Promise<Personnel | null>;
  listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Personnel>>;
}

export interface NewTimesheetInput {
  companyId: number;
  personnelId: number;
  workDate: string;
  hours: number;
  overtime: number;
  statusCode: string;
  boqLineId: number | null;
  createdBy: number | null;
}
export interface TimesheetRepository {
  /** personnel_id + work_date çakışmasında upsert. */
  upsert(input: NewTimesheetInput): Promise<Timesheet>;
  delete(id: number, companyId: number): Promise<boolean>;
  listByProject(
    projectId: number,
    companyId: number,
    fromDate?: string,
    toDate?: string,
  ): Promise<ReadonlyArray<Timesheet>>;
}

export interface NewMachineInput {
  companyId: number;
  code: string;
  name: string;
  kind: MachineKind;
  vendorId: number | null;
  hourlyCost: number;
  createdBy: number | null;
}
export interface MachineRepository {
  insert(input: NewMachineInput): Promise<Machine>;
  update(m: Machine): Promise<void>;
  findById(id: number, companyId: number): Promise<Machine | null>;
  listByCompany(companyId: number, includeInactive?: boolean): Promise<ReadonlyArray<Machine>>;
  existsByCode(companyId: number, code: string): Promise<boolean>;
}

export interface NewMachineLogInput {
  companyId: number;
  machineId: number;
  projectId: number;
  logDate: string;
  workHours: number;
  fuelLiters: number;
  fuelCost: number;
  maintCost: number;
  boqLineId: number | null;
  note: string | null;
  createdBy: number | null;
}
export interface MachineLogRepository {
  insert(input: NewMachineLogInput): Promise<MachineLog>;
  delete(id: number, companyId: number): Promise<boolean>;
  listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<MachineLog>>;
}

export interface LaborCostTotals {
  laborCost: number;
  machineWorkCost: number;
  fuelCost: number;
  maintCost: number;
}
export interface LaborCostRepository {
  /** Proje işçilik (puantaj×yevmiye faktörü) + makine (saat×saat ücreti) + yakıt + bakım toplamı. */
  costSummary(projectId: number, companyId: number): Promise<LaborCostTotals>;
}
