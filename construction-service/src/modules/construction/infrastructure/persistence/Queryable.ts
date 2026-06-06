/**
 * Queryable — `pg` Pool ve PoolClient ortak interface'i.
 * Tek statement repository'ler bununla çalışır; çok statement'lı (header+detay)
 * repository'ler Pool alıp kendi transaction'ını yönetir.
 */
import type { QueryResult, QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
