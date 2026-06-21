/**
 * SqlExecutor portu — güvenli salt-okunur SQL yürütme soyutlaması.
 *
 * Concrete impl: infrastructure/sql/SafeSqlExecutor.ts (reportingPool üzerinde
 * READ ONLY transaction + statement_timeout + her zaman ROLLBACK).
 * Use-case'ler (RunReport) bu porta bağımlıdır; testlerde sahte (fake) verilir.
 */

export interface ResultColumn {
  /** Kolon adı (sonuç başlığı). */
  key: string;
  /** Kaba tip ipucu: number | text | date | timestamp | bool. */
  type: string;
}

export interface RunResult {
  columns: ResultColumn[];
  /** Satırlar dizi-içinde-dizi (kolon sırasına göre; tekrarlı kolon adı güvenli). */
  rows: unknown[][];
  rowCount: number;
  /** Satır sınırı aşıldı mı (maxRows). */
  truncated: boolean;
  durationMs: number;
}

export interface ExecuteOptions {
  /** Üst satır sınırı (varsayılan config.REPORTING_MAX_ROWS). */
  maxRows?: number;
  /** Zaman aşımı ms (varsayılan config.REPORTING_STATEMENT_TIMEOUT_MS). */
  timeoutMs?: number;
}

export interface SqlExecutor {
  /**
   * SQL'i salt-okunur olarak çalıştırır. `sql` zaten SqlGuard'dan geçmiş, `params`
   * $1.. bağlamaları olmalıdır. Hata durumunda QueryTimeoutError /
   * SqlExecutionError fırlatır.
   */
  execute(sql: string, params: readonly unknown[], opts?: ExecuteOptions): Promise<RunResult>;
}
