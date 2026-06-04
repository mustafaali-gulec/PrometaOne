/**
 * Queryable — `pg` paketinin `Pool` ve `PoolClient` ortak interface'i.
 * (HR modülündeki Queryable ile aynı sözleşme; structural typing ile uyumlu.)
 */
import type { QueryResult, QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
