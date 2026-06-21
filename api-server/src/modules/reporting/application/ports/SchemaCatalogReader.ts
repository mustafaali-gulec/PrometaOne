/**
 * SchemaCatalogReader portu — raporlanabilir şema kataloğunu (allowlist tablo/
 * view + information_schema kolonları) okur.
 * Concrete: infrastructure/persistence/PgSchemaCatalogReader.ts
 */
import type { RelationKind } from '../../domain/catalog/ReportCatalog.js';

export interface CatalogColumn {
  key: string;
  label: string;
  /** number | text | date | timestamp | bool */
  type: string;
}

export interface CatalogTable {
  key: string;
  label: string;
  kind: RelationKind;
  group: string;
  hasCompanyId: boolean;
  columns: CatalogColumn[];
}

export interface SchemaCatalogReader {
  /** Allowlist'teki ilişkilerin kolonlarıyla birlikte kataloğunu döner. */
  readCatalog(): Promise<CatalogTable[]>;
}
