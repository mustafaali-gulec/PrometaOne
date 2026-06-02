/**
 * PgUnitOfWork — UnitOfWork port'unun PostgreSQL implementasyonu.
 *
 * Tek bir `PoolClient` üzerinde BEGIN/COMMIT/ROLLBACK kullanır. `fn` çağrısı
 * sırasında yaratılan repository instance'ları aynı client'ı paylaşır;
 * dolayısıyla `fn` içindeki tüm INSERT/UPDATE/DELETE'ler aynı PG
 * transaction'ında atomik yürütülür.
 *
 * Kullanım örneği (HireFromApplicationUseCase):
 *   await uow.withTransaction(async (repos) => {
 *     await repos.applications.update(hiredApp);
 *     await repos.employees.insert(newEmpInput);
 *   });
 *
 * Hata semantiği:
 *   - `fn` resolve ederse COMMIT yapılır ve dönüş değeri çağırana iletilir.
 *   - `fn` throw ederse ROLLBACK yapılır ve hata yeniden fırlatılır.
 *   - ROLLBACK kendisi de hata fırlatırsa o hata yutulur (orijinal hata
 *     korunur); bağlantı yine release edilir.
 *
 * Karar dokümanı: docs/adr/0006-unit-of-work-pattern.md
 */
import type { Pool } from 'pg';

import type {
  HrTransactionalRepositories,
  UnitOfWork,
} from '../../application/ports/UnitOfWork.js';
import { PgApplicationRepository } from '../persistence/PgApplicationRepository.js';
import { PgApplicationStageHistoryRepository } from '../persistence/PgApplicationStageHistoryRepository.js';
import { PgCandidateRepository } from '../persistence/PgCandidateRepository.js';
import { PgDepartmentRepository } from '../persistence/PgDepartmentRepository.js';
import { PgEmployeeRepository } from '../persistence/PgEmployeeRepository.js';
import { PgOrgUnitRepository } from '../persistence/PgOrgUnitRepository.js';
import { PgPositionRepository } from '../persistence/PgPositionRepository.js';

export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}

  async withTransaction<T>(fn: (repos: HrTransactionalRepositories) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const repos: HrTransactionalRepositories = {
        orgUnits: new PgOrgUnitRepository(client),
        departments: new PgDepartmentRepository(client),
        positions: new PgPositionRepository(client),
        employees: new PgEmployeeRepository(client),
        candidates: new PgCandidateRepository(client),
        applications: new PgApplicationRepository(client),
        applicationHistory: new PgApplicationStageHistoryRepository(client),
      };
      const result = await fn(repos);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK kendi hatasını yut — orijinal hatayı korumak öncelikli.
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
