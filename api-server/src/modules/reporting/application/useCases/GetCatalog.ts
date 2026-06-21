/**
 * GetCatalog — raporlanabilir şema kataloğunu (allowlist tablo/view + kolonlar)
 * döner. Hem SQL editör ipuçları hem görsel sorgu kurucu (P2) bunu kullanır.
 */
import type { CatalogTable, SchemaCatalogReader } from '../ports/SchemaCatalogReader.js';

export class GetCatalogUseCase {
  constructor(private readonly reader: SchemaCatalogReader) {}

  async execute(): Promise<{ tables: CatalogTable[] }> {
    const tables = await this.reader.readCatalog();
    return { tables };
  }
}
