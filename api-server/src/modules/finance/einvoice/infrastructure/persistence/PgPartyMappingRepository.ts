/**
 * PgPartyMappingRepository — einvoice_party_mapping (016).
 */
import type { Queryable } from '../../../infrastructure/persistence/Queryable.js';
import type { PartyMappingRepository } from '../../application/ports/EInvoiceRepositories.js';
import { PartyMapping } from '../../domain/entities/PartyMapping.js';

interface PartyMappingRow {
  id: number;
  company_id: number;
  vkn_tckn: string;
  display_name: string | null;
  cashflow_cat_id: number | null;
  auto_import: boolean;
  notes: string | null;
}

const COLS = 'id, company_id, vkn_tckn, display_name, cashflow_cat_id, auto_import, notes';

export class PgPartyMappingRepository implements PartyMappingRepository {
  constructor(private readonly db: Queryable) {}

  async findByVkn(companyId: number, vknTckn: string): Promise<PartyMapping | null> {
    const r = await this.db.query<PartyMappingRow>(
      `SELECT ${COLS} FROM einvoice_party_mapping
        WHERE company_id = $1 AND vkn_tckn = $2 LIMIT 1`,
      [companyId, vknTckn],
    );
    const row = r.rows[0];
    return row ? rowToMapping(row) : null;
  }

  async upsert(mapping: PartyMapping): Promise<PartyMapping> {
    const j = mapping.toJSON();
    const r = await this.db.query<PartyMappingRow>(
      `INSERT INTO einvoice_party_mapping
         (company_id, vkn_tckn, display_name, cashflow_cat_id, auto_import, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (company_id, vkn_tckn) DO UPDATE SET
         display_name = EXCLUDED.display_name, cashflow_cat_id = EXCLUDED.cashflow_cat_id,
         auto_import = EXCLUDED.auto_import, notes = EXCLUDED.notes, updated_at = NOW()
       RETURNING ${COLS}`,
      [j.companyId, j.vknTckn, j.displayName, j.cashflowCatId, j.autoImport, j.notes],
    );
    return rowToMapping(r.rows[0]!);
  }

  async listByCompany(companyId: number): Promise<ReadonlyArray<PartyMapping>> {
    const r = await this.db.query<PartyMappingRow>(
      `SELECT ${COLS} FROM einvoice_party_mapping WHERE company_id = $1 ORDER BY vkn_tckn ASC`,
      [companyId],
    );
    return r.rows.map(rowToMapping);
  }
}

function rowToMapping(row: PartyMappingRow): PartyMapping {
  return PartyMapping.create({
    id: row.id,
    companyId: row.company_id,
    vknTckn: row.vkn_tckn,
    displayName: row.display_name,
    cashflowCatId: row.cashflow_cat_id,
    autoImport: row.auto_import,
    notes: row.notes,
  });
}
