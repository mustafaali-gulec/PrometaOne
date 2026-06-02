/**
 * Cell — bütçe matrisinin tek hücresi (003_categories_and_cells.sql).
 *
 * Bir hücre = (category × fiscalYear × monthIdx) → Money değeri.
 * DB UNIQUE (company_id, category_id, fiscal_year, month_idx) ile birebir.
 *
 * NOT — para birimi: `cells` tablosunda currency kolonu YOK. Bütçe şirketin
 * ana para biriminde (varsayılan TRY) planlanır. Money'yi bu varsayımla
 * kurarız; ileride multi-currency bütçe gerekirse migration + currency kolonu
 * eklenir. Money'nin tek faydası: integer-kuruş aritmetiği (toplam alırken
 * float hatası olmaz).
 *
 * Immutable — setValue yeni instance döner.
 */
import type { FiscalYear } from '../valueObjects/FiscalYear.js';
import type { Money } from '../valueObjects/Money.js';
import type { MonthIndex } from '../valueObjects/MonthIndex.js';

export interface CellProps {
  /** Yeni (henüz DB'ye yazılmamış) hücrede null olabilir. */
  id: number | null;
  companyId: number;
  categoryId: number;
  fiscalYear: FiscalYear;
  monthIdx: MonthIndex;
  value: Money;
  updatedAt: Date;
  updatedBy: number | null;
}

export class Cell {
  private constructor(private readonly props: Readonly<CellProps>) {}

  static create(props: CellProps): Cell {
    if (props.id !== null && props.id <= 0) {
      throw new Error('Cell.id pozitif olmalı veya null');
    }
    if (props.companyId <= 0) {
      throw new Error('Cell.companyId pozitif olmalı');
    }
    if (props.categoryId <= 0) {
      throw new Error('Cell.categoryId pozitif olmalı');
    }
    return new Cell(props);
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get categoryId(): number {
    return this.props.categoryId;
  }
  get fiscalYear(): FiscalYear {
    return this.props.fiscalYear;
  }
  get monthIdx(): MonthIndex {
    return this.props.monthIdx;
  }
  get value(): Money {
    return this.props.value;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get updatedBy(): number | null {
    return this.props.updatedBy;
  }

  /** Hücre değerini değiştirir (yeni instance). updatedBy izlenir. */
  setValue(value: Money, now: Date, updatedBy: number | null): Cell {
    if (value.equals(this.props.value)) {
      return this;
    }
    return new Cell({ ...this.props, value, updatedAt: now, updatedBy });
  }

  /** Persist sonrası DB'nin atadığı id'yi geri yazar (yeni instance). */
  withId(id: number): Cell {
    if (this.props.id === id) {
      return this;
    }
    return new Cell({ ...this.props, id });
  }

  toJSON(): {
    id: number | null;
    companyId: number;
    categoryId: number;
    fiscalYear: number;
    monthIdx: number;
    value: string;
    updatedBy: number | null;
  } {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      categoryId: this.props.categoryId,
      fiscalYear: this.props.fiscalYear.value,
      monthIdx: this.props.monthIdx.value,
      value: this.props.value.toDecimalString(),
      updatedBy: this.props.updatedBy,
    };
  }
}
