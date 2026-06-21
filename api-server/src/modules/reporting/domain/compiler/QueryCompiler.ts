/**
 * QueryCompiler — QuerySpec → güvenli parametreli SQL.
 *
 * GÜVENLİK: Tüm identifier'lar (kaynak, kolonlar, group/order) katalog
 * allowlist'ine karşı doğrulanır; doğrulanan ad çift-tırnakla emit edilir
 * (kullanıcı serbest metni asla doğrudan SQL'e gömülmez). agg/op/dir sabit
 * enum'lardan gelir. Tüm filtre değerleri $n ile bağlanır. company_id otomatik
 * enjekte edilir. Çıktı ayrıca SqlGuard'dan geçer (kemer + askı).
 */
import { InvalidQuerySpecError, UnknownIdentifierError } from '../errors/ReportingErrors.js';
import { coerceParamValue, type ParamDef } from '../params/ParamBinder.js';

import type { FilterOp, QuerySpec } from './QuerySpec.js';

export interface CompilerRelation {
  columns: Set<string>;
  hasCompanyId: boolean;
}
export type CompilerCatalog = ReadonlyMap<string, CompilerRelation>;

export interface CompileContext {
  catalog: CompilerCatalog;
  companyId: number;
  params?: Record<string, unknown>;
  paramDefs?: ParamDef[];
}

export interface CompiledQuery {
  sql: string;
  values: unknown[];
}

/** Çift-tırnaklı, kaçışlı identifier. */
const qid = (id: string): string => '"' + id.replace(/"/g, '""') + '"';

const COMPARE_OPS: Record<string, string> = {
  '=': '=',
  '<>': '<>',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  like: 'LIKE',
  ilike: 'ILIKE',
};

/** CatalogTable[] (application DTO) → derleyici kataloğu (yapısal — domain bağımsız). */
export function buildCompilerCatalog(
  tables: ReadonlyArray<{
    key: string;
    hasCompanyId: boolean;
    columns: ReadonlyArray<{ key: string }>;
  }>,
): CompilerCatalog {
  const map = new Map<string, CompilerRelation>();
  for (const t of tables) {
    map.set(t.key, {
      columns: new Set(t.columns.map((c) => c.key)),
      hasCompanyId: t.hasCompanyId,
    });
  }
  return map;
}

export function compileQuery(spec: QuerySpec, ctx: CompileContext): CompiledQuery {
  const rel = ctx.catalog.get(spec.source);
  if (!rel) throw new UnknownIdentifierError('tablo', spec.source);

  const checkCol = (c: string): string => {
    if (!rel.columns.has(c)) throw new UnknownIdentifierError('kolon', `${spec.source}.${c}`);
    return c;
  };

  const values: unknown[] = [];
  const bind = (v: unknown): string => {
    values.push(v);
    return '$' + String(values.length);
  };

  const defByName = new Map((ctx.paramDefs ?? []).map((d) => [d.name, d]));
  const resolveParam = (name: string): unknown => {
    const def = defByName.get(name);
    const raw = (ctx.params ?? {})[name];
    return def ? coerceParamValue(def, raw) : (raw ?? null);
  };

  // --- SELECT ---
  const hasAgg = spec.columns.some((c) => c.agg);
  const selectParts: string[] = [];
  const nonAggCols: string[] = [];
  for (const c of spec.columns) {
    let expr: string;
    if (c.agg) {
      if (c.agg === 'count' && c.col === '*') {
        expr = 'COUNT(*)';
      } else {
        checkCol(c.col);
        expr = `${c.agg.toUpperCase()}(${qid(c.col)})`;
      }
    } else {
      checkCol(c.col);
      expr = qid(c.col);
      nonAggCols.push(c.col);
    }
    const alias =
      c.alias && c.alias.trim()
        ? c.alias.trim()
        : c.agg
          ? `${c.agg}_${c.col === '*' ? 'all' : c.col}`
          : c.col;
    selectParts.push(`${expr} AS ${qid(alias)}`);
  }

  // --- WHERE ---
  const whereParts: string[] = [];
  for (const f of spec.filters ?? []) {
    checkCol(f.col);
    const id = qid(f.col);
    if (f.op === 'is null') {
      whereParts.push(`${id} IS NULL`);
      continue;
    }
    if (f.op === 'is not null') {
      whereParts.push(`${id} IS NOT NULL`);
      continue;
    }
    const val = f.param !== undefined ? resolveParam(f.param) : f.value;
    if (val === undefined) {
      throw new InvalidQuerySpecError(`filtre değeri eksik: ${f.col}`);
    }
    if (f.op === 'in') {
      if (!Array.isArray(val)) throw new InvalidQuerySpecError(`'in' için dizi gerekli: ${f.col}`);
      whereParts.push(`${id} = ANY(${bind(val)})`);
    } else if (f.op === 'between') {
      if (!Array.isArray(val) || val.length !== 2) {
        throw new InvalidQuerySpecError(`'between' için 2 değer gerekli: ${f.col}`);
      }
      whereParts.push(`${id} BETWEEN ${bind(val[0])} AND ${bind(val[1])}`);
    } else {
      const opSql = COMPARE_OPS[f.op as FilterOp];
      if (!opSql) throw new InvalidQuerySpecError(`geçersiz operatör: ${f.op}`);
      whereParts.push(`${id} ${opSql} ${bind(val)}`);
    }
  }

  // company_id otomatik izolasyon
  if (rel.hasCompanyId) {
    whereParts.push(`${qid('company_id')} = ${bind(ctx.companyId)}`);
  }

  // --- GROUP BY ---
  let groupCols: string[] = [];
  if (spec.groupBy && spec.groupBy.length > 0) {
    groupCols = spec.groupBy.map(checkCol);
  } else if (hasAgg && nonAggCols.length > 0) {
    groupCols = nonAggCols; // agregasyon varsa agregasız kolonları otomatik grupla
  }

  // --- ORDER BY ---
  const orderParts = (spec.orderBy ?? []).map((o) => {
    checkCol(o.col);
    return `${qid(o.col)} ${o.dir === 'desc' ? 'DESC' : 'ASC'}`;
  });

  // --- LIMIT ---
  const limit =
    spec.limit && Number.isInteger(spec.limit) && spec.limit > 0
      ? Math.min(spec.limit, 50_000)
      : null;

  let sql = `SELECT ${selectParts.join(', ')}\nFROM ${qid(spec.source)}`;
  if (whereParts.length) sql += `\nWHERE ${whereParts.join(' AND ')}`;
  if (groupCols.length) sql += `\nGROUP BY ${groupCols.map(qid).join(', ')}`;
  if (orderParts.length) sql += `\nORDER BY ${orderParts.join(', ')}`;
  if (limit) sql += `\nLIMIT ${limit}`;

  return { sql, values };
}
