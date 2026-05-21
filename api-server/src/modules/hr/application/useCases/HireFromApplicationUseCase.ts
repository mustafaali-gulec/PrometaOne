/**
 * HireFromApplicationUseCase — Application'ı 'hired' stage'ine taşır VE
 * aynı transaction'da Employee oluşturur.
 *
 * Atomik garanti (Faz 4 / PR 4 — infrastructure katmanı):
 *   - Aynı DB transaction içinde Application UPDATE + Employee INSERT
 *   - Employee oluşturulamazsa Application 'hired' rollback (Unit of Work)
 *
 * PR 3 (bu): fake repository'ler in-memory; transaction sözleşmesi simüle
 * edilir — Employee oluşumu hata fırlatırsa Application yine ilk haline
 * geri çevrilir (manuel rollback).
 *
 * Akış:
 *   1. Application var ve aynı şirkette + stage = 'offer' olmalı
 *   2. Candidate var ve aynı şirkette
 *   3. Department var ve aynı şirkette
 *   4. employeeNo verilirse çakışma kontrolü; yoksa generator
 *   5. Application → 'hired' transition
 *   6. HireFromApplicationPolicy → NewEmployeeInput
 *   7. EmployeeRepository.insert (UNIQUE çakışmaları yakala — rollback yap)
 *   8. Audit log
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
import type { ApplicationRepository } from '../ports/ApplicationRepository.js';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { CandidateRepository } from '../ports/CandidateRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { DepartmentRepository } from '../ports/DepartmentRepository.js';
import type { EmployeeRepository } from '../ports/EmployeeRepository.js';

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
    private readonly applications: ApplicationRepository,
    private readonly candidates: CandidateRepository,
    private readonly departments: DepartmentRepository,
    private readonly employees: EmployeeRepository,
    private readonly employeeNumberGen: EmployeeNumberGenerator,
    private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: HireFromApplicationInput): Promise<EmployeeDto> {
    // 1. Application
    const application = await this.applications.findById(input.applicationId, input.companyId);
    if (!application) {
      throw new ApplicationNotFoundError(input.applicationId);
    }
    if (application.isTerminal()) {
      throw new ApplicationAlreadyTerminalError(application.id, application.stage);
    }
    // Domain entity zaten 'offer' dışından 'hired'ı reddedecek (transitionTo).
    // Burada early check ek güvenlik için yapılmıyor — entity yapsın.

    // 2. Candidate
    const candidate = await this.candidates.findById(application.candidateId, input.companyId);
    if (!candidate) {
      throw new CandidateNotFoundError(application.candidateId);
    }

    // 3. Department
    const dept = await this.departments.findById(input.departmentId, input.companyId);
    if (!dept) {
      throw new DepartmentNotFoundError(input.departmentId);
    }

    // 4. employeeNo — verilmediyse generator
    let employeeNo: string;
    if (input.employeeNo !== undefined) {
      const existing = await this.employees.findByEmployeeNo(input.employeeNo, input.companyId);
      if (existing) {
        throw new EmployeeNumberAlreadyExistsError(input.employeeNo, input.companyId);
      }
      employeeNo = input.employeeNo;
    } else {
      const gen = await this.employeeNumberGen.next(input.companyId);
      employeeNo = gen.value;
    }

    // 5. Application 'hired' transition
    //    (entity yasak geçişleri InvalidStageTransitionError ile fırlatır)
    const hiredApp = application.transitionTo('hired', this.clock.now(), input.actorUserId);

    // 6. NewEmployeeInput
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

    // 7. Atomik bölge başlangıcı — PR 4'te DB transaction içinde olacak.
    //    Şimdi: önce Application update, sonra Employee insert.
    //    Employee insert hata fırlatırsa Application'ı manuel rollback.
    await this.applications.update(hiredApp);

    let createdEmployee;
    try {
      createdEmployee = await this.employees.insert(newEmpInput);
    } catch (err) {
      // Rollback: Application 'hired'ı geri al (orijinal stage'e dön)
      // entity 'hired' terminal olduğu için transitionTo çalışmaz —
      // burada bilerek raw insert ile orijinali geri yazıyoruz.
      await this.applications.update(application);

      if (err instanceof Error && (err as Error & { code?: string }).code === '23505') {
        if (err.message.includes('uq_employees_company_employee_no')) {
          throw new EmployeeNumberAlreadyExistsError(employeeNo, input.companyId);
        }
      }
      throw err;
    }

    // 8. Audit
    await this.audit.log({
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      companyId: input.companyId,
      action: 'hr.application.hired',
      details: {
        applicationId: application.id,
        candidateId: candidate.id,
        positionId: application.positionId,
        employeeId: createdEmployee.id,
        employeeNo: createdEmployee.employeeNo.value,
      },
      at: this.clock.now(),
    });

    return toEmployeeDto(createdEmployee);
  }
}
