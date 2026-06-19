/**
 * VariantRepository — varyant kalıcılık portu.
 * Concrete: infrastructure/persistence/PgVariantRepository.ts.
 */
import type { Variant, VariantOption } from '../../domain/entities/Variant.js';
import type { VariantStatus } from '../../domain/valueObjects/AuxStatuses.js';

export interface NewVariantInput {
  companyId: number;
  code: string;
  name: string;
  status: VariantStatus;
  options: ReadonlyArray<VariantOption>;
}

export interface VariantRepository {
  insert(input: NewVariantInput): Promise<Variant>;
  update(variant: Variant): Promise<void>;
  remove(id: number, companyId: number): Promise<void>;
  findById(id: number, companyId: number): Promise<Variant | null>;
  existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean>;
  listByCompany(
    companyId: number,
    options?: { status?: VariantStatus },
  ): Promise<ReadonlyArray<Variant>>;
}
