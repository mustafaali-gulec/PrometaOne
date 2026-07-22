/**
 * PgHrProjectionRepository — HrProjectionMirror PG implementasyonu.
 * Tablolar: org_units / departments / positions / employees / candidates /
 * applications / hr_leave_requests / hr_payroll_runs / hr_payroll_items /
 * hr_assets / hr_asset_assignments (012/018/019/020 + 047_hr_projection.sql
 * client_id kolonları).
 *
 * replaceAll TEK transaction'da (PgAccessProjectionRepository kalıbı) ve YALNIZ
 * projeksiyon-sahipli satırlara (client_id IS NOT NULL) dokunur; hr CRUD
 * satırları (client_id IS NULL) korunur. Akış:
 *
 *   0. companies lookup: var olmayan company_id'li satırlar FK ihlali yerine
 *      DÜŞÜRÜLÜR (console.error) — projeksiyon asla PUT'u bozmaz.
 *   1. ÜST ENTİTELER — upsert (id kararlı) + prune, FK sırasıyla:
 *      org_units (parent 2. geçişte) → departments (manager 2. geçişte) →
 *      positions → employees → candidates → hr_payroll_runs → hr_assets.
 *      Upsert: UPDATE ... WHERE client_id → yoksa INSERT. Doğal anahtar
 *      devralması yalnız tam-unique kısıtı olan tablolarda:
 *        employees        → ON CONFLICT (company_id, employee_no)
 *        hr_payroll_runs  → ON CONFLICT (company_id, period_year, period_month)
 *        hr_payroll_items → ON CONFLICT (run_id, employee_id) (devralınan
 *                           koşu/çalışanın CRUD satırı ezilmesin diye)
 *   2. DETAYLAR — delete-then-insert: hr_asset_assignments, hr_payroll_items,
 *      applications, hr_leave_requests (serial id churn'ü ayna için kabul).
 *      FK'lar 1. adımda kurulan client→serial haritalarından çözülür;
 *      çözülemeyen satır düşürülür + sayaç loglanır.
 *   3. PRUNE — çocuktan ebeveyne: employees → candidates → positions →
 *      hr_assets → departments → org_units (önce doomed parent'lar detach
 *      edilir; org_units.parent_id RESTRICT tek DELETE'i bozmasın).
 *
 * Bilinen sınırlar (access emsalindeki gibi — hata üst katmanda yutulur, ayna
 * bir önceki tutarlı hâlinde kalır; kaynak-of-truth blob olduğundan veri kaybı
 * yoktur):
 *   - org_units/departments (company_id, code) partial unique: blob kodu bir
 *     CRUD satırının koduyla çakışırsa transaction geri alınır (batch içi
 *     çiftler domain'de NULL'lanır).
 *   - CRUD satırı bir projeksiyon satırına elle FK bağlanmışsa RESTRICT prune'u
 *     geri alabilir.
 */
import type { HrProjectionMirror } from '../../application/ports/HrProjectionMirror.js';
import type {
  HrApplicationProjection,
  HrAssetAssignmentProjection,
  HrAssetProjection,
  HrCandidateProjection,
  HrDepartmentProjection,
  HrEmployeeProjection,
  HrLeaveRequestProjection,
  HrOrgUnitProjection,
  HrPayrollItemProjection,
  HrPayrollRunProjection,
  HrPositionProjection,
  HrProjection,
} from '../../domain/HrProjection.js';

/** pg.PoolClient'ın burada kullanılan alt kümesi (testte mock'lanabilir). */
export interface HrProjectionPoolClient {
  query(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<{ rows?: unknown[]; rowCount?: number | null }>;
  release(): void;
}

/** pg.Pool'un burada kullanılan alt kümesi. */
export interface HrProjectionPool {
  connect(): Promise<HrProjectionPoolClient>;
}

interface IdRow {
  id: number;
}

function firstIdOf(result: { rows?: unknown[] }): number | null {
  const row = result.rows?.[0] as IdRow | undefined;
  if (row === undefined) return null;
  const id = Number(row.id);
  return Number.isFinite(id) ? id : null;
}

type IdMap = Map<string, number>;

export class PgHrProjectionRepository implements HrProjectionMirror {
  constructor(private readonly pool: HrProjectionPool) {}

