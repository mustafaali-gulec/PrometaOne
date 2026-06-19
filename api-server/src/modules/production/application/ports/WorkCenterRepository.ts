/**
 * WorkCenterRepository — iş merkezi kalıcılık portu.
 *
 * Concrete: infrastructure/persistence/PgWorkCenterRepository.ts.
 */
import type { WorkCenter } from '../../domain/entities/WorkCenter.js';
import type { WorkCenterStatus } from '../../domain/valueObjects/WorkCenterStatus.js';

export interface NewWorkCenterInput {
  companyId: number;
  code: string;
  name: string;
  dailyHours: number;
  costPerHour: number;
  status: WorkCenterStatus;
}

export interface WorkCenterRepository {
  insert(input: NewWorkCenterInput): Promise<WorkCenter>;
  update(workCenter: WorkCenter): Promise<void>;
  findById(id: number, companyId: number): Promise<WorkCenter | null>;
  listByCompany(
    companyId: number,
    options?: { includeArchived?: boolean },
  ): Promise<ReadonlyArray<WorkCenter>>;
  existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean>;
}
