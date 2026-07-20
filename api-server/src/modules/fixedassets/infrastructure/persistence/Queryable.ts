/**
 * Queryable — `pg` Pool ve PoolClient ortak interface'i.
 *
 * PgFixedAssetRepository hem pool hem transaction (PoolClient) ile çalışır.
 * Full-state sync (assets + movements + runs) için repository kendi içinde
 * pool.connect() ile tek transaction açar (PgBomRepository kalıbı).
 */
import type { QueryResult, QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
