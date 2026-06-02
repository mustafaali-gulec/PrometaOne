/**
 * Queryable — `pg` Pool ve PoolClient ortak interface'i.
 *
 * Pg* repository'leri hem pool hem transaction (PoolClient) ile çalışır.
 * PgFinanceUnitOfWork transaction başlatınca BEGIN/COMMIT/ROLLBACK tutan
 * PoolClient'ı repository constructor'larına geçirir (ADR-0006).
 */
import type { QueryResult, QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
