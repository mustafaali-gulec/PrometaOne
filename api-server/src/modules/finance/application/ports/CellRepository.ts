/**
 * CellRepository — bütçe hücresi kalıcılık portu.
 *
 * Concrete: infrastructure/persistence/PgCellRepository.ts (PR 6).
 * Hücreler (company, category, fiscal_year, month_idx) ile UNIQUE — yazım
 * UPSERT'tir (varsa günceller, yoksa ekler).
 */
import type { Cell } from '../../domain/entities/Cell.js';

export interface CellRepository {
  /** Tek hücre UPSERT (company+category+year+month unique). */
  upsert(cell: Cell): Promise<Cell>;
  /** Çoklu hücre UPSERT (matris toplu kaydetme). */
  bulkUpsert(cells: ReadonlyArray<Cell>): Promise<void>;
  /** Bir şirketin bir mali yıldaki tüm hücreleri (matris kurulumu için). */
  findByCompanyYear(companyId: number, fiscalYear: number): Promise<ReadonlyArray<Cell>>;
  /** Tek hücre (commit-to-cells: mevcut değere delta eklemek için). */
  findOne(
    companyId: number,
    categoryId: number,
    fiscalYear: number,
    monthIdx: number,
  ): Promise<Cell | null>;
}
