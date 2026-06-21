/**
 * QuerySpec — görsel (no-code) sorgu kurucunun ürettiği JSON spec'i.
 * Derleyici (QueryCompiler) bunu güvenli parametreli SQL'e çevirir.
 *
 * P2 MVP: tek kaynak (join yok), kolon (+agregasyon), filtre, group by, order
 * by, limit. Tüm identifier'lar katalog allowlist'ine karşı doğrulanır.
 */
import { z } from 'zod';

export const AGGS = ['sum', 'avg', 'min', 'max', 'count'] as const;
export type Agg = (typeof AGGS)[number];

export const FILTER_OPS = [
  '=',
  '<>',
  '<',
  '<=',
  '>',
  '>=',
  'like',
  'ilike',
  'in',
  'between',
  'is null',
  'is not null',
] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export const SORT_DIRS = ['asc', 'desc'] as const;
export type SortDir = (typeof SORT_DIRS)[number];

export interface SpecColumn {
  col: string;
  agg?: Agg;
  alias?: string;
}
export interface SpecFilter {
  col: string;
  op: FilterOp;
  /** Parametre adı (varsa değer params'tan gelir); yoksa value kullanılır. */
  param?: string;
  value?: unknown;
}
export interface SpecOrder {
  col: string;
  dir: SortDir;
}
export interface QuerySpec {
  source: string;
  columns: SpecColumn[];
  filters?: SpecFilter[];
  groupBy?: string[];
  orderBy?: SpecOrder[];
  limit?: number;
}

export const querySpecSchema = z.object({
  source: z.string().min(1).max(120),
  columns: z
    .array(
      z.object({
        col: z.string().min(1).max(120),
        agg: z.enum(AGGS).optional(),
        alias: z.string().max(120).optional(),
      }),
    )
    .min(1)
    .max(60),
  filters: z
    .array(
      z.object({
        col: z.string().min(1).max(120),
        op: z.enum(FILTER_OPS),
        param: z.string().max(60).optional(),
        value: z.unknown().optional(),
      }),
    )
    .max(60)
    .optional(),
  groupBy: z.array(z.string().min(1).max(120)).max(60).optional(),
  orderBy: z
    .array(z.object({ col: z.string().min(1).max(120), dir: z.enum(SORT_DIRS) }))
    .max(60)
    .optional(),
  limit: z.number().int().positive().max(50_000).optional(),
});
