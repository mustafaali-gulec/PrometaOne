/**
 * UnitOfWork — birden fazla aggregate'in tek bir atomik veritabanı işleminde
 * yazılmasını sağlayan port.
 *
 * Kullanım:
 *   await uow.withTransaction(async (repos) => {
 *     await repos.applications.update(hiredApp);
 *     await repos.employees.insert(newEmpInput);
 *   });
 *
 * Semantik:
 *   - `fn` normal döner → COMMIT.
 *   - `fn` throw eder → ROLLBACK ve hata yeniden fırlatılır.
 *   - PG implementasyonu (PgUnitOfWork) tek bir `PoolClient` üzerinde
 *     BEGIN/COMMIT/ROLLBACK kullanır; tüm repo çağrıları aynı bağlantıda.
 *
 * Bu port `HireFromApplicationUseCase` gibi cross-aggregate use-case'lerin
 * atomik garanti gereksinimini karşılar. Manuel try/catch rollback
 * (PR 3'teki geçici çözüm) için yeterli değildi: iki update arasında crash
 * olursa state tutarsız kalıyordu.
 *
 * Karar dokümanı: docs/adr/0006-unit-of-work-pattern.md
 */
import type { ApplicationRepository } from './ApplicationRepository.js';
import type { ApplicationStageHistoryRepository } from './ApplicationStageHistoryRepository.js';
import type { CandidateRepository } from './CandidateRepository.js';
import type { DepartmentRepository } from './DepartmentRepository.js';
import type { EmployeeRepository } from './EmployeeRepository.js';
import type { OrgUnitRepository } from './OrgUnitRepository.js';
import type { PositionRepository } from './PositionRepository.js';

export interface HrTransactionalRepositories {
  readonly orgUnits: OrgUnitRepository;
  readonly departments: DepartmentRepository;
  readonly positions: PositionRepository;
  readonly employees: EmployeeRepository;
  readonly candidates: CandidateRepository;
  readonly applications: ApplicationRepository;
  readonly applicationHistory: ApplicationStageHistoryRepository;
}

export interface UnitOfWork {
  /**
   * `fn` içinde tüm repo çağrıları aynı DB transaction'ında yürütülür.
   * `fn` throw ederse ROLLBACK, normal dönerse COMMIT yapılır.
   *
   * PG implementasyonu: tek bir `PoolClient` üzerinde
   * BEGIN/COMMIT/ROLLBACK kullanılır.
   */
  withTransaction<T>(fn: (repos: HrTransactionalRepositories) => Promise<T>): Promise<T>;
}
