/**
 * UnitRepository — ölçü birimi kalıcılık portu.
 * Concrete: infrastructure/persistence/PgUnitRepository.ts.
 */
import type { Unit } from '../../domain/entities/Unit.js';

export interface NewUnitInput {
  companyId: number;
  code: string;
  name: string;
}

export interface UnitRepository {
  insert(input: NewUnitInput): Promise<Unit>;
  update(unit: Unit): Promise<void>;
  remove(id: number, companyId: number): Promise<void>;
  findById(id: number, companyId: number): Promise<Unit | null>;
  existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean>;
  listByCompany(companyId: number): Promise<ReadonlyArray<Unit>>;
}
