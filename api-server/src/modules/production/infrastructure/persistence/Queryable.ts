/**
 * Queryable — `pg` Pool ve PoolClient ortak interface'i.
 *
 * Pg* repository'leri hem pool hem transaction (PoolClient) ile çalışır.
 * Aggregate yazımı (reçete + bileşenler/operasyonlar, üretim emri + malzeme/
 * operasyonlar) için repository kendi içinde pool.connect() ile transaction açar.
 */
import type { QueryResult, QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
