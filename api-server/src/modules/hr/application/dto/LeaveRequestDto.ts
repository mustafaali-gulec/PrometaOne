/**
 * LeaveRequestDto — REST response için.
 */
import type { LeaveRequest } from '../../domain/entities/LeaveRequest.js';
import type { LeaveStatus } from '../../domain/valueObjects/LeaveStatus.js';
import type { LeaveType } from '../../domain/valueObjects/LeaveType.js';

export interface LeaveRequestDto {
  id: number;
  companyId: number;
  employeeId: number;
  leaveType: LeaveType;
  /** YYYY-MM-DD. */
  startDate: string;
  /** YYYY-MM-DD. */
  endDate: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  requestedByUserId: number | null;
  decidedByUserId: number | null;
  /** ISO timestamp veya null. */
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalanceDto {
  employeeId: number;
  year: number;
  /** Yıllık hak edilen izin (gün). */
  entitlement: number;
  /** Bu yıl onaylanmış 'annual' izin gün toplamı. */
  used: number;
  /** entitlement - used (negatife düşmez). */
  remaining: number;
}

export function toLeaveRequestDto(lr: LeaveRequest): LeaveRequestDto {
  return {
    id: lr.id,
    companyId: lr.companyId,
    employeeId: lr.employeeId,
    leaveType: lr.leaveType,
    startDate: lr.startDate.toISOString().slice(0, 10),
    endDate: lr.endDate.toISOString().slice(0, 10),
    days: lr.days,
    reason: lr.reason,
    status: lr.status,
    requestedByUserId: lr.requestedByUserId,
    decidedByUserId: lr.decidedByUserId,
    decidedAt: lr.decidedAt ? lr.decidedAt.toISOString() : null,
    decisionNote: lr.decisionNote,
    createdAt: lr.createdAt.toISOString(),
    updatedAt: lr.updatedAt.toISOString(),
  };
}