  async replaceAll(projection: HrProjection): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 0) Var olan şirketler — FK ihlali yerine satır düşürme.
      const companiesRes = await client.query('SELECT id FROM companies');
      const known = new Set((companiesRes.rows ?? []).map((r) => Number((r as IdRow).id)));
      const p = filterByCompany(projection, known);

      // 1) ÜST ENTİTELER — upsert + (sonda) prune.
      const orgUnitIds = await this.upsertOrgUnits(client, p.orgUnits);
      const departmentIds = await this.upsertDepartments(client, p.departments, orgUnitIds);
      const positionIds = await this.upsertPositions(client, p.positions, departmentIds);
      const employeeIds = await this.upsertEmployees(client, p.employees, departmentIds);
      await this.setDepartmentManagers(client, p.departments, employeeIds);
      const candidateIds = await this.upsertCandidates(client, p.candidates);

      // 2) DETAYLAR — delete-then-insert (yalnız projeksiyon-sahipli satırlar).
      await client.query('DELETE FROM hr_asset_assignments WHERE client_id IS NOT NULL');
      await client.query('DELETE FROM hr_payroll_items WHERE client_id IS NOT NULL');
      await client.query('DELETE FROM applications WHERE client_id IS NOT NULL');
      await client.query('DELETE FROM hr_leave_requests WHERE client_id IS NOT NULL');

      await this.insertApplications(client, p.applications, candidateIds, positionIds);
      await this.insertLeaveRequests(client, p.leaveRequests, employeeIds);

      const runIds = await this.upsertPayrollRuns(client, p.payrollRuns);
      await client.query(
        `DELETE FROM hr_payroll_runs
          WHERE client_id IS NOT NULL AND NOT (client_id = ANY($1::text[]))`,
        [p.payrollRuns.map((r) => r.clientId)],
      );
      await this.insertPayrollItems(client, p.payrollItems, runIds, employeeIds);

      const assetIds = await this.upsertAssets(client, p.assets, employeeIds);
      await this.insertAssetAssignments(client, p.assetAssignments, assetIds, employeeIds);

