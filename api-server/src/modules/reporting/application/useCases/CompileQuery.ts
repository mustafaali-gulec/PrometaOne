/**
 * CompileQuery — görsel spec'i SQL'e derler (ÇALIŞTIRMADAN). Frontend canlı
 * SQL önizlemesi için kullanır. DB'ye dokunmaz (yalnız katalog metadata'sı).
 */
import { buildCompilerCatalog, compileQuery } from '../../domain/compiler/QueryCompiler.js';
import type { QuerySpec } from '../../domain/compiler/QuerySpec.js';
import type { ParamDef } from '../../domain/params/ParamBinder.js';
import { assertSafeSelect } from '../../domain/sql/SqlGuard.js';
import type { SchemaCatalogReader } from '../ports/SchemaCatalogReader.js';

export interface CompileQueryInput {
  companyId: number;
  spec: QuerySpec;
  params?: Record<string, unknown>;
  paramDefs?: ParamDef[];
}

export class CompileQueryUseCase {
  constructor(private readonly catalogReader: SchemaCatalogReader) {}

  async execute(input: CompileQueryInput): Promise<{ sql: string; paramCount: number }> {
    const tables = await this.catalogReader.readCatalog();
    const compiled = compileQuery(input.spec, {
      catalog: buildCompilerCatalog(tables),
      companyId: input.companyId,
      params: input.params ?? {},
      paramDefs: input.paramDefs ?? [],
    });
    assertSafeSelect(compiled.sql); // güvenlik sağlaması
    return { sql: compiled.sql, paramCount: compiled.values.length };
  }
}
