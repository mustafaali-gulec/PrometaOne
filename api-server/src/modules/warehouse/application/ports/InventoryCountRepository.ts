/**
 * InventoryCountRepository — Envanter Sayım kalıcılık portu.
 * Concrete: infrastructure/persistence/PgInventoryCountRepository.ts.
 */
import type { InventoryCount, InventoryCountItem } from '../../domain/entities/InventoryCount.js';
import type { InventoryCountStatus } from '../../domain/valueObjects/AuxStatuses.js';

export interface NewInventoryCountInput {
  companyId: number;
  no: string;
  date: string;
  warehouseId: number;
  period: string | null;
  status: InventoryCountStatus;
  items: ReadonlyArray<InventoryCountItem>;
}

export interface InventoryCountRepository {
  insert(input: NewInventoryCountInput): Promise<InventoryCount>;
  update(count: InventoryCount): Promise<void>;
  findById(id: number, companyId: number): Promise<InventoryCount | null>;
  listByCompany(
    companyId: number,
    options?: { status?: InventoryCountStatus; warehouseId?: number },
  ): Promise<ReadonlyArray<InventoryCount>>;
  /** Belge no üretmek için yıl bazında bir sonraki sıra. */
  nextSequence(companyId: number, year: number): Promise<number>;
}
