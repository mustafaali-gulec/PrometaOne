/**
 * FiscalYear — mali yıl (cells.fiscal_year).
 *
 * Bütçe matrisi yıl bazlı saklanır. 2000–2100 makul sınır.
 */
import { InvalidFiscalYearError } from '../errors/FinanceErrors.js';

export class FiscalYear {
  private constructor(private readonly year: number) {}

  static create(year: number): FiscalYear {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new InvalidFiscalYearError(year);
    }
    return new FiscalYear(year);
  }

  get value(): number {
    return this.year;
  }

  equals(other: FiscalYear): boolean {
    return this.year === other.year;
  }

  toJSON(): number {
    return this.year;
  }
}
