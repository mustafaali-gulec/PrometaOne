/**
 * PgSchemaCatalogReader — SchemaCatalogReader PG implementasyonu.
 *
 * Allowlist'teki (ReportCatalog) tablo/view'ların kolonlarını
 * information_schema'dan okur (doğru, drift'siz). Hassas kolonlar
 * (isSensitiveColumn) çıkarılır. ANA pool kullanır (sadece metadata okuması).
 */
import type { Pool } from 'pg';

import type {
  CatalogTable,
  SchemaCatalogReader,
} from '../../application/ports/SchemaCatalogReader.js';
import {
  ALLOWED_RELATIONS,
  isSensitiveColumn,
  listAllowedRelations,
} from '../../domain/catalog/ReportCatalog.js';

interface ColRow {
  table_name: string;
  column_name: string;
  data_type: string;
}

/** information_schema.data_type → kaba tip ipucu. */
function dataTypeToHint(dt: string): string {
  const t = dt.toLowerCase();
  if (/(int|numeric|decimal|real|double|money|serial)/.test(t)) return 'number';
  if (t === 'boolean') return 'bool';
  if (t === 'date') return 'date';
  if (t.startsWith('timestamp') || t.startsWith('time')) return 'timestamp';
  return 'text';
}

export class PgSchemaCatalogReader implements SchemaCatalogReader {
  // Katalog nadiren değişir → kısa TTL cache (her run'da information_schema sorgusu olmasın).
  private cache: CatalogTable[] | null = null;
  private cacheAt = 0;
  private readonly ttlMs = 60_000;

  constructor(private readonly pool: Pool) {}

  async readCatalog(): Promise<CatalogTable[]> {
    const now = Date.now();
    if (this.cache && now - this.cacheAt < this.ttlMs) return this.cache;
    const relations = listAllowedRelations();
    const r = await this.pool.query<ColRow>(
      `SELECT table_name, column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position`,
      [relations],
    );

    // Tablo bazında kolonları topla.
    const byTable = new Map<string, ColRow[]>();
    for (const row of r.rows) {
      const list = byTable.get(row.table_name) ?? [];
      list.push(row);
      byTable.set(row.table_name, list);
    }

    // ALLOWED_RELATIONS sırasını koru; yalnız DB'de var olanları döndür.
    const tables: CatalogTable[] = [];
    for (const relation of relations) {
      const cols = byTable.get(relation);
      if (!cols || cols.length === 0) continue;
      const def = ALLOWED_RELATIONS[relation]!;
      tables.push({
        key: relation,
        label: def.label,
        kind: def.kind,
        group: def.group,
        hasCompanyId: cols.some((c) => c.column_name === 'company_id'),
        columns: cols
          .filter((c) => !isSensitiveColumn(c.column_name))
          .map((c) => ({
            key: c.column_name,
            label: c.column_name,
            type: dataTypeToHint(c.data_type),
          })),
      });
    }
    this.cache = tables;
    this.cacheAt = now;
    return tables;
  }
}
