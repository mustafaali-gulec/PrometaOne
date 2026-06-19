/**
 * MaterialGroupRepository — malzeme grubu kalıcılık portu.
 * Concrete: infrastructure/persistence/PgMaterialGroupRepository.ts.
 */
import type { MaterialGroup } from '../../domain/entities/MaterialGroup.js';
import type { GroupStatus } from '../../domain/valueObjects/AuxStatuses.js';

export interface NewMaterialGroupInput {
  companyId: number;
  code: string;
  name: string;
  status: GroupStatus;
}

export interface MaterialGroupRepository {
  insert(input: NewMaterialGroupInput): Promise<MaterialGroup>;
  update(group: MaterialGroup): Promise<void>;
  remove(id: number, companyId: number): Promise<void>;
  findById(id: number, companyId: number): Promise<MaterialGroup | null>;
  existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean>;
  listByCompany(
    companyId: number,
    options?: { status?: GroupStatus },
  ): Promise<ReadonlyArray<MaterialGroup>>;
}
