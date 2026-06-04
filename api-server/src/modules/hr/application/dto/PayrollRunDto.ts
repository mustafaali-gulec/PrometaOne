/**
 * PayrollRunDto / PayrollItemDto — REST response için.
 */
import type { PayrollItem } from '../../domain/entities/PayrollItem.js';
import type { PayrollRun } from '../../domain/entities/PayrollRun.js';
import type { PayrollRunStatus } from '../../domain/valueObjects/PayrollRunStatus.js';

export interface PayrollRunDto {
  id: number;
  companyId: number;
  periodYear: number;
  periodMonth: number;
  status: PayrollRunStatus;
  note: string | null;
  /** ISO timestamp veya null. */
  finalizedAt: string | null;
  finalizedByUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollItemDto {
  id: number;
  companyId: number;
  runId: number;
  employeeId: number;
  grossSalary: number;
  sgkEmployee: number;
  unemployment: number;
  incomeTax: number;
  stampTax: number;
  otherDeductions: number;
  netSalary: number;
  createdAt: string;
  updatedAt: string;
}

export function toPayrollRunDto(run: PayrollRun): PayrollRunDto {
  return {
    id: run.id,
    companyId: run.companyId,
    periodYear: run.periodYear,
    periodMonth: run.periodMonth,
    status: run.status,
    note: run.note,
    finalizedAt: run.finalizedAt ? run.finalizedAt.toISOString() : null,
    finalizedByUserId: run.finalizedByUserId,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

export function toPayrollItemDto(item: PayrollItem): PayrollItemDto {
  return {
    id: item.id,
    companyId: item.companyId,
    runId: item.runId,
    employeeId: item.employeeId,
    grossSalary: item.grossSalary,
    sgkEmployee: item.sgkEmployee,
    unemployment: item.unemployment,
    incomeTax: item.incomeTax,
    stampTax: item.stampTax,
    otherDeductions: item.otherDeductions,
    netSalary: item.netSalary,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
