/**
 * CancelLeaveRequestUseCase — izin talebini iptal eder
 * (pending|approved → cancelled).
 *
 * Yasak geçişte LeaveRequest entity InvalidLeaveTransitionError fırlatır.
 * auth (sadece) gerektirir — çalışan kendi talebini iptal edebilir.
 */
import { toLeaveRequestDto, type LeaveRequestDto } from '../dto/LeaveRequestDto.js';
import { LeaveRequestNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { LeaveRequestRepository } from '../ports/LeaveRequestRepository.js';

export interface CancelLeaveRequestInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  leaveRequestId: number;
  note?: string | null;
}

export class CancelLeaveRequestUseCase {
  constructor(
    private readonly leaveRequests: LeaveRequestRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: CancelLeaveRequestInput): Promise<LeaveRequestDto> {
    const existing = await this.leaveRequests.findById(input.leaveRequestId, input.companyId);
    if (!existing) {
      throw new LeaveRequestNotFoundError(input.leaveRequestId);
    }

    const cancelled = existing.cancel(this.clock.now(), input.actorUserId, input.note ?? null);
    await this.leaveRequests.update(cancelled);

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.leave.cancelled',
      details: {
        id: existing.id,
        employeeId: existing.employeeId,
        previousStatus: existing.status,
      },
    });

    return toLeaveRequestDto(cancelled);
  }
}
