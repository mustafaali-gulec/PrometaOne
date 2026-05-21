/**
 * UpdateEmployeeProfileUseCase — Employee profil bilgileri (isim, email, telefon, tc kimlik).
 * Status, departman, pozisyon, user link burada DEĞİL.
 */
import type { EmploymentType } from '../../domain/valueObjects/EmploymentType.js';
import { PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';
import { TcKimlik } from '../../domain/valueObjects/TcKimlik.js';
import { toEmployeeDto, type EmployeeDto } from '../dto/EmployeeDto.js';
import { EmployeeNotFoundError } from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';

export interface UpdateEmployeeProfileInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  /** Raw — VO normalize eder. null → bağı kopar. */
  phone?: string | null;
  /** Raw 11 hane. null → bağı kopar. */
  tcKimlik?: string | null;
  employmentType?: EmploymentType;
}

export class UpdateEmployeeProfileUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: UpdateEmployeeProfileInput): Promise<EmployeeDto> {
    const existing = await this.employees.findById(input.id, input.companyId);
    if (!existing) {
      throw new EmployeeNotFoundError(input.id);
    }

    const updates: Parameters<typeof existing.updateProfile>[0] = {};
    if (input.firstName !== undefined) updates.firstName = input.firstName;
    if (input.lastName !== undefined) updates.lastName = input.lastName;
    if (input.email !== undefined) updates.email = input.email;
    if (input.phone !== undefined) {
      updates.phone = input.phone === null ? null : PhoneNumber.create(input.phone);
    }
    if (input.tcKimlik !== undefined) {
      updates.tcKimlik = input.tcKimlik === null ? null : TcKimlik.create(input.tcKimlik);
    }
    if (input.employmentType !== undefined) updates.employmentType = input.employmentType;

    const updated = existing.updateProfile(updates, this.clock.now());
    if (updated === existing) {
      return toEmployeeDto(existing);
    }

    await this.employees.update(updated);
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.employee.profile_updated',
      details: { id: updated.id },
    });

    return toEmployeeDto(updated);
  }
}
