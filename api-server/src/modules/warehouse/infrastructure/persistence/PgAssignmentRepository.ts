/**
 * PgAssignmentRepository — AssignmentRepository PG implementasyonu.
 * Tablo: assignments (items JSONB kolonunda taşınır).
 *
 * items çocuk koleksiyonu JSONB olarak saklanır; entity aggregate olarak
 * serialize eder. Tüm sorgular company_id ile multi-tenant izole edilir.
 */
import type { Pool } from 'pg';

import type {
  AssignmentRepository,
  NewAssignmentInput,
} from '../../application/ports/AssignmentRepository.js';
import { Assignment, type AssignmentItem } from '../../domain/entities/Assignment.js';
import type { AssignmentStatus } from '../../domain/valueObjects/AuxStatuses.js';

interface AssignmentRow {
  id: number;
  company_id: number;
  no: string;
  date: Date | string;
  person: string | null;
  birim: string | null;
  status: AssignmentStatus;
  items: RawItem[] | null;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

interface RawItem {
  materialId: number;
  warehouseId: number;
  qty: number | string;
}

const ASSIGNMENT_COLS =
  'id, company_id, no, date, person, birim, status, items, note, created_at, updated_at';

export class PgAssignmentRepository implements AssignmentRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewAssignmentInput): Promise<Assignment> {
    const r = await this.pool.query<AssignmentRow>(
      `INSERT INTO assignments
         (company_id, no, date, person, birim, status, items, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING ${ASSIGNMENT_COLS}`,
      [
        input.companyId,
        input.no,
        input.date,
        input.person,
        input.birim,
        input.status,
        JSON.stringify(input.items),
        input.note,
      ],
    );
    return rowToAssignment(r.rows[0]!);
  }

  async update(assignment: Assignment): Promise<void> {
    await this.pool.query(
      `UPDATE assignments
          SET date = $1, person = $2, birim = $3, status = $4, items = $5::jsonb,
              note = $6, updated_at = NOW()
        WHERE id = $7 AND company_id = $8`,
      [
        assignment.date,
        assignment.person,
        assignment.birim,
        assignment.status,
        JSON.stringify(assignment.items),
        assignment.note,
        assignment.id,
        assignment.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Assignment | null> {
    const r = await this.pool.query<AssignmentRow>(
      `SELECT ${ASSIGNMENT_COLS} FROM assignments WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToAssignment(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { status?: AssignmentStatus },
  ): Promise<ReadonlyArray<Assignment>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.status !== undefined) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    const r = await this.pool.query<AssignmentRow>(
      `SELECT ${ASSIGNMENT_COLS} FROM assignments
        WHERE ${conditions.join(' AND ')}
        ORDER BY date DESC, id DESC`,
      params,
    );
    return r.rows.map(rowToAssignment);
  }

  async nextSequence(companyId: number, year: number): Promise<number> {
    const r = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM assignments
        WHERE company_id = $1
          AND date >= make_date($2, 1, 1) AND date < make_date($2 + 1, 1, 1)`,
      [companyId, year],
    );
    return Number(r.rows[0]?.count ?? 0) + 1;
  }
}

function toDateStr(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function rowToAssignment(row: AssignmentRow): Assignment {
  return Assignment.create({
    id: row.id,
    companyId: row.company_id,
    no: row.no,
    date: toDateStr(row.date),
    person: row.person,
    birim: row.birim,
    status: row.status,
    items: (row.items ?? []).map(
      (it): AssignmentItem => ({
        materialId: it.materialId,
        warehouseId: it.warehouseId,
        qty: Number(it.qty),
      }),
    ),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
