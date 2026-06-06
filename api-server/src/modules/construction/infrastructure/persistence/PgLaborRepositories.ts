/**
 * İş Gücü & Makine PG repository'leri. Personnel/Machine/MachineLog tek-statement
 * (Queryable), Timesheet upsert (ON CONFLICT). LaborCost özet sorguları join'li.
 * BIGINT id/FK alanları Number()'a çevrilir.
 */
import type {
  LaborCostRepository,
  LaborCostTotals,
  MachineLogRepository,
  MachineRepository,
  NewMachineInput,
  NewMachineLogInput,
  NewPersonnelInput,
  NewTimesheetInput,
  PersonnelRepository,
  TimesheetRepository,
} from '../../application/ports/LaborRepositories.js';
import { Machine } from '../../domain/entities/Machine.js';
import { MachineLog } from '../../domain/entities/MachineLog.js';
import { Personnel } from '../../domain/entities/Personnel.js';
import { Timesheet } from '../../domain/entities/Timesheet.js';
import type { MachineKind } from '../../domain/valueObjects/Labor.js';

import type { Queryable } from './Queryable.js';

// ===== PERSONNEL ============================================================
interface PersonnelRow {
  id: string;
  company_id: number;
  project_id: string;
  employee_id: string | null;
  vendor_id: string | null;
  full_name: string;
  trade: string | null;
  daily_cost: string;
  is_subcontractor: boolean;
  active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}
const P_COLS =
  'id, company_id, project_id, employee_id, vendor_id, full_name, trade, daily_cost, ' +
  'is_subcontractor, active, created_by, created_at, updated_at';