      // 3) PRUNE — çocuktan ebeveyne (detaylar zaten silindi/yeniden yazıldı).
      await this.prune(client, 'employees', p.employees);
      await this.prune(client, 'candidates', p.candidates);
      await this.prune(client, 'positions', p.positions);
      await this.prune(client, 'hr_assets', p.assets);
      await this.prune(client, 'departments', p.departments);
      // org_units.parent_id RESTRICT: doomed satırların parent bağını önce kes.
      await client.query(
        `UPDATE org_units SET parent_id = NULL
          WHERE client_id IS NOT NULL AND NOT (client_id = ANY($1::text[]))`,
        [p.orgUnits.map((o) => o.clientId)],
      );
      await this.prune(client, 'org_units', p.orgUnits);

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK hatası orijinal hatayı gölgelemesin
      }
      throw err;
    } finally {
      client.release();
    }
  }

  private async prune(
    client: HrProjectionPoolClient,
    table: string,
    rows: readonly { clientId: string }[],
  ): Promise<void> {
    await client.query(
      `DELETE FROM ${table}
        WHERE client_id IS NOT NULL AND NOT (client_id = ANY($1::text[]))`,
      [rows.map((r) => r.clientId)],
    );
  }

  // --- Üst entite upsert'leri ------------------------------------------------

  private async upsertOrgUnits(
    client: HrProjectionPoolClient,
    orgUnits: readonly HrOrgUnitProjection[],
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    // 1. geçiş: parent_id NULL (ebeveyn henüz var olmayabilir; cycle trigger'ı
    // pas geçer). 2. geçişte bağlanır.
    for (const ou of orgUnits) {
      const updated = await client.query(
        `UPDATE org_units
            SET company_id = $1, name = $2, code = $3, parent_id = NULL, updated_at = NOW()
          WHERE client_id = $4
          RETURNING id`,
        [ou.companyId, ou.name, ou.code, ou.clientId],
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        const inserted = await client.query(
          `INSERT INTO org_units (company_id, name, code, client_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [ou.companyId, ou.name, ou.code, ou.clientId],
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) ids.set(ou.clientId, id);
    }
    // 2. geçiş: parent bağları (domain self/cycle'ı kırdı; küme içi çözüm).
    for (const ou of orgUnits) {
      if (ou.parentClientId === null) continue;
      const id = ids.get(ou.clientId);
      const parentId = ids.get(ou.parentClientId);
      if (id === undefined || parentId === undefined) continue;
      await client.query('UPDATE org_units SET parent_id = $1 WHERE id = $2', [parentId, id]);
    }
    return ids;
  }

  private async upsertDepartments(
    client: HrProjectionPoolClient,
    departments: readonly HrDepartmentProjection[],
    orgUnitIds: ReadonlyMap<string, number>,
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    for (const dept of departments) {
      const orgUnitId =
        dept.orgUnitClientId !== null ? (orgUnitIds.get(dept.orgUnitClientId) ?? null) : null;
      const updated = await client.query(
        `UPDATE departments
            SET company_id = $1, org_unit_id = $2, name = $3, code = $4,
                manager_employee_id = NULL, updated_at = NOW()
          WHERE client_id = $5
          RETURNING id`,
        [dept.companyId, orgUnitId, dept.name, dept.code, dept.clientId],
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        const inserted = await client.query(
          `INSERT INTO departments (company_id, org_unit_id, name, code, client_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [dept.companyId, orgUnitId, dept.name, dept.code, dept.clientId],
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) ids.set(dept.clientId, id);
    }
    return ids;
  }

  private async upsertPositions(
    client: HrProjectionPoolClient,
    positions: readonly HrPositionProjection[],
    departmentIds: ReadonlyMap<string, number>,
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    for (const pos of positions) {
      const departmentId =
        pos.departmentClientId !== null
          ? (departmentIds.get(pos.departmentClientId) ?? null)
          : null;
      const values = [
        pos.companyId,
        departmentId,
        pos.title,
        pos.description,
        pos.status,
        pos.headcountTarget,
        pos.minSalary,
        pos.maxSalary,
        pos.clientId,
      ];
      const updated = await client.query(
        `UPDATE positions
            SET company_id = $1, department_id = $2, title = $3, description = $4,
                status = $5, headcount_target = $6, min_salary = $7, max_salary = $8,
                updated_at = NOW()
          WHERE client_id = $9
          RETURNING id`,
        values,
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        const inserted = await client.query(
          `INSERT INTO positions
             (company_id, department_id, title, description, status, headcount_target,
              min_salary, max_salary, client_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          values,
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) ids.set(pos.clientId, id);
    }
    return ids;
  }

  private async upsertEmployees(
    client: HrProjectionPoolClient,
    employees: readonly HrEmployeeProjection[],
    departmentIds: ReadonlyMap<string, number>,
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    let unresolved = 0;
    for (const emp of employees) {
      const departmentId = departmentIds.get(emp.departmentClientId);
      if (departmentId === undefined) {
        unresolved += 1; // department_id NOT NULL — düşür (şirket filtresi vb.)
        continue;
      }
      const values = [
        emp.companyId,
        departmentId,
        emp.employeeNo,
        emp.firstName,
        emp.lastName,
        emp.tcKimlik,
        emp.email,
        emp.phone,
        emp.hireDate,
        emp.terminationDate,
        emp.status,
        emp.employmentType,
        emp.clientId,
      ];
      const updated = await client.query(
        `UPDATE employees
            SET company_id = $1, department_id = $2, employee_no = $3, first_name = $4,
                last_name = $5, tc_kimlik = $6, email = $7, phone = $8, hire_date = $9,
                termination_date = $10, status = $11, employment_type = $12,
                updated_at = NOW()
          WHERE client_id = $13
          RETURNING id`,
        values,
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        // Doğal anahtar devralma: aynı (company_id, employee_no) CRUD satırı
        // projeksiyon sahipliğine geçer.
        const inserted = await client.query(
          `INSERT INTO employees
             (company_id, department_id, employee_no, first_name, last_name, tc_kimlik,
              email, phone, hire_date, termination_date, status, employment_type, client_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (company_id, employee_no)
           DO UPDATE SET department_id    = EXCLUDED.department_id,
                         first_name       = EXCLUDED.first_name,
                         last_name        = EXCLUDED.last_name,
                         tc_kimlik        = EXCLUDED.tc_kimlik,
                         email            = EXCLUDED.email,
                         phone            = EXCLUDED.phone,
                         hire_date        = EXCLUDED.hire_date,
                         termination_date = EXCLUDED.termination_date,
                         status           = EXCLUDED.status,
                         employment_type  = EXCLUDED.employment_type,
                         client_id        = EXCLUDED.client_id,
                         updated_at       = NOW()
           RETURNING id`,
          values,
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) ids.set(emp.clientId, id);
    }
    if (unresolved > 0) {
      console.error(
        `[appstate:hr] ${unresolved} çalışan düşürüldü (department_id çözülemedi — şirket filtresi)`,
      );
    }
    return ids;
  }

  private async setDepartmentManagers(
    client: HrProjectionPoolClient,
    departments: readonly HrDepartmentProjection[],
    employeeIds: ReadonlyMap<string, number>,
  ): Promise<void> {
    for (const dept of departments) {
      if (dept.managerEmployeeClientId === null) continue;
      const managerId = employeeIds.get(dept.managerEmployeeClientId);
      if (managerId === undefined) continue; // upsert'te zaten NULL'landı
      await client.query('UPDATE departments SET manager_employee_id = $1 WHERE client_id = $2', [
        managerId,
        dept.clientId,
      ]);
    }
  }

  private async upsertCandidates(
    client: HrProjectionPoolClient,
    candidates: readonly HrCandidateProjection[],
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    for (const cand of candidates) {
      const values = [
        cand.companyId,
        cand.firstName,
        cand.lastName,
        cand.email,
        cand.phone,
        cand.source,
        cand.cvUrl,
        cand.notes,
        cand.clientId,
      ];
      const updated = await client.query(
        `UPDATE candidates
            SET company_id = $1, first_name = $2, last_name = $3, email = $4, phone = $5,
                source = $6, cv_url = $7, notes = $8, updated_at = NOW()
          WHERE client_id = $9
          RETURNING id`,
        values,
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        const inserted = await client.query(
          `INSERT INTO candidates
             (company_id, first_name, last_name, email, phone, source, cv_url, notes, client_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          values,
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) ids.set(cand.clientId, id);
    }
    return ids;
  }

  private async upsertPayrollRuns(
    client: HrProjectionPoolClient,
    runs: readonly HrPayrollRunProjection[],
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    for (const run of runs) {
      const values = [
        run.companyId,
        run.periodYear,
        run.periodMonth,
        run.status,
        run.finalizedAt,
        run.clientId,
      ];
      const updated = await client.query(
        `UPDATE hr_payroll_runs
            SET company_id = $1, period_year = $2, period_month = $3, status = $4,
                finalized_at = $5, updated_at = NOW()
          WHERE client_id = $6
          RETURNING id`,
        values,
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        // Doğal anahtar devralma: aynı dönemin CRUD koşusu projeksiyona geçer.
        const inserted = await client.query(
          `INSERT INTO hr_payroll_runs
             (company_id, period_year, period_month, status, finalized_at, client_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (company_id, period_year, period_month)
           DO UPDATE SET status       = EXCLUDED.status,
                         finalized_at = EXCLUDED.finalized_at,
                         client_id    = EXCLUDED.client_id,
                         updated_at   = NOW()
           RETURNING id`,
          values,
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) ids.set(run.clientId, id);
    }
    return ids;
  }

  private async upsertAssets(
    client: HrProjectionPoolClient,
    assets: readonly HrAssetProjection[],
    employeeIds: ReadonlyMap<string, number>,
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    for (const asset of assets) {
      const assignedEmployeeId =
        asset.assignedEmployeeClientId !== null
          ? (employeeIds.get(asset.assignedEmployeeClientId) ?? null)
          : null;
      const values = [
        asset.companyId,
        asset.assetType,
        asset.name,
        asset.brand,
        asset.model,
        asset.serialNo,
        asset.status,
        assignedEmployeeId,
        asset.notes,
        asset.clientId,
      ];
      const updated = await client.query(
        `UPDATE hr_assets
            SET company_id = $1, asset_type = $2, name = $3, brand = $4, model = $5,
                serial_no = $6, status = $7, assigned_employee_id = $8, notes = $9,
                updated_at = NOW()
          WHERE client_id = $10
          RETURNING id`,
        values,
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        const inserted = await client.query(
          `INSERT INTO hr_assets
             (company_id, asset_type, name, brand, model, serial_no, status,
              assigned_employee_id, notes, client_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          values,
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) ids.set(asset.clientId, id);
    }
    return ids;
  }

  // --- Detay insert'leri -------------------------------------------------------

  private async insertApplications(
    client: HrProjectionPoolClient,
    applications: readonly HrApplicationProjection[],
    candidateIds: ReadonlyMap<string, number>,
    positionIds: ReadonlyMap<string, number>,
  ): Promise<void> {
    let unresolved = 0;
    for (const app of applications) {
      const candidateId = candidateIds.get(app.candidateClientId);
      const positionId = positionIds.get(app.positionClientId);
      if (candidateId === undefined || positionId === undefined) {
        unresolved += 1;
        continue;
      }
      await client.query(
        `INSERT INTO applications
           (company_id, candidate_id, position_id, stage, stage_changed_at,
            rejection_reason, salary_expectation, notes, client_id)
         VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6, $7, $8, $9)`,
        [
          app.companyId,
          candidateId,
          positionId,
          app.stage,
          app.stageChangedAt,
          app.rejectionReason,
          app.salaryExpectation,
          app.notes,
          app.clientId,
        ],
      );
    }
    if (unresolved > 0) {
      console.error(
        `[appstate:hr] ${unresolved} başvuru düşürüldü (candidate/position çözülemedi)`,
      );
    }
  }

  private async insertLeaveRequests(
    client: HrProjectionPoolClient,
    leaveRequests: readonly HrLeaveRequestProjection[],
    employeeIds: ReadonlyMap<string, number>,
  ): Promise<void> {
    let unresolved = 0;
    for (const lr of leaveRequests) {
      const employeeId = employeeIds.get(lr.employeeClientId);
      if (employeeId === undefined) {
        unresolved += 1;
        continue;
      }
      await client.query(
        `INSERT INTO hr_leave_requests
           (company_id, employee_id, leave_type, start_date, end_date, days, reason,
            status, decided_at, decision_note, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          lr.companyId,
          employeeId,
          lr.leaveType,
          lr.startDate,
          lr.endDate,
          lr.days,
          lr.reason,
          lr.status,
          lr.decidedAt,
          lr.decisionNote,
          lr.clientId,
        ],
      );
    }
    if (unresolved > 0) {
      console.error(`[appstate:hr] ${unresolved} izin talebi düşürüldü (employee çözülemedi)`);
    }
  }

  private async insertPayrollItems(
    client: HrProjectionPoolClient,
    items: readonly HrPayrollItemProjection[],
    runIds: ReadonlyMap<string, number>,
    employeeIds: ReadonlyMap<string, number>,
  ): Promise<void> {
    let unresolved = 0;
    for (const item of items) {
      const runId = runIds.get(item.runClientId);
      const employeeId = employeeIds.get(item.employeeClientId);
      if (runId === undefined || employeeId === undefined) {
        unresolved += 1;
        continue;
      }
      // Devralınan koşu/çalışanın CRUD satırıyla (run_id, employee_id) çakışması
      // devralınır — projeksiyon değerleri kazanır.
      await client.query(
        `INSERT INTO hr_payroll_items
           (company_id, run_id, employee_id, gross_salary, sgk_employee, unemployment,
            income_tax, stamp_tax, other_deductions, net_salary, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (run_id, employee_id)
         DO UPDATE SET gross_salary     = EXCLUDED.gross_salary,
                       sgk_employee     = EXCLUDED.sgk_employee,
                       unemployment     = EXCLUDED.unemployment,
                       income_tax       = EXCLUDED.income_tax,
                       stamp_tax        = EXCLUDED.stamp_tax,
                       other_deductions = EXCLUDED.other_deductions,
                       net_salary       = EXCLUDED.net_salary,
                       client_id        = EXCLUDED.client_id,
                       updated_at       = NOW()`,
        [
          item.companyId,
          runId,
          employeeId,
          item.grossSalary,
          item.sgkEmployee,
          item.unemployment,
          item.incomeTax,
          item.stampTax,
          item.otherDeductions,
          item.netSalary,
          item.clientId,
        ],
      );
    }
    if (unresolved > 0) {
      console.error(
        `[appstate:hr] ${unresolved} bordro satırı düşürüldü (run/employee çözülemedi)`,
      );
    }
  }

  private async insertAssetAssignments(
    client: HrProjectionPoolClient,
    assignments: readonly HrAssetAssignmentProjection[],
    assetIds: ReadonlyMap<string, number>,
    employeeIds: ReadonlyMap<string, number>,
  ): Promise<void> {
    let unresolved = 0;
    for (const asg of assignments) {
      const assetId = assetIds.get(asg.assetClientId);
      const employeeId = employeeIds.get(asg.employeeClientId);
      if (assetId === undefined || employeeId === undefined) {
        unresolved += 1;
        continue;
      }
      await client.query(
        `INSERT INTO hr_asset_assignments
           (company_id, asset_id, employee_id, assigned_at, client_id)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5)`,
        [asg.companyId, assetId, employeeId, asg.assignedAt, asg.clientId],
      );
    }
    if (unresolved > 0) {
      console.error(
        `[appstate:hr] ${unresolved} zimmet ataması düşürüldü (asset/employee çözülemedi)`,
      );
    }
  }
}

/** companies'te olmayan company_id'li satırları düşürür (console.error ile raporlar). */
function filterByCompany(projection: HrProjection, known: ReadonlySet<number>): HrProjection {
  const keep = <T extends { companyId: number }>(rows: readonly T[]): T[] =>
    rows.filter((r) => known.has(r.companyId));

  const filtered: HrProjection = {
    orgUnits: keep(projection.orgUnits),
    departments: keep(projection.departments),
    positions: keep(projection.positions),
    employees: keep(projection.employees),
    candidates: keep(projection.candidates),
    applications: keep(projection.applications),
    leaveRequests: keep(projection.leaveRequests),
    payrollRuns: keep(projection.payrollRuns),
    payrollItems: keep(projection.payrollItems),
    assets: keep(projection.assets),
    assetAssignments: keep(projection.assetAssignments),
    dropped: projection.dropped,
  };

  const before =
    projection.orgUnits.length +
    projection.departments.length +
    projection.positions.length +
    projection.employees.length +
    projection.candidates.length +
    projection.applications.length +
    projection.leaveRequests.length +
    projection.payrollRuns.length +
    projection.payrollItems.length +
    projection.assets.length +
    projection.assetAssignments.length;
  const after =
    filtered.orgUnits.length +
    filtered.departments.length +
    filtered.positions.length +
    filtered.employees.length +
    filtered.candidates.length +
    filtered.applications.length +
    filtered.leaveRequests.length +
    filtered.payrollRuns.length +
    filtered.payrollItems.length +
    filtered.assets.length +
    filtered.assetAssignments.length;
  if (before > after) {
    console.error(
      `[appstate:hr] ${before - after} satır düşürüldü (companies'te olmayan company_id) — blob şirket anahtarı sunucu şirketine haritalanamadı`,
    );
  }
  return filtered;
}
