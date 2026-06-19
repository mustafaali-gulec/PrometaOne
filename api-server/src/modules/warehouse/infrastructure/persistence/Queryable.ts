/**
 * Queryable — `pg` Pool ve PoolClient ortak interface'i.
 *
 * Pg* repository'leri hem pool hem transaction (PoolClient) ile çalışır.
 * (finance/infrastructure/persistence/Queryable.ts ile aynı sözleşme.)
 */
import type { QueryResult, QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
