/**
 * PositionRepository — port.
 *
 * Concrete: infrastructure/persistence/PgPositionRepository.ts (PR 4'te).
 */
import type { Position } from '../../domain/entities/Position.js';
import type { PositionStatus } from '../../domain/valueObjects/PositionStatus.js';

export interface PositionRepository {
  insert(input: NewPositionInput): Promise<Position>;

  update(position: Position): Promise<void>;

  findById(id: number, companyId: number): Promise<Position | null>;

  listByCompany(
    companyId: number,
    options?: {
      status?: PositionStatus;
      departmentId?: number | null;
    },
  ): Promise<ReadonlyArray<Position>>;

  /** Bir pozisyonda aktif çalışan var mı? (kapatma öncesi uyarı için.) */
  hasActiveEmployees(positionId: number, companyId: number): Promise<boolean>;
}

export interface NewPositionInput {
  companyId: number;
  departmentId: number | null;
  title: string;
  description: string | null;
  status: PositionStatus;
  headcountTarget: number;
  minSalary: number | null;
  maxSalary: number | null;
}
