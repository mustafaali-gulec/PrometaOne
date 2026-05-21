/**
 * HireFromApplicationPolicy — Application "hired" stage'ine geçtiğinde
 * üretilecek Employee için input map'leme.
 *
 * Bu saf bir policy: Candidate + Application + hire-time parametrelerini
 * NewEmployeeInput'a dönüştürür. Application katmanı (`HireFromApplicationUseCase`)
 * bu input'u EmployeeRepository.insert'e iletir.
 *
 * Saf TS — DB/transaction bilgisi yok.
 */
import type { NewEmployeeInput } from '../../application/ports/EmployeeRepository.js';
import type { Application } from '../entities/Application.js';
import type { Candidate } from '../entities/Candidate.js';
import type { EmployeeStatus } from '../valueObjects/EmployeeStatus.js';
import type { EmploymentType } from '../valueObjects/EmploymentType.js';

export interface HireFromApplicationInput {
  candidate: Candidate;
  application: Application;
  departmentId: number;
  /** Generator'dan üretilen veya explicit verilen employee_no. */
  employeeNo: string;
  /** ISO date YYYY-MM-DD. */
  hireDate: string;
  /** Default 'probation'. */
  status?: EmployeeStatus;
  /** Default 'full_time'. */
  employmentType?: EmploymentType;
  /** TC Kimlik (Application'da yok — opsiyonel ek). */
  tcKimlik?: string | null;
  /** Sistem hesabı bağı — varsa. */
  userId?: number | null;
}

export class HireFromApplicationPolicy {
  /**
   * Candidate + Application + hire-time parametreleri → NewEmployeeInput.
   *
   * Field mapping:
   *   firstName/lastName/email/phone     ← Candidate
   *   positionId                         ← Application.positionId
   *   source_application_id              ← Application.id (iz)
   *   departmentId/employeeNo/hireDate   ← caller
   *   tcKimlik/userId                    ← opsiyonel caller
   */
  static toNewEmployeeInput(input: HireFromApplicationInput): NewEmployeeInput {
    const { candidate, application, departmentId, employeeNo, hireDate } = input;

    if (candidate.companyId !== application.companyId) {
      throw new Error(
        `HireFromApplicationPolicy: Candidate (companyId=${candidate.companyId}) ile Application (companyId=${application.companyId}) farklı şirketlerde`,
      );
    }
    if (candidate.id !== application.candidateId) {
      throw new Error(
        `HireFromApplicationPolicy: Application (candidateId=${application.candidateId}) bu Candidate (id=${candidate.id}) ile eşleşmiyor`,
      );
    }

    return {
      companyId: candidate.companyId,
      userId: input.userId ?? null,
      departmentId,
      positionId: application.positionId,
      employeeNo,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      tcKimlik: input.tcKimlik ?? null,
      email: candidate.email,
      phone: candidate.phone?.value ?? null,
      hireDate,
      status: input.status ?? 'probation',
      employmentType: input.employmentType ?? 'full_time',
      sourceApplicationId: application.id,
    };
  }
}
