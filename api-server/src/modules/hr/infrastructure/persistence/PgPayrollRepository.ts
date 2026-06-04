/**
 * PgPayrollRepository — PayrollRunRepository PG implementasyonu (run + items).
 *
 * Tablolar: hr_payroll_runs + hr_payroll_items (019_hr_payroll.sql).
 * Tüm sorgular company_id ile scope'lanır (multi-tenant izolasyon).
 * NUMERIC kolonlar Number(...) ile okunur (pg string döner).
 */
import type {
  NewPayrollItemInput,
  NewPayrollRunInput,
  PayrollRunRepository,
} from '../../application/ports/PayrollRunRepository.js';
import { PayrollItem } from '../../domain/entities/PayrollItem.js';
import { PayrollRun } from '../../domain/entities/PayrollRun.js';
import type { PayrollRunStatus } from '../../domain/valueObjects/PayrollRunStatus.js';

import type { Queryable } from './Queryable.js';

interface PayrollRunRow {
  id: number;
  company_id: number;
  period_year: number;
  period_month: number;
  status: PayrollRunStatus;
  note: string | null;
  finalized_at: Date | null;
  finalized_by_user_id: number | null;
  created_at: Date;
  updated_at: Date;
}

interface PayrollItemRow {
  id: number;
  company_id: number;
  run_id: number;
  employee_id: number;
  gross_salary: string;
  sgk_employee: string;
  unemployment: string;
  income_tax: string;
  stamp_tax: string;
  other_deductions: string;
  net_salary: string;
  created_at: Date;
  updated_at: Date;
}

const RUN_COLS =
  'id, company_id, period_year, period_month, status, note, ' +
  'finalized_at, finalized_by_user_id, created_at, updated_at';

const ITEM_COLS =
  'id, company_id, run_id, employee_id, gross_salary, sgk_employee, unemployment, ' +
  'income_tax, stamp_tax, other_deductions, net_salary, created_at, updated_at';

export class PgPayrollRepository implements PayrollRunRepository {
  constructor(private readonly pool: Queryable) {}

  // ---------------------------------------------------------------------------
  // runs
  // ---------------------------------------------------------------------------
  async createRun(input: NewPayrollRunInput): Promise<PayrollRun> {
    const r = await this.pool.query<PayrollRunRow>(
      `INSERT INTO hr_payroll_runs
         (company_id, period_year, period_month, status, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${RUN_COLS}`,
      [input.companyId, input.periodYear, input.periodMonth, input.status, input.note],
    );
    return rowToPayrollRun(r.rows[0]!);
  }

  async findRunById(id: number, companyId: number): Promise<PayrollRun | null> {
    const r = await this.pool.query<PayrollRunRow>(
      `SELECT ${RUN_COLS} FROM hr_payroll_runs WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToPayrollRun(row) : null;
  }

  async findRunByPeriod(
    companyId: number,
    periodYear: number,
    periodMonth: number,
  ): Promise<PayrollRun | null> {
    const r = await this.pool.query<PayrollRunRow>(
      `SELECT ${RUN_COLS} FROM hr_payroll_runs
        WHERE company_id = $1 AND period_year = $2 AND period_month = $3
        LIMIT 1`,
      [companyId, periodYear, periodMonth],
    );
    const row = r.rows[0];
    return row ? rowToPayrollRun(row) : null;
  }

  async listRuns(filter: {
    companyId: number;
    year?: number;
    status?: PayrollRunStatus;
  }): Promise<ReadonlyArray<PayrollRun>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [filter.companyId];

    if (filter.year !== undefined) {
      params.push(filter.year);
      conditions.push(`period_year = $${params.length}`);
    }
    if (filter.status !== undefined) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    const r = await this.pool.query<PayrollRunRow>(
      `SELECT ${RUN_COLS} FROM hr_payroll_runs
        WHERE ${conditions.join(' AND ')}
        ORDER BY period_year DESC, period_month DESC, id DESC`,
      params,
    );
    return r.rows.map(rowToPayrollRun);
  }

  async updateRun(run: PayrollRun): Promise<void> {
    await this.pool.query(
      `UPDATE hr_payroll_runs
         SET status = $1,
             note = $2,
             finalized_at = $3,
             finalized_by_user_id = $4,
             updated_at = NOW()
       WHERE id = $5 AND company_id = $6`,
      [run.status, run.note, run.finalizedAt, run.finalizedByUserId, run.id, run.companyId],
    );
  }

  // ---------------------------------------------------------------------------
  // items
  // ---------------------------------------------------------------------------
  async replaceItemsForRun(
    runId: number,
    companyId: number,
    items: ReadonlyArray<NewPayrollItemInput>,
  ): Promise<ReadonlyArray<PayrollItem>> {
    await this.pool.query(`DELETE FROM hr_payroll_items WHERE run_id = $1 AND company_id = $2`, [
      runId,
      companyId,
    ]);

    const inserted: PayrollItem[] = [];
    for (const item of items) {
      const r = await this.pool.query<PayrollItemRow>(
        `INSERT INTO hr_payroll_items
           (company_id, run_id, employee_id, gross_salary, sgk_employee, unemployment,
            income_tax, stamp_tax, other_deductions, net_salary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${ITEM_COLS}`,
        [
          item.companyId,
          item.runId,
          item.employeeId,
          item.grossSalary,
          item.sgkEmployee,
          item.unemployment,
          item.incomeTax,
          item.stampTax,
          item.otherDeductions,
          item.netSalary,
        ],
      );
      inserted.push(rowToPayrollItem(r.rows[0]!));
    }
    return inserted;
  }

  async listItemsForRun(runId: number, companyId: number): Promise<ReadonlyArray<PayrollItem>> {
    const r = await this.pool.query<PayrollItemRow>(
      `SELECT ${ITEM_COLS} FROM hr_payroll_items
        WHERE run_id = $1 AND company_id = $2
        ORDER BY employee_id ASC, id ASC`,
      [runId, companyId],
    );
    return r.rows.map(rowToPayrollItem);
  }

  async findItem(id: number, companyId: number): Promise<PayrollItem | null> {
    const r = await this.pool.query<PayrollItemRow>(
      `SELECT ${ITEM_COLS} FROM hr_payroll_items WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToPayrollItem(row) : null;
  }
}

function rowToPayrollRun(row: PayrollRunRow): PayrollRun {
  return PayrollRun.create({
    id: row.id,
    companyId: row.company_id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    status: row.status,
    note: row.note,
    finalizedAt: row.finalized_at,
    finalizedByUserId: row.finalized_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function rowToPayrollItem(row: PayrollItemRow): PayrollItem {
  return PayrollItem.create({
    id: row.id,
    companyId: row.company_id,
    runId: row.run_id,
    employeeId: row.employee_id,
    grossSalary: Number(row.gross_salary),
    sgkEmployee: Number(row.sgk_employee),
    unemployment: Number(row.unemployment),
    incomeTax: Number(row.income_tax),
    stampTax: Number(row.stamp_tax),
    otherDeductions: Number(row.other_deductions),
    netSalary: Number(row.net_salary),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
