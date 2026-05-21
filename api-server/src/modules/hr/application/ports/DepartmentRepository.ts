/**
 * DepartmentRepository — port.
 *
 * Concrete: infrastructure/persistence/PgDepartmentRepository.ts (PR 4'te).
 */
import type { Department } from '../../domain/entities/Department.js';

export interface DepartmentRepository {
  insert(input: NewDepartmentInput): Promise<Department>;

  update(department: Department): Promise<void>;

  findById(id: number, companyId: number): Promise<Department | null>;

  listByCompany(
    companyId: number,
    options?: { includeInactive?: boolean; orgUnitId?: number | null },
  ): Promise<ReadonlyArray<Department>>;

  /**
   * Aktif çalışanı olan departman silmemeli/arşivlememeli — arşivden önce kontrol.
   * (Employees tablosu PR 2'de gelir; bu metod o zaman gerçek sorgu çalıştırır.
   * PR 1'de fake implementation in-memory döner.)
   */
  hasActiveEmployees(departmentId: number, companyId: number): Promise<boolean>;
}

export interface NewDepartmentInput {
  companyId: number;
  orgUnitId: number | null;
  name: string;
  code: string | null;
  managerEmployeeId: number | null;
  active: boolean;
}
