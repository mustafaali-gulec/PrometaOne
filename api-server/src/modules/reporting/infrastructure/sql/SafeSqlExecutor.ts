/**
 * SafeSqlExecutor — SqlExecutor portunun güvenli PG implementasyonu.
 *
 * Her sorgu, reportingPool'dan alınan bir client'ta şu şekilde çalışır:
 *   BEGIN READ ONLY                         → yazma imkânsız
 *   SET LOCAL statement_timeout = <ms>      → uzun sorgu iptal (57014)
 *   SET LOCAL idle_in_transaction_session_timeout = <ms>
 *   SELECT * FROM ( <sql> ) _rpt_q LIMIT <cap>   → server kontrollü satır sınırı
 *   ROLLBACK  (finally — DAİMA, asla COMMIT)
 *
 * cap ve timeout config'ten gelen DOĞRULANMIŞ tamsayılardır → SQL'e literal
 * gömmek güvenli (placeholder çakışması olmaz). Kullanıcı değerleri yalnız
 * `params` ile $n binding üzerinden geçer.
 */
import type { Pool } from 'pg';

import { config } from '../../../../config.js';
import type {
  ExecuteOptions,
  RunResult,
  SqlExecutor,
} from '../../application/ports/SqlExecutor.js';
import { QueryTimeoutError, SqlExecutionError } from '../../domain/errors/ReportingErrors.js';

const HARD_MAX_ROWS = 50_000;

/** PG tip OID'ini kaba bir tip ipucuna eşler (FE biçimlendirme için). */
function oidToType(oid: number): string {
  switch (oid) {
    case 20: // int8
    case 21: // int2
    case 23: // int4
    case 1700: // numeric
    case 700: // float4
    case 701: // float8
      return 'number';
    case 16: // bool
      return 'bool';
    case 1082: // date
      return 'date';
    case 1114: // timestamp
    case 1184: // timestamptz
      return 'timestamp';
    default:
      return 'text';
  }
}

export class SafeSqlExecutor implements SqlExecutor {
  constructor(private readonly pool: Pool) {}

  async execute(
    sql: string,
    params: readonly unknown[],
    opts?: ExecuteOptions,
  ): Promise<RunResult> {
    const maxRows = clampInt(opts?.maxRows ?? config.REPORTING_MAX_ROWS, 1, HARD_MAX_ROWS);
    const timeoutMs = clampInt(
      opts?.timeoutMs ?? config.REPORTING_STATEMENT_TIMEOUT_MS,
      100,
      600_000,
    );
    const cap = maxRows + 1; // +1 → truncated tespiti

    // cap & timeout doğrulanmış tamsayı → literal gömme güvenli.
    const wrapped = `SELECT * FROM (\n${sql}\n) AS _rpt_q LIMIT ${cap}`;

    const client = await this.pool.connect();
    const startedAt = Date.now();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = ${timeoutMs}`);

      const res = await client.query({
        text: wrapped,
        values: params as unknown[],
        rowMode: 'array',
      });

      const durationMs = Date.now() - startedAt;
      const allRows = res.rows as unknown[][];
      const truncated = allRows.length > maxRows;
      const rows = truncated ? allRows.slice(0, maxRows) : allRows;
      const columns = (res.fields ?? []).map((f) => ({
        key: f.name,
        type: oidToType(f.dataTypeID),
      }));

      return { columns, rows, rowCount: rows.length, truncated, durationMs };
    } catch (err: unknown) {
      const pgCode = (err as { code?: string }).code;
      const message = err instanceof Error ? err.message : String(err);
      if (pgCode === '57014') {
        throw new QueryTimeoutError(timeoutMs);
      }
      // 25006 read-only ihlali, 42xxx syntax/undefined, 22xxx data exception →
      // kullanıcıya 400 olarak dön (ham SQL'i yazan teknik kullanıcı).
      throw new SqlExecutionError(message, pgCode);
    } finally {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* yut — rollback hatası yutulur, client release edilir */
      }
      client.release();
    }
  }
}

function clampInt(n: number, min: number, max: number): number {
  const v = Math.floor(Number.isFinite(n) ? n : min);
  return Math.max(min, Math.min(max, v));
}
