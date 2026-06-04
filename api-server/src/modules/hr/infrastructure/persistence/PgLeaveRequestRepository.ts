/**
 * PgLeaveRequestRepository — LeaveRequestRepository PG implementasyonu.
 *
 * Tablo: hr_leave_requests (018_hr_leave.sql).
 * Tüm sorgular company_id ile scope'lanır (multi-tenant izolasyon).
 */
import type {
  LeaveRequestRepository,
  NewLeaveRequestInput,
} from '../../application/ports/LeaveRequestRepository.js';
import { LeaveRequest } from '../../domain/entities/LeaveRequest.js';
import type { LeaveStatus } from '../../domain/valueObjects/LeaveStatus.js';
import type { LeaveType } from '../../domain/valueObjects/LeaveType.js';

import type { Queryable } from './Queryable.js';

interface LeaveRequestRow {
  id: number;
  company_id: number;
  employee_id: number;
  leave_type: LeaveType;
  start_date: Date;
  end_date: Date;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  requested_by_user_id: number | null;
  decided_by_user_id: number | null;
  decided_at: Date | null;
  decision_note: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, employee_id, leave_type, start_date, end_date, days, reason, status, ' +
  'requested_by_user_id, decided_by_user_id, decided_at, decision_note, created_at, updated_at';

export class PgLeaveRequestRepository implements LeaveRequestRepository {
  constructor(private readonly pool: Queryable) {}

  async insert(input: NewLeaveRequestInput): Promise<LeaveRequest> {
    const r = await this.pool.query<LeaveRequestRow>(
      `INSERT INTO hr_leave_requests
         (company_id, employee_id, leave_type, start_date, end_date, days,
          reason, status, requested_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.employeeId,
        input.leaveType,
        input.startDate,
        input.endDate,
        input.days,
        input.reason,
        input.status,
        input.requestedByUserId,
      ],
    );
    return rowToLeaveRequest(r.rows[0]!);
  }

  async update(leaveRequest: LeaveRequest): Promise<void> {
    await this.pool.query(
      `UPDATE hr_leave_requests
         SET leave_type = $1,
             start_date = $2,
             end_date = $3,
             days = $4,
             reason = $5,
             status = $6,
             decided_by_user_id = $7,
             decided_at = $8,
             decision_note = $9,
             updated_at = NOW()
       WHERE id = $10 AND company_id = $11`,
      [
        leaveRequest.leaveType,
        leaveRequest.startDate.toISOString().slice(0, 10),
        leaveRequest.endDate.toISOString().slice(0, 10),
        leaveRequest.days,
        leaveRequest.reason,
        leaveRequest.status,
        leaveRequest.decidedByUserId,
        leaveRequest.decidedAt,
        leaveRequest.decisionNote,
        leaveRequest.id,
        leaveRequest.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<LeaveRequest | null> {
    const r = await this.pool.query<LeaveRequestRow>(
      `SELECT ${COLS} FROM hr_leave_requests WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToLeaveRequest(row) : null;
  }

  async list(filter: {
    companyId: number;
    employeeId?: number;
    status?: LeaveStatus;
  }): Promise<ReadonlyArray<LeaveRequest>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [filter.companyId];

    if (filter.employeeId !== undefined) {
      params.push(filter.employeeId);
      conditions.push(`employee_id = $${params.length}`);
    }
    if (filter.status !== undefined) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    const r = await this.pool.query<LeaveRequestRow>(
      `SELECT ${COLS} FROM hr_leave_requests
        WHERE ${conditions.join(' AND ')}
        ORDER BY start_date DESC, id DESC`,
      params,
    );
    return r.rows.map(rowToLeaveRequest);
  }

  async sumApprovedAnnualDays(
    employeeId: number,
    companyId: number,
    year: number,
  ): Promise<number> {
    const r = await this.pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(days), 0)::text AS total FROM hr_leave_requests
        WHERE employee_id = $1
          AND company_id = $2
          AND status = 'approved'
          AND leave_type = 'annual'
          AND EXTRACT(YEAR FROM start_date) = $3`,
      [employeeId, companyId, year],
    );
    return Number(r.rows[0]?.total ?? 0);
  }
}

/**
 * pg, DATE kolonunu yerel-gece-yarisi Date olarak dondurur; toISOString() bunu
 * UTC'ye cevirince (TR icin -3sa) tarih bir gun geri kayar. Takvim parcalarini
 * koruyarak UTC-gece-yarisina sabitliyoruz ki gidis-donus kararli olsun.
 */
function dateColumnToUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function rowToLeaveRequest(row: LeaveRequestRow): LeaveRequest {
  return LeaveRequest.create({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    leaveType: row.leave_type,
    startDate: dateColumnToUtcMidnight(row.start_date),
    endDate: dateColumnToUtcMidnight(row.end_date),
    days: Number(row.days),
    reason: row.reason,
    status: row.status,
    requestedByUserId: row.requested_by_user_id,
    decidedByUserId: row.decided_by_user_id,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
