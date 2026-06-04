/**
 * PayrollRunRepository — port (run + items cohesive).
 *
 * Concrete: infrastructure/persistence/PgPayrollRepository.ts.
 */
import type { PayrollItem } from '../../domain/entities/PayrollItem.js';
import type { PayrollRun } from '../../domain/entities/PayrollRun.js';
import type { PayrollRunStatus } from '../../domain/valueObjects/PayrollRunStatus.js';

export interface PayrollRunRepository {
  // --- runs ---
  createRun(input: NewPayrollRunInput): Promise<PayrollRun>;

  findRunById(id: number, companyId: number): Promise<PayrollRun | null>;

  /** Şirket + dönem için var olan koşu (UNIQUE) — duplicate kontrolü. */
  findRunByPeriod(
    companyId: number,
    periodYear: number,
    periodMonth: number,
  ): Promise<PayrollRun | null>;

  listRuns(filter: {
    companyId: number;
    year?: number;
    status?: PayrollRunStatus;
  }): Promise<ReadonlyArray<PayrollRun>>;

  updateRun(run: PayrollRun): Promise<void>;

  // --- items ---
  /** Koşunun tüm satırlarını siler ve yeni hesaplananlarla değiştirir. */
  replaceItemsForRun(
    runId: number,
    companyId: number,
    items: ReadonlyArray<NewPayrollItemInput>,
  ): Promise<ReadonlyArray<PayrollItem>>;

  listItemsForRun(runId: number, companyId: number): Promise<ReadonlyArray<PayrollItem>>;

  findItem(id: number, companyId: number): Promise<PayrollItem | null>;
}

export interface NewPayrollRunInput {
  companyId: number;
  periodYear: number;
  periodMonth: number;
  status: PayrollRunStatus;
  note: string | null;
}

export interface NewPayrollItemInput {
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
}
