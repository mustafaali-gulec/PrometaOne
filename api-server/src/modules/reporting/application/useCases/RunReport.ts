/**
 * RunReport — Report Studio çekirdek use-case'i.
 *
 * Akış: tanımı çöz (kayıtlı id VEYA ad-hoc) → SQL üret (bind / [P2] derle) →
 * SqlGuard → SafeSqlExecutor (READ ONLY) → report_runs denetim kaydı → sonuç.
 *
 * report_runs HAM SONUÇ TUTMAZ — yalnız metadata (durum/satır/süre/hata + SQL'in
 * sha256 hash'i). Denetim yazımı hata response'unu bloklamaz (best-effort).
 */
import { createHash } from 'node:crypto';

import { buildCompilerCatalog, compileQuery } from '../../domain/compiler/QueryCompiler.js';
import type { QuerySpec } from '../../domain/compiler/QuerySpec.js';
import {
  InvalidReportDefinitionError,
  QueryTimeoutError,
  ReportDefinitionNotFoundError,
  ReportingError,
  SqlExecutionError,
} from '../../domain/errors/ReportingErrors.js';
import { bindNamedParams, type ParamDef } from '../../domain/params/ParamBinder.js';
import { assertSafeSelect } from '../../domain/sql/SqlGuard.js';
import type { ReportMode, ReportRunStatus } from '../../domain/valueObjects/ReportEnums.js';
import type { ReportDefinitionRepository } from '../ports/ReportDefinitionRepository.js';
import type { NewReportRun, ReportRunRepository } from '../ports/ReportRunRepository.js';
import type { SchemaCatalogReader } from '../ports/SchemaCatalogReader.js';
import type { ExecuteOptions, RunResult, SqlExecutor } from '../ports/SqlExecutor.js';

const PREVIEW_MAX_ROWS = 100;

export interface RunReportInput {
  companyId: number;
  runBy: number | null;
  /** Kayıtlı rapor id'si (verilirse ad-hoc alanları yok sayılır). */
  reportId?: number;
  /** Ad-hoc: 'sql' (P1) | 'visual' (P2). */
  mode?: ReportMode;
  sql?: string;
  spec?: unknown;
  /** Ad-hoc parametre tanımları (kayıtlı raporda tanımdan gelir). */
  paramDefs?: ParamDef[];
  /** Parametre değerleri (ad: değer). */
  params?: Record<string, unknown>;
  /** Önizleme — küçük satır sınırı. */
  preview?: boolean;
}

export class RunReportUseCase {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly definitions: ReportDefinitionRepository,
    private readonly runs: ReportRunRepository,
    private readonly catalogReader: SchemaCatalogReader,
  ) {}

  async execute(input: RunReportInput): Promise<RunResult> {
    // 1) Tanımı çöz: kayıtlı id veya ad-hoc.
    let mode: ReportMode;
    let sqlText: string | null;
    let querySpec: unknown = null;
    let paramDefs: ParamDef[];
    let reportId: number | null = null;

    if (input.reportId !== undefined) {
      const def = await this.definitions.findById(input.reportId, input.companyId);
      if (!def) throw new ReportDefinitionNotFoundError(input.reportId);
      reportId = def.id;
      mode = def.mode;
      sqlText = def.sqlText;
      querySpec = def.querySpec;
      paramDefs = def.params ?? [];
    } else {
      mode = input.mode ?? 'sql';
      sqlText = input.sql ?? null;
      querySpec = input.spec ?? null;
      paramDefs = input.paramDefs ?? [];
    }

    // 2) SQL üret + güvenlik kapısı. Bind/derleme/guard hataları → 'blocked' denetimi.
    let finalSql: string;
    let values: unknown[];
    try {
      if (mode === 'visual') {
        if (querySpec === null || querySpec === undefined) {
          throw new InvalidReportDefinitionError('görsel sorgu tanımı (spec) yok');
        }
        const tables = await this.catalogReader.readCatalog();
        const compiled = compileQuery(querySpec as QuerySpec, {
          catalog: buildCompilerCatalog(tables),
          companyId: input.companyId,
          params: input.params ?? {},
          paramDefs,
        });
        finalSql = compiled.sql;
        values = compiled.values;
      } else {
        if (typeof sqlText !== 'string' || sqlText.trim().length === 0) {
          throw new InvalidReportDefinitionError('çalıştırılacak SQL yok');
        }
        const bound = bindNamedParams(sqlText, paramDefs, input.params ?? {});
        finalSql = bound.sql;
        values = bound.values;
      }
      assertSafeSelect(finalSql);
    } catch (err) {
      await this.recordRun(input, reportId, mode, {
        status: 'blocked',
        ...errorInfo(err),
      });
      throw err;
    }

    // 3) Çalıştır + denetle.
    const opts: ExecuteOptions = input.preview ? { maxRows: PREVIEW_MAX_ROWS } : {};
    const sqlHash = createHash('sha256').update(finalSql).digest('hex');
    try {
      const result = await this.executor.execute(finalSql, values, opts);
      await this.recordRun(input, reportId, mode, {
        status: 'success',
        rowCount: result.rowCount,
        durationMs: result.durationMs,
        truncated: result.truncated,
        sqlHash,
      });
      return result;
    } catch (err) {
      const status: ReportRunStatus =
        err instanceof QueryTimeoutError
          ? 'timeout'
          : err instanceof SqlExecutionError && err.pgCode === '25006'
            ? 'blocked'
            : 'error';
      await this.recordRun(input, reportId, mode, { status, sqlHash, ...errorInfo(err) });
      throw err;
    }
  }

  /** Denetim kaydı — best-effort (hata yutulur, response'u bloklamaz). */
  private async recordRun(
    input: RunReportInput,
    reportId: number | null,
    mode: ReportMode,
    partial: Partial<NewReportRun> & { status: ReportRunStatus },
  ): Promise<void> {
    try {
      await this.runs.insert({
        companyId: input.companyId,
        reportId,
        mode,
        status: partial.status,
        rowCount: partial.rowCount ?? null,
        durationMs: partial.durationMs ?? null,
        truncated: partial.truncated ?? false,
        sqlHash: partial.sqlHash ?? null,
        errorCode: partial.errorCode ?? null,
        errorMessage: partial.errorMessage ?? null,
        runBy: input.runBy,
      });
    } catch (e) {
      console.error('[reporting] report_runs yazılamadı:', e);
    }
  }
}

function errorInfo(err: unknown): { errorCode: string | null; errorMessage: string } {
  if (err instanceof ReportingError) {
    return { errorCode: err.code, errorMessage: err.message };
  }
  return {
    errorCode: null,
    errorMessage: err instanceof Error ? err.message : String(err),
  };
}
