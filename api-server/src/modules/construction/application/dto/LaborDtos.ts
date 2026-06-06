/**
 * İş Gücü & Makine DTO'ları — personel, puantaj, makine, makine logu + maliyet özeti.
 */
import type { Machine } from '../../domain/entities/Machine.js';
import type { MachineLog } from '../../domain/entities/MachineLog.js';
import type { Personnel } from '../../domain/entities/Personnel.js';
import type { Timesheet } from '../../domain/entities/Timesheet.js';
import type { MachineKind } from '../../domain/valueObjects/Labor.js';

export interface PersonnelDto {
  id: number;
  companyId: number;
  projectId: number;
  employeeId: number | null;
  vendorId: number | null;
  fullName: string;
  trade: string | null;
  dailyCost: number;
  isSubcontractor: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetDto {
  id: number;
  personnelId: number;
  workDate: string;
  hours: number;
  overtime: number;
  statusCode: string;
  boqLineId: number | null;
}

export interface MachineDto {
  id: number;
  companyId: number;
  code: string;
  name: string;
  kind: MachineKind;
  vendorId: number | null;
  hourlyCost: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MachineLogDto {
  id: number;
  machineId: number;
  projectId: number;
  logDate: string;
  workHours: number;
  fuelLiters: number;
  fuelCost: number;
  maintCost: number;
  boqLineId: number | null;
  note: string | null;
}

export interface LaborCostSummaryDto {
  projectId: number;
  laborCost: number;
  machineWorkCost: number;
  fuelCost: number;
  maintCost: number;
  total: number;
}

export function toPersonnelDto(p: Personnel): PersonnelDto {
  const j = p.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    employeeId: j.employeeId,
    vendorId: j.vendorId,
    fullName: j.fullName,
    trade: j.trade,
    dailyCost: j.dailyCost,
    isSubcontractor: j.isSubcontractor,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export function toTimesheetDto(t: Timesheet): TimesheetDto {
  const j = t.toJSON();
  return {
    id: j.id,
    personnelId: j.personnelId,
    workDate: j.workDate,
    hours: j.hours,
    overtime: j.overtime,
    statusCode: j.statusCode,
    boqLineId: j.boqLineId,
  };
}

export function toMachineDto(m: Machine): MachineDto {
  const j = m.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    code: j.code,
    name: j.name,
    kind: j.kind,
    vendorId: j.vendorId,
    hourlyCost: j.hourlyCost,
    active: j.active,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export function toMachineLogDto(l: MachineLog): MachineLogDto {
  const j = l.toJSON();
  return {
    id: j.id,
    machineId: j.machineId,
    projectId: j.projectId,
    logDate: j.logDate,
    workHours: j.workHours,
    fuelLiters: j.fuelLiters,
    fuelCost: j.fuelCost,
    maintCost: j.maintCost,
    boqLineId: j.boqLineId,
    note: j.note,
  };
}
