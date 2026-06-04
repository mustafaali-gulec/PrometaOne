/**
 * GetLeaveBalanceUseCase — bir çalışanın içinde bulunulan takvim yılı için
 * yıllık izin bakiyesini hesaplar.
 *
 * Bakiye = entitlement (yıllık hak) − bu yıl onaylanmış 'annual' izin günleri.
 *
 * Kıdem kademeleri (tenure tiers) bilinçli olarak modellenmedi — entitlement
 * sabit DEFAULT_ANNUAL_LEAVE_ENTITLEMENT (14 gün/yıl).
 */
import type { LeaveBalanceDto } from '../dto/LeaveRequestDto.js';
import { EmployeeNotFoundError } from '../errors/HrErrors.js';
import type { Clock } from '../ports/Clock.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';
import type { LeaveRequestRepository } from '../ports/LeaveRequestRepository.js';

/** Varsayılan yıllık ücretli izin hakkı (gün). */
export const DEFAULT_ANNUAL_LEAVE_ENTITLEMENT = 14;

export interface GetLeaveBalanceInput {
  companyId: number;
  employeeId: number;
}

export class GetLeaveBalanceUseCase {
  constructor(
    private readonly leaveRequests: LeaveRequestRepository,
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetLeaveBalanceInput): Promise<LeaveBalanceDto> {
    const employee = await this.employees.findById(input.employeeId, input.companyId);
    if (!employee) {
      throw new EmployeeNotFoundError(input.employeeId);
    }

    const year = this.clock.now().getUTCFullYear();
    const used = await this.leaveRequests.sumApprovedAnnualDays(
      input.employeeId,
      input.companyId,
      year,
    );
    const entitlement = DEFAULT_ANNUAL_LEAVE_ENTITLEMENT;
    const remaining = Math.max(0, entitlement - used);

    return {
      employeeId: input.employeeId,
      year,
      entitlement,
      used,
      remaining,
    };
  }
}
