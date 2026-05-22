/**
 * PgEmployeeRepository — EmployeeRepository PG implementasyonu.
 *
 * Tablo: employees (012_hr.sql).
 *
 * UNIQUE çakışmaları:
 *  - uq_employees_company_employee_no
 *  - uq_employees_user (user_id NOT NULL)
 *  - uq_employees_company_tc_kimlik
 *
 * PG hata kodu '23505' use-case'lere yansıtılır; use-case tipli error'a çevirir.
 */
import type { Pool } from 'pg';

import type {
  EmployeeRepository,
  NewEmployeeInput,
} from '../../application/ports/EmployeeRepository.js';
import { Employee } from '../../domain/entities/Employee.js';
import { EmployeeNumber } from '../../domain/valueObjects/EmployeeNumber.js';
import type { EmployeeStatus } from '../../domain/valueObjects/EmployeeStatus.js';
import type { EmploymentType } from '../../domain/valueObjects/EmploymentType.js';
import { HireDate } from '../../domain/valueObjects/HireDate.js';
import { PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';
import { TcKimlik } from '../../domain/valueObjects/TcKimlik.js';

interface EmployeeRow {
  id: number;
  company_id: number;
  user_id: number | null;
  department_id: number;
  position_id: number | null;
  employee_no: string;
  first_name: string;
  last_name: string;
  tc_kimlik: string | null;
  email: string | null;
  phone: string | null;
  hire_date: Date;
  termination_date: Date | null;
  status: EmployeeStatus;
  employment_type: EmploymentType;
  source_application_id: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, user_id, department_id, position_id, employee_no, first_name, last_name, ' +
  'tc_kimlik, email, phone, hire_date, termination_date, status, employment_type, ' +
  'source_application_id, created_at, updated_at';

export class PgEmployeeRepository implements EmployeeRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewEmployeeInput): Promise<Employee> {
    const r = await this.pool.query<EmployeeRow>(
      `INSERT INTO employees
         (company_id, user_id, department_id, position_id, employee_no,
          first_name, last_name, tc_kimlik, email, phone, hire_date,
          status, employment_type, source_application_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.userId,
        input.departmentId,
        input.positionId,
        input.employeeNo,
        input.firstName,
        input.lastName,
        input.tcKimlik,
        input.email,
        input.phone,
        input.hireDate,
        input.status,
        input.employmentType,
        input.sourceApplicationId,
      ],
    );
    return rowToEmployee(r.rows[0]!);
  }

  async update(employee: Employee): Promise<void> {
    await this.pool.query(
      `UPDATE employees
         SET user_id = $1,
             department_id = $2,
             position_id = $3,
             employee_no = $4,
             first_name = $5,
             last_name = $6,
             tc_kimlik = $7,
             email = $8,
             phone = $9,
             hire_date = $10,
             termination_date = $11,
             status = $12,
             employment_type = $13,
             source_application_id = $14,
             updated_at = NOW()
       WHERE id = $15 AND company_id = $16`,
      [
        employee.userId,
        employee.departmentId,
        employee.positionId,
        employee.employeeNo.value,
        employee.firstName,
        employee.lastName,
        employee.tcKimlik?.value ?? null,
        employee.email,
        employee.phone?.value ?? null,
        employee.hireDate.toISOString(),
        employee.terminationDate?.toISOString().slice(0, 10) ?? null,
        employee.status,
        employee.employmentType,
        employee.sourceApplicationId,
        employee.id,
        employee.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Employee | null> {
    const r = await this.pool.query<EmployeeRow>(
      `SELECT ${COLS} FROM employees WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToEmployee(row) : null;
  }

  async findByEmployeeNo(employeeNo: string, companyId: number): Promise<Employee | null> {
    const r = await this.pool.query<EmployeeRow>(
      `SELECT ${COLS} FROM employees
        WHERE employee_no = $1 AND company_id = $2 LIMIT 1`,
      [employeeNo, companyId],
    );
    const row = r.rows[0];
    return row ? rowToEmployee(row) : null;
  }

  async findByUserId(userId: number, companyId: number): Promise<Employee | null> {
    const r = await this.pool.query<EmployeeRow>(
      `SELECT ${COLS} FROM employees
        WHERE user_id = $1 AND company_id = $2 LIMIT 1`,
      [userId, companyId],
    );
    const row = r.rows[0];
    return row ? rowToEmployee(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: {
      status?: EmployeeStatus;
      departmentId?: number;
      positionId?: number;
      q?: string;
    },
  ): Promise<ReadonlyArray<Employee>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];

    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options?.departmentId !== undefined) {
      params.push(options.departmentId);
      conditions.push(`department_id = $${params.length}`);
    }
    if (options?.positionId !== undefined) {
      params.push(options.positionId);
      conditions.push(`position_id = $${params.length}`);
    }
    if (options?.q !== undefined && options.q.trim().length > 0) {
      params.push(`%${options.q.toLowerCase()}%`);
      conditions.push(
        `(LOWER(first_name) LIKE $${params.length}
         OR LOWER(last_name) LIKE $${params.length}
         OR LOWER(employee_no) LIKE $${params.length})`,
      );
    }

    const r = await this.pool.query<EmployeeRow>(
      `SELECT ${COLS} FROM employees
        WHERE ${conditions.join(' AND ')}
        ORDER BY last_name ASC, first_name ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToEmployee);
  }

  async countActiveByDepartment(departmentId: number, companyId: number): Promise<number> {
    const r = await this.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM employees
        WHERE department_id = $1 AND company_id = $2 AND status <> 'terminated'`,
      [departmentId, companyId],
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  async countActiveByPosition(positionId: number, companyId: number): Promise<number> {
    const r = await this.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM employees
        WHERE position_id = $1 AND company_id = $2 AND status <> 'terminated'`,
      [positionId, companyId],
    );
    return Number(r.rows[0]?.n ?? 0);
  }
}

function rowToEmployee(row: EmployeeRow): Employee {
  return Employee.create({
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    departmentId: row.department_id,
    positionId: row.position_id,
    employeeNo: EmployeeNumber.create(row.employee_no),
    firstName: row.first_name,
    lastName: row.last_name,
    tcKimlik: row.tc_kimlik ? TcKimlik.create(row.tc_kimlik) : null,
    email: row.email,
    phone: row.phone ? PhoneNumber.create(row.phone) : null,
    // hire_date PG'den Date olarak gelir (UTC); HireDate VO bunu normalize eder.
    hireDate: HireDate.create(row.hire_date, new Date('2099-12-31')),
    terminationDate: row.termination_date,
    status: row.status,
    employmentType: row.employment_type,
    sourceApplicationId: row.source_application_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
