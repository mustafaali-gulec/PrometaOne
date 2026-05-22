/**
 * PgDepartmentRepository — DepartmentRepository PG implementasyonu.
 *
 * Tablo: departments (012_hr.sql). hasActiveEmployees employees tablosunu
 * sorgular.
 */
import type { Pool } from 'pg';

import type {
  DepartmentRepository,
  NewDepartmentInput,
} from '../../application/ports/DepartmentRepository.js';
import { Department } from '../../domain/entities/Department.js';
import { DepartmentCode } from '../../domain/valueObjects/DepartmentCode.js';

interface DepartmentRow {
  id: number;
  company_id: number;
  org_unit_id: number | null;
  name: string;
  code: string | null;
  manager_employee_id: number | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, org_unit_id, name, code, manager_employee_id, active, created_at, updated_at';

export class PgDepartmentRepository implements DepartmentRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewDepartmentInput): Promise<Department> {
    const r = await this.pool.query<DepartmentRow>(
      `INSERT INTO departments (company_id, org_unit_id, name, code, manager_employee_id, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.orgUnitId,
        input.name,
        input.code,
        input.managerEmployeeId,
        input.active,
      ],
    );
    return rowToDepartment(r.rows[0]!);
  }

  async update(department: Department): Promise<void> {
    await this.pool.query(
      `UPDATE departments
         SET org_unit_id = $1,
             name = $2,
             code = $3,
             manager_employee_id = $4,
             active = $5,
             updated_at = NOW()
       WHERE id = $6 AND company_id = $7`,
      [
        department.orgUnitId,
        department.name,
        department.code?.value ?? null,
        department.managerEmployeeId,
        department.active,
        department.id,
        department.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Department | null> {
    const r = await this.pool.query<DepartmentRow>(
      `SELECT ${COLS} FROM departments WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToDepartment(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { includeInactive?: boolean; orgUnitId?: number | null },
  ): Promise<ReadonlyArray<Department>> {
    const includeInactive = options?.includeInactive ?? false;
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];

    if (!includeInactive) {
      conditions.push('active = TRUE');
    }
    if (options?.orgUnitId !== undefined) {
      if (options.orgUnitId === null) {
        conditions.push('org_unit_id IS NULL');
      } else {
        params.push(options.orgUnitId);
        conditions.push(`org_unit_id = $${params.length}`);
      }
    }

    const r = await this.pool.query<DepartmentRow>(
      `SELECT ${COLS} FROM departments
        WHERE ${conditions.join(' AND ')}
        ORDER BY name ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToDepartment);
  }

  async hasActiveEmployees(departmentId: number, companyId: number): Promise<boolean> {
    const r = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM employees
          WHERE department_id = $1
            AND company_id = $2
            AND status <> 'terminated'
       ) AS exists`,
      [departmentId, companyId],
    );
    return r.rows[0]?.exists ?? false;
  }
}

function rowToDepartment(row: DepartmentRow): Department {
  return Department.create({
    id: row.id,
    companyId: row.company_id,
    orgUnitId: row.org_unit_id,
    name: row.name,
    code: row.code ? DepartmentCode.create(row.code) : null,
    managerEmployeeId: row.manager_employee_id,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
