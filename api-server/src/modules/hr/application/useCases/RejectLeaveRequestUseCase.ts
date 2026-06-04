/**
 * RejectLeaveRequestUseCase — izin talebini reddeder (pending → rejected).
 *
 * Yasak geçişte LeaveRequest entity InvalidLeaveTransitionError fırlatır.
 */
import { toLeaveRequestDto, type LeaveRequestDto } from '../dto/LeaveRequestDto.js';
import { LeaveRequestNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { LeaveRequestRepository } from '../ports/LeaveRequestRepository.js';

export interface RejectLeaveRequestInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  leaveRequestId: number;
  note?: string | null;
}

export class RejectLeaveRequestUseCase {
  constructor(
    private readonly leaveRequests: LeaveRequestRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: RejectLeaveRequestInput): Promise<LeaveRequestDto> {
    const existing = await this.leaveRequests.findById(input.leaveRequestId, input.companyId);
    if (!existing) {
      throw new LeaveRequestNotFoundError(input.leaveRequestId);
    }

    const rejected = existing.reject(this.clock.now(), input.actorUserId, input.note ?? null);
    await this.leaveRequests.update(rejected);

    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.leave.rejected',
      details: {
        id: existing.id,
        employeeId: existing.employeeId,
      },
    });

    return toLeaveRequestDto(rejected);
  }
}
