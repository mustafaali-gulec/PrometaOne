/**
 * ListLeaveRequestsUseCase — izin talepleri listesi
 * (filter: employeeId, status).
 */
import type { LeaveStatus } from '../../domain/valueObjects/LeaveStatus.js';
import { toLeaveRequestDto, type LeaveRequestDto } from '../dto/LeaveRequestDto.js';
import type { LeaveRequestRepository } from '../ports/LeaveRequestRepository.js';

export interface ListLeaveRequestsInput {
  companyId: number;
  employeeId?: number;
  status?: LeaveStatus;
}

export class ListLeaveRequestsUseCase {
  constructor(private readonly leaveRequests: LeaveRequestRepository) {}

  async execute(input: ListLeaveRequestsInput): Promise<ReadonlyArray<LeaveRequestDto>> {
    const filter: { companyId: number; employeeId?: number; status?: LeaveStatus } = {
      companyId: input.companyId,
    };
    if (input.employeeId !== undefined) filter.employeeId = input.employeeId;
    if (input.status !== undefined) filter.status = input.status;
    const list = await this.leaveRequests.list(filter);
    return list.map(toLeaveRequestDto);
  }
}
