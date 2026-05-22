/**
 * PgEmployeeNumberGenerator — şirket-bazlı employee_no üretici (PG).
 *
 * `hr_employee_no_counters` tablosunu kullanarak atomik bir INCREMENT yapar
 * (UPSERT + RETURNING) ve SequentialEmployeeNumberGenerator'a delege eder.
 */
import type { Pool } from 'pg';

import { SequentialEmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';
import type { EmployeeNumberGenerator } from '../../domain/services/EmployeeNumberGenerator.js';
import type { EmployeeNumber } from '../../domain/valueObjects/EmployeeNumber.js';

export interface PgEmployeeNumberGeneratorOptions {
  prefix?: string;
  width?: number;
}

export class PgEmployeeNumberGenerator implements EmployeeNumberGenerator {
  private readonly inner: SequentialEmployeeNumberGenerator;

  constructor(
    private readonly pool: Pool,
    options: PgEmployeeNumberGeneratorOptions = {},
  ) {
    this.inner = new SequentialEmployeeNumberGenerator(
      (companyId) => this.nextSequence(companyId),
      options,
    );
  }

  next(companyId: number): Promise<EmployeeNumber> {
    return this.inner.next(companyId);
  }

  private async nextSequence(companyId: number): Promise<number> {
    // UPSERT + atomik increment. PG'nin RETURNING ile çakışma çözümlü insert.
    const r = await this.pool.query<{ next_value: string }>(
      `INSERT INTO hr_employee_no_counters (company_id, next_value)
       VALUES ($1, 2)
       ON CONFLICT (company_id) DO UPDATE
         SET next_value = hr_employee_no_counters.next_value + 1
       RETURNING (hr_employee_no_counters.next_value - 1)::text AS next_value`,
      [companyId],
    );
    return Number(r.rows[0]!.next_value);
  }
}
