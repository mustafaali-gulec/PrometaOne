/**
 * Queryable — `pg` paketinin `Pool` ve `PoolClient` ortak interface'i.
 *
 * Bu port ile Pg* repository'leri hem normal pool query'leriyle hem de bir
 * transaction içindeki `PoolClient` ile çalışabilir. UnitOfWork transaction
 * başlatınca, BEGIN/COMMIT/ROLLBACK'i tutan `PoolClient`'ı repository
 * constructor'larına geçirir; aynı kod yolu hem pool hem transaction modunda
 * çalışır.
 *
 * `pg.Pool` ve `pg.PoolClient` her ikisi de bu sözleşmeyi sağlar
 * (structural typing).
 *
 * Karar dokümanı: docs/adr/0006-unit-of-work-pattern.md
 */
import type { QueryResult, QueryResultRow } from 'pg';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
