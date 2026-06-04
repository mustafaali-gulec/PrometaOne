/**
 * LeaveRequestRepository — port.
 *
 * Concrete: infrastructure/persistence/PgLeaveRequestRepository.ts.
 */
import type { LeaveRequest } from '../../domain/entities/LeaveRequest.js';
import type { LeaveStatus } from '../../domain/valueObjects/LeaveStatus.js';
import type { LeaveType } from '../../domain/valueObjects/LeaveType.js';

export interface LeaveRequestRepository {
  insert(input: NewLeaveRequestInput): Promise<LeaveRequest>;

  update(leaveRequest: LeaveRequest): Promise<void>;

  findById(id: number, companyId: number): Promise<LeaveRequest | null>;

  list(filter: {
    companyId: number;
    employeeId?: number;
    status?: LeaveStatus;
  }): Promise<ReadonlyArray<LeaveRequest>>;

  /**
   * Bir çalışanın belirli bir takvim yılında ONAYLANMIŞ (approved) 'annual'
   * izin gün toplamı — bakiye hesabı için.
   */
  sumApprovedAnnualDays(employeeId: number, companyId: number, year: number): Promise<number>;
}

export interface NewLeaveRequestInput {
  companyId: number;
  employeeId: number;
  leaveType: LeaveType;
  /** ISO date string YYYY-MM-DD. */
  startDate: string;
  /** ISO date string YYYY-MM-DD. */
  endDate: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  requestedByUserId: number | null;
}
