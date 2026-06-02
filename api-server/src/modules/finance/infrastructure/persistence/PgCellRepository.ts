/**
 * PgCellRepository — CellRepository PG implementasyonu.
 * Tablo: cells (003). UNIQUE (company_id, category_id, fiscal_year, month_idx).
 */
import type { CellRepository } from '../../application/ports/CellRepository.js';
import { Cell } from '../../domain/entities/Cell.js';
import type { Currency } from '../../domain/valueObjects/Currency.js';
import { FiscalYear } from '../../domain/valueObjects/FiscalYear.js';
import { Money } from '../../domain/valueObjects/Money.js';
import { MonthIndex } from '../../domain/valueObjects/MonthIndex.js';

import type { Queryable } from './Queryable.js';

interface CellRow {
  id: number;
  company_id: number;
  category_id: number;
  fiscal_year: number;
  month_idx: number;
  value: string; // NUMERIC → string
  updated_by: number | null;
}

const COLS = 'id, company_id, category_id, fiscal_year, month_idx, value, updated_by';

export class PgCellRepository implements CellRepository {
  constructor(private readonly db: Queryable) {}

  async upsert(cell: Cell): Promise<Cell> {
    const r = await this.db.query<CellRow>(
      `INSERT INTO cells (company_id, category_id, fiscal_year, month_idx, value, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (company_id, category_id, fiscal_year, month_idx)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING ${COLS}`,
      [
        cell.companyId,
        cell.categoryId,
        cell.fiscalYear.value,
        cell.monthIdx.value,
        cell.value.toDecimalString(),
        cell.updatedBy,
      ],
    );
    // Yazılan currency'yi koru (DB currency tutmuyor — Cell.ts notu).
    return rowToCell(r.rows[0]!, cell.value.currency);
  }

  async bulkUpsert(cells: ReadonlyArray<Cell>): Promise<void> {
    for (const c of cells) {
      await this.upsert(c);
    }
  }

  async findByCompanyYear(companyId: number, fiscalYear: number): Promise<ReadonlyArray<Cell>> {
    const r = await this.db.query<CellRow>(
      `SELECT ${COLS} FROM cells WHERE company_id = $1 AND fiscal_year = $2`,
      [companyId, fiscalYear],
    );
    return r.rows.map((row) => rowToCellTRY(row));
  }

  async findOne(
    companyId: number,
    categoryId: number,
    fiscalYear: number,
    monthIdx: number,
  ): Promise<Cell | null> {
    const r = await this.db.query<CellRow>(
      `SELECT ${COLS} FROM cells
        WHERE company_id = $1 AND category_id = $2 AND fiscal_year = $3 AND month_idx = $4
        LIMIT 1`,
      [companyId, categoryId, fiscalYear, monthIdx],
    );
    const row = r.rows[0];
    return row ? rowToCellTRY(row) : null;
  }
}

/**
 * NOT — para birimi: `cells` tablosunda currency kolonu yok. Bütçe şirketin
 * ana biriminde (varsayılan TRY) planlanır (bkz. Cell.ts). DB'den okurken
 * TRY varsayarız; multi-currency bütçe ileride migration ile gelir.
 */
function rowToCellTRY(row: CellRow): Cell {
  return Cell.create({
    id: row.id,
    companyId: row.company_id,
    categoryId: row.category_id,
    fiscalYear: FiscalYear.create(row.fiscal_year),
    monthIdx: MonthIndex.create(row.month_idx),
    value: Money.fromDecimalString(row.value, 'TRY'),
    updatedAt: new Date(),
    updatedBy: row.updated_by,
  });
}

function rowToCell(row: CellRow, currency: Currency): Cell {
  return Cell.create({
    id: row.id,
    companyId: row.company_id,
    categoryId: row.category_id,
    fiscalYear: FiscalYear.create(row.fiscal_year),
    monthIdx: MonthIndex.create(row.month_idx),
    value: Money.fromDecimalString(row.value, currency),
    updatedAt: new Date(),
    updatedBy: row.updated_by,
  });
}
