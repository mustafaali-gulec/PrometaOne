/**
 * EmployeeRepository — port.
 *
 * Concrete: infrastructure/persistence/PgEmployeeRepository.ts (PR 4'te).
 */
import type { Employee } from '../../domain/entities/Employee.js';
import type { EmployeeStatus } from '../../domain/valueObjects/EmployeeStatus.js';

export interface EmployeeRepository {
  insert(input: NewEmployeeInput): Promise<Employee>;

  update(employee: Employee): Promise<void>;

  findById(id: number, companyId: number): Promise<Employee | null>;

  /** employee_no'ya göre. Şirket içi benzersizliği döndürür. */
  findByEmployeeNo(employeeNo: string, companyId: number): Promise<Employee | null>;

  /** Bir User'a bağlı Employee var mı? UNIQUE constraint nedeniyle 0 veya 1. */
  findByUserId(userId: number, companyId: number): Promise<Employee | null>;

  listByCompany(
    companyId: number,
    options?: {
      status?: EmployeeStatus;
      departmentId?: number;
      positionId?: number;
      /** İsim/soyisim/employee_no içinde arar. */
      q?: string;
    },
  ): Promise<ReadonlyArray<Employee>>;

  /** Bir departmandaki AKTİF (probation/active/on_leave) çalışan sayısı. */
  countActiveByDepartment(departmentId: number, companyId: number): Promise<number>;

  /** Bir pozisyondaki AKTİF çalışan sayısı. */
  countActiveByPosition(positionId: number, companyId: number): Promise<number>;
}

export interface NewEmployeeInput {
  companyId: number;
  userId: number | null;
  departmentId: number;
  positionId: number | null;
  /** Raw string — DB tarafında value object'e çevrilir. */
  employeeNo: string;
  firstName: string;
  lastName: string;
  tcKimlik: string | null;
  email: string | null;
  /** Normalize edilmiş +90XXXXXXXXXX formatında. */
  phone: string | null;
  /** ISO date string YYYY-MM-DD. */
  hireDate: string;
  status: EmployeeStatus;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  sourceApplicationId: number | null;
}
