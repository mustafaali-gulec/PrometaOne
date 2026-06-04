/**
 * RequestLeaveUseCase — yeni izin talebi oluşturur (status 'pending').
 *
 * Akış:
 *   1. employee var ve aynı şirkette mi? (yoksa hata)
 *   2. start/end tarihleri parse edilir; gün sayısı LeaveDaysCalculator ile (inclusive)
 *   3. Repository insert
 *   4. Audit log
 *
 * Çalışan kendi talebini açabildiği için (self-service) actor zorunlu değil.
 */
import { LeaveDaysCalculator } from '../../domain/services/LeaveDaysCalculator.js';
import type { LeaveType } from '../../domain/valueObjects/LeaveType.js';
import { toLeaveRequestDto, type LeaveRequestDto } from '../dto/LeaveRequestDto.js';
import { EmployeeNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';
import type { LeaveRequestRepository } from '../ports/LeaveRequestRepository.js';

export interface RequestLeaveInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  employeeId: number;
  leaveType: LeaveType;
  /** ISO date YYYY-MM-DD. */
  startDate: string;
  /** ISO date YYYY-MM-DD. */
  endDate: string;
  reason?: string | null;
}

export class RequestLeaveUseCase {
  constructor(
    private readonly leaveRequests: LeaveRequestRepository,
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: RequestLeaveInput): Promise<LeaveRequestDto> {
    // 1. Employee
    const employee = await this.employees.findById(input.employeeId, input.companyId);
    if (!employee) {
      throw new EmployeeNotFoundError(input.employeeId);
    }

    // 2. Tarihler + gün sayısı
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    const days = LeaveDaysCalculator.days(start, end);

    // 3. Insert
    const created = await this.leaveRequests.insert({
      companyId: input.companyId,
      employeeId: input.employeeId,
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      days,
      reason: input.reason ?? null,
      status: 'pending',
      requestedByUserId: input.actorUserId,
    });

    // 4. Audit
    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.leave.requested',
      details: {
        id: created.id,
        employeeId: created.employeeId,
        leaveType: created.leaveType,
        days: created.days,
        startDate: created.startDate.toISOString().slice(0, 10),
        endDate: created.endDate.toISOString().slice(0, 10),
      },
    });

    return toLeaveRequestDto(created);
  }
}
