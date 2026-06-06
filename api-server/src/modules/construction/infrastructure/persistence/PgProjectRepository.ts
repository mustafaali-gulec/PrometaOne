/**
 * PgProjectRepository — ProjectRepository PG implementasyonu.
 * Tablo: cs_projects (023_cs_projects.sql).
 *
 * DATE alanları ::text ile string ('YYYY-MM-DD') olarak alınır (TZ kayması yok);
 * NUMERIC alanlar string döner, Number() ile çevrilir.
 */
import type {
  ListProjectsOptions,
  NewProjectInput,
  ProjectRepository,
} from '../../application/ports/ProjectRepository.js';
import { Project } from '../../domain/entities/Project.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { ProjectStatus, ProjectType } from '../../domain/valueObjects/ProjectStatus.js';

import type { Queryable } from './Queryable.js';

interface ProjectRow {
  id: number;
  company_id: number;
  code: string;
  name: string;
  project_type: ProjectType;
  status: ProjectStatus;
  org_unit_id: number | null;
  manager_user_id: number | null;
  location: string | null;
  start_date: string | null;
  planned_end: string | null;
  budget_amount: string;
  currency: CurrencyCode;
  active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, code, name, project_type, status, org_unit_id, manager_user_id, location, ' +
  'start_date::text AS start_date, planned_end::text AS planned_end, budget_amount, currency, ' +
  'active, created_by, created_at, updated_at';

export class PgProjectRepository implements ProjectRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewProjectInput): Promise<Project> {
    const r = await this.db.query<ProjectRow>(
      `INSERT INTO cs_projects
         (company_id, code, name, project_type, status, org_unit_id, manager_user_id,
          location, start_date, planned_end, budget_amount, currency, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.code,
        input.name,
        input.projectType,
        input.status,
        input.orgUnitId,
        input.managerUserId,
        input.location,
        input.startDate,
        input.plannedEnd,
        input.budgetAmount,
        input.currency,
        input.createdBy,
      ],
    );
    return rowToProject(r.rows[0]!);
  }

  async update(project: Project): Promise<void> {
    await this.db.query(
      `UPDATE cs_projects
         SET name = $1, project_type = $2, status = $3, org_unit_id = $4, manager_user_id = $5,
             location = $6, start_date = $7, planned_end = $8, budget_amount = $9,
             currency = $10, active = $11, updated_at = NOW()
       WHERE id = $12 AND company_id = $13`,
      [
        project.name,
        project.projectType,
        project.status,
        project.orgUnitId,
        project.managerUserId,
        project.location,
        project.startDate,
        project.plannedEnd,
        project.budgetAmount,
        project.currency,
        project.active,
        project.id,
        project.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Project | null> {
    const r = await this.db.query<ProjectRow>(
      `SELECT ${COLS} FROM cs_projects WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToProject(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: ListProjectsOptions,
  ): Promise<ReadonlyArray<Project>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.includeInactive !== true) {
      conditions.push('active = TRUE');
    }
    if (options?.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options?.projectType) {
      params.push(options.projectType);
      conditions.push(`project_type = $${params.length}`);
    }
    if (options?.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }
    const r = await this.db.query<ProjectRow>(
      `SELECT ${COLS} FROM cs_projects
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC, id DESC`,
      params,
    );
    return r.rows.map(rowToProject);
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, code];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM cs_projects WHERE company_id = $1 AND code = $2`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.db.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }
}

function rowToProject(row: ProjectRow): Project {
  return Project.create({
    id: Number(row.id),
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    projectType: row.project_type,
    status: row.status,
    orgUnitId: row.org_unit_id,
    managerUserId: row.manager_user_id,
    location: row.location,
    startDate: row.start_date,
    plannedEnd: row.planned_end,
    budgetAmount: Number(row.budget_amount),
    currency: row.currency,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
