/**
 * PgOrgStructureReader — OrgStructureReader PG implementasyonu.
 *
 * Tablolar (012_hr.sql): org_units, departments, employees + users (auth).
 * Tüm sorgular company_id ile scope'lanır.
 *
 * NOT (departments.parentDeptId): 012_hr.sql şemasında departments tablosunda
 * departman→departman (parent_dept) sütunu YOKTUR; hiyerarşi yalnızca
 * org_units.parent_id üzerindedir. Bu yüzden DepartmentNode.parentDeptId her
 * zaman null döner. departments yine de cascade hesabında "kendine eşitlik"
 * (subjectId === departmentId) için resolver'a verilir.
 */
import type { OrgStructureReader } from '../../application/ports/OrgStructureReader.js';
import type {
  DepartmentNode,
  OrgUnitNode,
  UserScope,
} from '../../domain/services/PermissionResolver.js';

import type { Queryable } from './Queryable.js';

// --- row types ---
interface OrgUnitRow {
  id: number;
  parent_id: number | null;
}

interface DepartmentRow {
  id: number;
}

interface UserScopeRow {
  employee_id: number;
  position_id: number | null;
  department_id: number;
  org_unit_id: number | null;
}

export class PgOrgStructureReader implements OrgStructureReader {
  constructor(private readonly pool: Queryable) {}

  async listOrgUnits(companyId: number): Promise<ReadonlyArray<OrgUnitNode>> {
    const r = await this.pool.query<OrgUnitRow>(
      `SELECT id, parent_id FROM org_units WHERE company_id = $1 ORDER BY id ASC`,
      [companyId],
    );
    return r.rows.map((row) => ({ id: row.id, parentId: row.parent_id }));
  }

  async listDepartments(companyId: number): Promise<ReadonlyArray<DepartmentNode>> {
    const r = await this.pool.query<DepartmentRow>(
      `SELECT id FROM departments WHERE company_id = $1 ORDER BY id ASC`,
      [companyId],
    );
    // Şemada departman→departman parent sütunu yok → parentDeptId daima null.
    return r.rows.map((row) => ({ id: row.id, parentDeptId: null }));
  }

  async resolveUserScope(username: string, companyId: number): Promise<UserScope | null> {
    const r = await this.pool.query<UserScopeRow>(
      `SELECT e.id            AS employee_id,
              e.position_id    AS position_id,
              e.department_id  AS department_id,
              d.org_unit_id    AS org_unit_id
         FROM employees e
         JOIN users u ON u.id = e.user_id
         JOIN departments d ON d.id = e.department_id
        WHERE u.username = $1 AND e.company_id = $2
        LIMIT 1`,
      [username, companyId],
    );
    const row = r.rows[0];
    if (row === undefined) return null;

    return {
      employeeId: row.employee_id,
      departmentId: row.department_id,
      ...(row.position_id !== null ? { jobTitleId: row.position_id } : {}),
      ...(row.org_unit_id !== null ? { orgUnitId: row.org_unit_id } : {}),
    };
  }
}
