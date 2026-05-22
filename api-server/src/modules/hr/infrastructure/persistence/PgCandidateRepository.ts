/**
 * PgCandidateRepository — CandidateRepository PG implementasyonu.
 *
 * Tablo: candidates (012_hr.sql).
 */
import type { Pool } from 'pg';

import type {
  CandidateRepository,
  NewCandidateInput,
} from '../../application/ports/CandidateRepository.js';
import { Candidate } from '../../domain/entities/Candidate.js';
import type { CandidateSource } from '../../domain/valueObjects/CandidateSource.js';
import { PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';

interface CandidateRow {
  id: number;
  company_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  source: CandidateSource;
  cv_url: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, first_name, last_name, email, phone, source, cv_url, notes, created_at, updated_at';

export class PgCandidateRepository implements CandidateRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewCandidateInput): Promise<Candidate> {
    const r = await this.pool.query<CandidateRow>(
      `INSERT INTO candidates
         (company_id, first_name, last_name, email, phone, source, cv_url, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.firstName,
        input.lastName,
        input.email,
        input.phone,
        input.source,
        input.cvUrl,
        input.notes,
      ],
    );
    return rowToCandidate(r.rows[0]!);
  }

  async update(candidate: Candidate): Promise<void> {
    await this.pool.query(
      `UPDATE candidates
         SET first_name = $1,
             last_name = $2,
             email = $3,
             phone = $4,
             source = $5,
             cv_url = $6,
             notes = $7,
             updated_at = NOW()
       WHERE id = $8 AND company_id = $9`,
      [
        candidate.firstName,
        candidate.lastName,
        candidate.email,
        candidate.phone?.value ?? null,
        candidate.source,
        candidate.cvUrl,
        candidate.notes,
        candidate.id,
        candidate.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Candidate | null> {
    const r = await this.pool.query<CandidateRow>(
      `SELECT ${COLS} FROM candidates WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToCandidate(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { source?: CandidateSource; q?: string },
  ): Promise<ReadonlyArray<Candidate>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];

    if (options?.source !== undefined) {
      params.push(options.source);
      conditions.push(`source = $${params.length}`);
    }
    if (options?.q !== undefined && options.q.trim().length > 0) {
      params.push(`%${options.q.toLowerCase()}%`);
      conditions.push(
        `(LOWER(first_name) LIKE $${params.length}
         OR LOWER(last_name) LIKE $${params.length}
         OR LOWER(email::text) LIKE $${params.length})`,
      );
    }

    const r = await this.pool.query<CandidateRow>(
      `SELECT ${COLS} FROM candidates
        WHERE ${conditions.join(' AND ')}
        ORDER BY last_name ASC, first_name ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToCandidate);
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.pool.query(`DELETE FROM candidates WHERE id = $1 AND company_id = $2`, [
      id,
      companyId,
    ]);
  }
}

function rowToCandidate(row: CandidateRow): Candidate {
  return Candidate.create({
    id: row.id,
    companyId: row.company_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone ? PhoneNumber.create(row.phone) : null,
    source: row.source,
    cvUrl: row.cv_url,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
