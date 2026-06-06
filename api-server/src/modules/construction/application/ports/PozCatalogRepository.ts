/**
 * PozCatalogRepository — birim fiyat (poz) katalog kalıcılık portu.
 * Concrete: infrastructure/persistence/PgPozCatalogRepository.ts
 */
import type { Poz } from '../../domain/entities/Poz.js';

export interface NewPozInput {
  companyId: number;
  pozNo: string;
  name: string;
  unit: string;
  unitPrice: number;
  source: string | null;
  year: number | null;
  createdBy: number | null;
}

export interface ListPozOptions {
  includeInactive?: boolean;
  search?: string;
}

export interface PozCatalogRepository {
  insert(input: NewPozInput): Promise<Poz>;
  update(poz: Poz): Promise<void>;
  findById(id: number, companyId: number): Promise<Poz | null>;
  listByCompany(companyId: number, options?: ListPozOptions): Promise<ReadonlyArray<Poz>>;
  existsByPozNo(
    companyId: number,
    pozNo: string,
    year: number | null,
    excludeId?: number,
  ): Promise<boolean>;
}
