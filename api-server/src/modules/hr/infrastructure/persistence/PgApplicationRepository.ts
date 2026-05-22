/**
 * PgApplicationRepository — ApplicationRepository PG implementasyonu.
 *
 * Tablo: applications (012_hr.sql). Stage geçişlerini takip eden trigger
 * application_stage_history'yi otomatik doldurur.
 */
import type { Pool } from 'pg';

import type {
  ApplicationRepository,
  NewApplicationInput,
} from '../../application/ports/ApplicationRepository.js';
import { Application } from '../../domain/entities/Application.js';
import {
  TERMINAL_STAGES,
  type RecruitmentStage,
} from '../../domain/valueObjects/RecruitmentStage.js';

interface ApplicationRow {
  id: number;
  company_id: number;
  candidate_id: number;
  position_id: number;
  stage: RecruitmentStage;
  stage_changed_at: Date;
  stage_changed_by: number | null;
  rejection_reason: string | null;
  salary_expectation: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, candidate_id, position_id, stage, stage_changed_at, stage_changed_by, ' +
  'rejection_reason, salary_expectation, notes, created_at, updated_at';

const TERMINAL_LIST = TERMINAL_STAGES.map((s) => `'${s}'`).join(',');

export class PgApplicationRepository implements ApplicationRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewApplicationInput): Promise<Application> {
    const r = await this.pool.query<ApplicationRow>(
      `INSERT INTO applications
         (company_id, candidate_id, position_id, stage, stage_changed_by,
          rejection_reason, salary_expectation, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.candidateId,
        input.positionId,
        input.stage,
        input.stageChangedBy,
        input.rejectionReason,
        input.salaryExpectation,
        input.notes,
      ],
    );
    return rowToApplication(r.rows[0]!);
  }

  async update(application: Application): Promise<void> {
    await this.pool.query(
      `UPDATE applications
         SET stage = $1,
             stage_changed_at = $2,
             stage_changed_by = $3,
             rejection_reason = $4,
             salary_expectation = $5,
             notes = $6,
             updated_at = NOW()
       WHERE id = $7 AND company_id = $8`,
      [
        application.stage,
        application.stageChangedAt,
        application.stageChangedBy,
        application.rejectionReason,
        application.salaryExpectation,
        application.notes,
        application.id,
        application.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Application | null> {
    const r = await this.pool.query<ApplicationRow>(
      `SELECT ${COLS} FROM applications WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToApplication(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { positionId?: number; candidateId?: number; stage?: RecruitmentStage },
  ): Promise<ReadonlyArray<Application>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];

    if (options?.positionId !== undefined) {
      params.push(options.positionId);
      conditions.push(`position_id = $${params.length}`);
    }
    if (options?.candidateId !== undefined) {
      params.push(options.candidateId);
      conditions.push(`candidate_id = $${params.length}`);
    }
    if (options?.stage !== undefined) {
      params.push(options.stage);
      conditions.push(`stage = $${params.length}`);
    }

    const r = await this.pool.query<ApplicationRow>(
      `SELECT ${COLS} FROM applications
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC, id DESC`,
      params,
    );
    return r.rows.map(rowToApplication);
  }

  async countByStage(
    companyId: number,
    options?: { positionId?: number },
  ): Promise<ReadonlyMap<RecruitmentStage, number>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.positionId !== undefined) {
      params.push(options.positionId);
      conditions.push(`position_id = $${params.length}`);
    }
    const r = await this.pool.query<{ stage: RecruitmentStage; n: string }>(
      `SELECT stage, COUNT(*)::text AS n FROM applications
        WHERE ${conditions.join(' AND ')}
        GROUP BY stage`,
      params,
    );
    const map = new Map<RecruitmentStage, number>();
    for (const row of r.rows) {
      map.set(row.stage, Number(row.n));
    }
    return map;
  }

  async hasActiveApplicationsForCandidate(
    candidateId: number,
    companyId: number,
  ): Promise<boolean> {
    const r = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM applications
          WHERE candidate_id = $1
            AND company_id = $2
            AND stage NOT IN (${TERMINAL_LIST})
       ) AS exists`,
      [candidateId, companyId],
    );
    return r.rows[0]?.exists ?? false;
  }
}

function rowToApplication(row: ApplicationRow): Application {
  return Application.create({
    id: row.id,
    companyId: row.company_id,
    candidateId: row.candidate_id,
    positionId: row.position_id,
    stage: row.stage,
    stageChangedAt: row.stage_changed_at,
    stageChangedBy: row.stage_changed_by,
    rejectionReason: row.rejection_reason,
    salaryExpectation: row.salary_expectation === null ? null : Number(row.salary_expectation),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
