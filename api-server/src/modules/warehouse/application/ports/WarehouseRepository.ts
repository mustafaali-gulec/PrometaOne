/**
 * WarehouseRepository — depo kalıcılık portu.
 * Concrete: infrastructure/persistence/PgWarehouseRepository.ts.
 */
import type { Warehouse, WarehouseLocation } from '../../domain/entities/Warehouse.js';
import type { WarehouseStatus } from '../../domain/valueObjects/WarehouseStatus.js';

export interface NewWarehouseInput {
  companyId: number;
  code: string;
  name: string;
  unitName: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  manager: string | null;
  status: WarehouseStatus;
  locations: ReadonlyArray<WarehouseLocation>;
}

export interface WarehouseRepository {
  insert(input: NewWarehouseInput): Promise<Warehouse>;
  update(warehouse: Warehouse): Promise<void>;
  remove(id: number, companyId: number): Promise<void>;
  findById(id: number, companyId: number): Promise<Warehouse | null>;
  existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean>;
  listByCompany(
    companyId: number,
    options?: { status?: WarehouseStatus },
  ): Promise<ReadonlyArray<Warehouse>>;
}
