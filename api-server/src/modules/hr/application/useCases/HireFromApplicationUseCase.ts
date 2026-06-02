/**
 * HireFromApplicationUseCase — Application'ı 'hired' stage'ine taşır VE
 * aynı atomik transaction içinde Employee oluşturur.
 *
 * Atomik garanti (Faz 4-bis — UnitOfWork pattern):
 *   - Tek bir DB transaction içinde Application UPDATE + Employee INSERT
 *     `UnitOfWork.withTransaction` üzerinden yürütülür.
 *   - `fn` throw ederse PG ROLLBACK yapar; Application asla 'hired'da
 *     kalmaz ve Employee asla yarım kalmış olmaz.
 *
 * Karar dokümanı: docs/adr/0006-unit-of-work-pattern.md
 *
 * Akış:
 *   1. (uow dışı) Application var ve aynı şirkette + stage = 'offer' olmalı.
 *   2. (uow dışı) Candidate var ve aynı şirkette.
 *   3. (uow dışı) Department var ve aynı şirkette.
 *   4. employeeNo verilirse çakışma kontrolü; yoksa generator.
 *   5. (uow içi) Application 'hired' transition + applications.update.
 *   6. (uow içi) HireFromApplicationPolicy → NewEmployeeInput → employees.insert.
 *   7. (uow dışı) Audit log.
 */
import type { EmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';
import { HireFromApplicationPolicy } from '../../domain/services/HireFromApplicationPolicy.js';
import type { EmployeeStatus } from '../../domain/valueObjects/EmployeeStatus.js';
import type { EmploymentType } from '../../domain/valueObjects/EmploymentType.js';
import { toEmployeeDto, type EmployeeDto } from '../dto/EmployeeDto.js';
import {
  ApplicationAlreadyTerminalError,
  ApplicationNotFoundError,
  CandidateNotFoundError,
  DepartmentNotFoundError,
  EmployeeNumberAlreadyExistsError,
} from '../errors/HrErrors.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { CandidateRepository } from '../ports/CandidateRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';
import type { UnitOfWork } from '../ports/UnitOfWork.js';

export interface HireFromApplicationInput {
  actorUserId: number | null;
  actorUsername: string | null;
  companyId: number;
  applicationId: number;
  /** Hedef departman — Application'da yok, hire-time'da seçilir. */
  departmentId: number;
  /** Verilmezse generator üretir. */
  employeeNo?: string;
  /** ISO date YYYY-MM-DD veya Date. */
  hireDate: string | Date;
  /** Default 'probation'. */
  status?: EmployeeStatus;
  /** Default 'full_time'. */
  employmentType?: EmploymentType;
  /** TC Kimlik (opsiyonel). */
  tcKimlik?: string | null;
  /** Sistem hesabı bağı (opsiyonel). */
  userId?: number | null;
}

export class HireFromApplicationUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly candidates: CandidateRepository,
    private readonly departments: DepartmentRepository,
    private readonly employeeNumberGen: EmployeeNumberGenerator,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: HireFromApplicationInput): Promise<EmployeeDto> {
    // ------------------------------------------------------------------
    // (uow dışı) Read-only lookups — Candidate ve Department.
    // ------------------------------------------------------------------
    // Not: Application okuma, transaction'ın içine konuldu (5) çünkü stage
    // transition'ı yapıp UPDATE etmek de aynı transaction'da olmalı —
    // okuma-uw-yazma yarışı önlenir.
    const candidatePromise = this.candidates.findById.bind(this.candidates);
    const departmentPromise = this.departments.findById.bind(this.departments);

    const dept = await departmentPromise(input.departmentId, input.companyId);
    if (!dept) {
      throw new DepartmentNotFoundError(input.departmentId);
    }

    // ------------------------------------------------------------------
    // (uow içi) ATOMIK BÖLGE.
    // ------------------------------------------------------------------
    const result = await this.uow.withTransaction(async (repos) => {
      // 1. Application — aynı transaction'da read.
      const application = await repos.applications.findById(input.applicationId, input.companyId);
      if (!application) {
        throw new ApplicationNotFoundError(input.applicationId);
      }
      if (application.isTerminal()) {
        throw new ApplicationAlreadyTerminalError(application.id, application.stage);
      }

      // 2. Candidate — read-only ama tutarlılık için aynı transaction'da.
      const candidate = await candidatePromise(application.candidateId, input.companyId);
      if (!candidate) {
        throw new CandidateNotFoundError(application.candidateId);
      }

      // 3. employeeNo — verilmediyse generator; verildiyse çakışma kontrolü.
      let employeeNo: string;
      if (input.employeeNo !== undefined) {
        const existing = await repos.employees.findByEmployeeNo(input.employeeNo, input.companyId);
        if (existing) {
          throw new EmployeeNumberAlreadyExistsError(input.employeeNo, input.companyId);
        }
        employeeNo = input.employeeNo;
      } else {
        const gen = await this.employeeNumberGen.next(input.companyId);
        employeeNo = gen.value;
      }

      // 4. Application 'hired' transition (entity invariant).
      const hiredApp = application.transitionTo('hired', this.clock.now(), input.actorUserId);

      // 5. NewEmployeeInput hesapla.
      const hireDateStr =
        typeof input.hireDate === 'string'
          ? input.hireDate
          : input.hireDate.toISOString().slice(0, 10);

      const newEmpInput = HireFromApplicationPolicy.toNewEmployeeInput({
        candidate,
        application,
        departmentId: input.departmentId,
        employeeNo,
        hireDate: hireDateStr,
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
        ...(input.tcKimlik !== undefined ? { tcKimlik: input.tcKimlik } : {}),
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
      });

      // 6. Atomik yazımlar.
      await repos.applications.update(hiredApp);

      let createdEmployee;
      try {
        createdEmployee = await repos.employees.insert(newEmpInput);
      } catch (err) {
        // UNIQUE çakışmasını semantik hataya map'le; PG ROLLBACK'i UoW yapar.
        if (
          err instanceof Error &&
          (err as Error & { code?: string }).code === '23505' &&
          err.message.includes('uq_employees_company_employee_no')
        ) {
          throw new EmployeeNumberAlreadyExistsError(employeeNo, input.companyId);
        }
        throw err;
      }

      return { application, candidate, createdEmployee };
    });

    // ------------------------------------------------------------------
    // (uow dışı) Audit log — transaction COMMIT olduktan sonra.
    // ------------------------------------------------------------------
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.application.hired',
      details: {
        applicationId: result.application.id,
        candidateId: result.candidate.id,
        positionId: result.application.positionId,
        employeeId: result.createdEmployee.id,
        employeeNo: result.createdEmployee.employeeNo.value,
      },
      at: this.clock.now(),
    });

    return toEmployeeDto(result.createdEmployee);
  }
}
