/**
 * Queryable — `pg` Pool ve PoolClient ortak interface'i.
 * (warehouse/infrastructure/persistence/Queryable.ts ile aynı sözleşme.)
 */
import type { QueryResult, QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