export class PgPersonnelRepository implements PersonnelRepository {
  constructor(private readonly db: Queryable) {}
  async insert(input: NewPersonnelInput): Promise<Personnel> {
    const r = await this.db.query<PersonnelRow>(
      `INSERT INTO cs_personnel
         (company_id, project_id, employee_id, vendor_id, full_name, trade, daily_cost,
          is_subcontractor, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${P_COLS}`,
      [
        input.companyId,
        input.projectId,
        input.employeeId,
        input.vendorId,
        input.fullName,
        input.trade,
        input.dailyCost,
        input.isSubcontractor,
        input.createdBy,
      ],
    );
    return rowToPersonnel(r.rows[0]!);
  }
  async update(p: Personnel): Promise<void> {
    await this.db.query(
      `UPDATE cs_personnel SET full_name=$1, trade=$2, daily_cost=$3, vendor_id=$4,
         is_subcontractor=$5, active=$6, updated_at=NOW() WHERE id=$7 AND company_id=$8`,
      [
        p.fullName,
        p.trade,
        p.dailyCost,
        p.vendorId,
        p.isSubcontractor,
        p.active,
        p.id,
        p.companyId,
      ],
    );
  }
  async findById(id: number, companyId: number): Promise<Personnel | null> {
    const r = await this.db.query<PersonnelRow>(
      `SELECT ${P_COLS} FROM cs_personnel WHERE id=$1 AND company_id=$2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToPersonnel(row) : null;
  }
  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Personnel>> {
    const r = await this.db.query<PersonnelRow>(
      `SELECT ${P_COLS} FROM cs_personnel WHERE project_id=$1 AND company_id=$2 ORDER BY full_name`,
      [projectId, companyId],
    );
    return r.rows.map(rowToPersonnel);
  }
}
function rowToPersonnel(row: PersonnelRow): Personnel {
  return Personnel.create({
    id: Number(row.id),
    companyId: row.company_id,
    projectId: Number(row.project_id),
    employeeId: row.employee_id !== null ? Number(row.employee_id) : null,
    vendorId: row.vendor_id !== null ? Number(row.vendor_id) : null,
    fullName: row.full_name,
    trade: row.trade,
    dailyCost: Number(row.daily_cost),
    isSubcontractor: row.is_subcontractor,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// ===== TIMESHEET ============================================================
interface TimesheetRow {
  id: string;
  company_id: number;
  personnel_id: string;
  work_date: string;
  hours: string;
  overtime: string;
  status_code: string;
  boq_line_id: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}
const T_COLS =
  'id, company_id, personnel_id, work_date::text AS work_date, hours, overtime, status_code, ' +
  'boq_line_id, created_by, created_at, updated_at';

export class PgTimesheetRepository implements TimesheetRepository {
  constructor(private readonly db: Queryable) {}
  async upsert(input: NewTimesheetInput): Promise<Timesheet> {
    const r = await this.db.query<TimesheetRow>(
      `INSERT INTO cs_timesheets
         (company_id, personnel_id, work_date, hours, overtime, status_code, boq_line_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (personnel_id, work_date) DO UPDATE
         SET hours=EXCLUDED.hours, overtime=EXCLUDED.overtime, status_code=EXCLUDED.status_code,
             boq_line_id=EXCLUDED.boq_line_id, updated_at=NOW()
       RETURNING ${T_COLS}`,
      [
        input.companyId,
        input.personnelId,
        input.workDate,
        input.hours,
        input.overtime,
        input.statusCode,
        input.boqLineId,
        input.createdBy,
      ],
    );
    return rowToTimesheet(r.rows[0]!);
  }
  async delete(id: number, companyId: number): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM cs_timesheets WHERE id=$1 AND company_id=$2`, [
      id,
      companyId,
    ]);
    return (r.rowCount ?? 0) > 0;
  }
  async listByProject(
    projectId: number,
    companyId: number,
    fromDate?: string,
    toDate?: string,
  ): Promise<ReadonlyArray<Timesheet>> {
    const params: unknown[] = [projectId, companyId];
    let sql = `SELECT ${T_COLS} FROM cs_timesheets t
        WHERE t.company_id = $2
          AND t.personnel_id IN (SELECT id FROM cs_personnel WHERE project_id = $1)`;
    if (fromDate !== undefined) {
      params.push(fromDate);
      sql += ` AND t.work_date >= $${params.length}`;
    }
    if (toDate !== undefined) {
      params.push(toDate);
      sql += ` AND t.work_date <= $${params.length}`;
    }
    sql += ' ORDER BY t.work_date DESC, t.id DESC';
    const r = await this.db.query<TimesheetRow>(sql, params);
    return r.rows.map(rowToTimesheet);
  }
}
function rowToTimesheet(row: TimesheetRow): Timesheet {
  return Timesheet.create({
    id: Number(row.id),
    companyId: row.company_id,
    personnelId: Number(row.personnel_id),
    workDate: row.work_date,
    hours: Number(row.hours),
    overtime: Number(row.overtime),
    statusCode: row.status_code,
    boqLineId: row.boq_line_id !== null ? Number(row.boq_line_id) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// ===== MACHINE ==============================================================
interface MachineRow {
  id: string;
  company_id: number;
  code: string;
  name: string;
  kind: MachineKind;
  vendor_id: string | null;
  hourly_cost: string;
  active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}
const MC_COLS =
  'id, company_id, code, name, kind, vendor_id, hourly_cost, active, created_by, created_at, updated_at';

export class PgMachineRepository implements MachineRepository {
  constructor(private readonly db: Queryable) {}
  async insert(input: NewMachineInput): Promise<Machine> {
    const r = await this.db.query<MachineRow>(
      `INSERT INTO cs_machines (company_id, code, name, kind, vendor_id, hourly_cost, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${MC_COLS}`,
      [
        input.companyId,
        input.code,
        input.name,
        input.kind,
        input.vendorId,
        input.hourlyCost,
        input.createdBy,
      ],
    );
    return rowToMachine(r.rows[0]!);
  }
  async update(m: Machine): Promise<void> {
    await this.db.query(
      `UPDATE cs_machines SET name=$1, kind=$2, vendor_id=$3, hourly_cost=$4, active=$5,
         updated_at=NOW() WHERE id=$6 AND company_id=$7`,
      [m.name, m.kind, m.vendorId, m.hourlyCost, m.active, m.id, m.companyId],
    );
  }
  async findById(id: number, companyId: number): Promise<Machine | null> {
    const r = await this.db.query<MachineRow>(
      `SELECT ${MC_COLS} FROM cs_machines WHERE id=$1 AND company_id=$2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToMachine(row) : null;
  }
  async listByCompany(
    companyId: number,
    includeInactive?: boolean,
  ): Promise<ReadonlyArray<Machine>> {
    const cond = includeInactive === true ? '' : ' AND active = TRUE';
    const r = await this.db.query<MachineRow>(
      `SELECT ${MC_COLS} FROM cs_machines WHERE company_id=$1${cond} ORDER BY code`,
      [companyId],
    );
    return r.rows.map(rowToMachine);
  }
  async existsByCode(companyId: number, code: string): Promise<boolean> {
    const r = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM cs_machines WHERE company_id=$1 AND code=$2) AS exists`,
      [companyId, code],
    );
    return r.rows[0]?.exists ?? false;
  }
}
function rowToMachine(row: MachineRow): Machine {
  return Machine.create({
    id: Number(row.id),
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    vendorId: row.vendor_id !== null ? Number(row.vendor_id) : null,
    hourlyCost: Number(row.hourly_cost),
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// ===== MACHINE LOG ==========================================================
interface MachineLogRow {
  id: string;
  company_id: number;
  machine_id: string;
  project_id: string;
  log_date: string;
  work_hours: string;
  fuel_liters: string;
  fuel_cost: string;
  maint_cost: string;
  boq_line_id: string | null;
  note: string | null;
  created_by: number | null;
  created_at: Date;
}
const ML_COLS =
  'id, company_id, machine_id, project_id, log_date::text AS log_date, work_hours, fuel_liters, ' +
  'fuel_cost, maint_cost, boq_line_id, note, created_by, created_at';

export class PgMachineLogRepository implements MachineLogRepository {
  constructor(private readonly db: Queryable) {}
  async insert(input: NewMachineLogInput): Promise<MachineLog> {
    const r = await this.db.query<MachineLogRow>(
      `INSERT INTO cs_machine_logs
         (company_id, machine_id, project_id, log_date, work_hours, fuel_liters, fuel_cost,
          maint_cost, boq_line_id, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${ML_COLS}`,
      [
        input.companyId,
        input.machineId,
        input.projectId,
        input.logDate,
        input.workHours,
        input.fuelLiters,
        input.fuelCost,
        input.maintCost,
        input.boqLineId,
        input.note,
        input.createdBy,
      ],
    );
    return rowToMachineLog(r.rows[0]!);
  }
  async delete(id: number, companyId: number): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM cs_machine_logs WHERE id=$1 AND company_id=$2`, [
      id,
      companyId,
    ]);
    return (r.rowCount ?? 0) > 0;
  }
  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<MachineLog>> {
    const r = await this.db.query<MachineLogRow>(
      `SELECT ${ML_COLS} FROM cs_machine_logs WHERE project_id=$1 AND company_id=$2
        ORDER BY log_date DESC, id DESC`,
      [projectId, companyId],
    );
    return r.rows.map(rowToMachineLog);
  }
}
function rowToMachineLog(row: MachineLogRow): MachineLog {
  return MachineLog.create({
    id: Number(row.id),
    companyId: row.company_id,
    machineId: Number(row.machine_id),
    projectId: Number(row.project_id),
    logDate: row.log_date,
    workHours: Number(row.work_hours),
    fuelLiters: Number(row.fuel_liters),
    fuelCost: Number(row.fuel_cost),
    maintCost: Number(row.maint_cost),
    boqLineId: row.boq_line_id !== null ? Number(row.boq_line_id) : null,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  });
}

// ===== LABOR COST SUMMARY ===================================================
export class PgLaborCostRepository implements LaborCostRepository {
  constructor(private readonly db: Queryable) {}
  async costSummary(projectId: number, companyId: number): Promise<LaborCostTotals> {
    const labor = await this.db.query<{ v: string }>(
      `SELECT COALESCE(SUM(
          CASE upper(t.status_code) WHEN 'P' THEN 1 WHEN 'Y' THEN 0.5 ELSE 0 END * p.daily_cost
        ), 0)::text AS v
         FROM cs_timesheets t
         JOIN cs_personnel p ON p.id = t.personnel_id
        WHERE p.project_id = $1 AND p.company_id = $2`,
      [projectId, companyId],
    );
    const machine = await this.db.query<{ work: string; fuel: string; maint: string }>(
      `SELECT COALESCE(SUM(l.work_hours * m.hourly_cost), 0)::text AS work,
              COALESCE(SUM(l.fuel_cost), 0)::text AS fuel,
              COALESCE(SUM(l.maint_cost), 0)::text AS maint
         FROM cs_machine_logs l
         JOIN cs_machines m ON m.id = l.machine_id
        WHERE l.project_id = $1 AND l.company_id = $2`,
      [projectId, companyId],
    );
    return {
      laborCost: Number(labor.rows[0]?.v ?? '0'),
      machineWorkCost: Number(machine.rows[0]?.work ?? '0'),
      fuelCost: Number(machine.rows[0]?.fuel ?? '0'),
      maintCost: Number(machine.rows[0]?.maint ?? '0'),
    };
  }
}
