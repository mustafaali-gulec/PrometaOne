/**
 * HireEmployeeUseCase — yeni Employee işe alır.
 *
 * Akış:
 *   1. departmentId aktif Department'a karşılık geliyor mu? (yoksa hata)
 *   2. positionId varsa Position var ve aynı şirkette mi?
 *   3. employeeNo verildiyse onu kullan; yoksa EmployeeNumberGenerator ile üret
 *   4. tcKimlik (varsa) entity tarafından validate edilir
 *   5. phone (varsa) PhoneNumber tarafından normalize edilir
 *   6. user_id verildiyse UserLookupPort ile doğrula (aktif kullanıcı olmalı) ve
 *      başka bir Employee'ye bağlı olmamalı
 *   7. Repository insert (UNIQUE çakışmaları yakala)
 *   8. Audit log
 *
 * Default status: 'probation'. Default employmentType: 'full_time'.
 */
import type { EmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';
import type { EmployeeStatus } from '../../domain/valueObjects/EmployeeStatus.js';
import type { EmploymentType } from '../../domain/valueObjects/EmploymentType.js';
import { PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';
import { TcKimlik } from '../../domain/valueObjects/TcKimlik.js';
import { toEmployeeDto, type EmployeeDto } from '../dto/EmployeeDto.js';
import {
  DepartmentNotFoundError,
  EmployeeNumberAlreadyExistsError,
  PositionCompanyMismatchError,
  PositionNotFoundError,
  UserAlreadyLinkedToEmployeeError,
  UserNotFoundForLinkError,
} from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { Clock } from '../ports/Clock.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';
import type { PositionRepository } from '../ports/PositionRepository.js';
import type { UserLookupPort } from '../ports/UserLookupPort.js';

export interface HireEmployeeInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  departmentId: number;
  positionId: number | null;
  /** Verilmezse generator ile üretilir. */
  employeeNo?: string;
  firstName: string;
  lastName: string;
  tcKimlik?: string | null;
  email?: string | null;
  phone?: string | null;
  /** ISO date YYYY-MM-DD veya Date. */
  hireDate: string | Date;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  userId?: number | null;
  /** İşe alımın bağlı olduğu Application id'si (Recruitment akışından gelir). */
  sourceApplicationId?: number | null;
}

export class HireEmployeeUseCase {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly departments: DepartmentRepository,
    private readonly positions: PositionRepository,
    private readonly users: UserLookupPort,
    private readonly employeeNumberGen: EmployeeNumberGenerator,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: HireEmployeeInput): Promise<EmployeeDto> {
    // 1. Department
    const dept = await this.departments.findById(input.departmentId, input.companyId);
    if (!dept) {
      throw new DepartmentNotFoundError(input.departmentId);
    }

    // 2. Position (opsiyonel)
    if (input.positionId !== null && input.positionId !== undefined) {
      const pos = await this.positions.findById(input.positionId, input.companyId);
      if (!pos) {
        throw new PositionNotFoundError(input.positionId);
      }
      if (pos.companyId !== input.companyId) {
        throw new PositionCompanyMismatchError(input.positionId, input.companyId);
      }
    }

    // 3. employeeNo — verilmediyse generator
    let employeeNo: string;
    if (input.employeeNo !== undefined) {
      // Çakışma erken kontrolü (insert yine de UNIQUE constraint yakalayacak)
      const existing = await this.employees.findByEmployeeNo(input.employeeNo, input.companyId);
      if (existing) {
        throw new EmployeeNumberAlreadyExistsError(input.employeeNo, input.companyId);
      }
      employeeNo = input.employeeNo;
    } else {
      const generated = await this.employeeNumberGen.next(input.companyId);
      employeeNo = generated.value;
    }

    // 4. tcKimlik/phone validation (verilirse)
    if (input.tcKimlik !== undefined && input.tcKimlik !== null) {
      TcKimlik.create(input.tcKimlik);
    }
    let normalizedPhone: string | null = null;
    if (input.phone !== undefined && input.phone !== null) {
      normalizedPhone = PhoneNumber.create(input.phone).value;
    }

    // 5. userId (opsiyonel link)
    if (input.userId !== undefined && input.userId !== null) {
      const u = await this.users.findById(input.userId);
      if (!u || !u.active) {
        throw new UserNotFoundForLinkError(input.userId);
      }
      const existing = await this.employees.findByUserId(input.userId, input.companyId);
      if (existing) {
        throw new UserAlreadyLinkedToEmployeeError(input.userId, existing.id);
      }
    }

    // 6. hireDate normalize
    const hireDateStr =
      typeof input.hireDate === 'string'
        ? input.hireDate
        : input.hireDate.toISOString().slice(0, 10);

    // 7. Insert
    const created = await this.employees.insert({
      companyId: input.companyId,
      userId: input.userId ?? null,
      departmentId: input.departmentId,
      positionId: input.positionId ?? null,
      employeeNo,
      firstName: input.firstName,
      lastName: input.lastName,
      tcKimlik: input.tcKimlik ?? null,
      email: input.email ?? null,
      phone: normalizedPhone,
      hireDate: hireDateStr,
      status: input.status ?? 'probation',
      employmentType: input.employmentType ?? 'full_time',
      sourceApplicationId: input.sourceApplicationId ?? null,
    });

    // 8. Audit
    await this.audit.log({
      at: this.clock.now(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.employee.hired',
      details: {
        id: created.id,
        employeeNo: created.employeeNo.value,
        fullName: created.fullName,
        departmentId: created.departmentId,
        positionId: created.positionId,
      },
    });

    return toEmployeeDto(created);
  }
}
