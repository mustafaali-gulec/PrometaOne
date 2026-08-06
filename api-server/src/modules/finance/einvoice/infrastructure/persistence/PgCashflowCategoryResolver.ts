/**
 * PgCashflowCategoryResolver — frontend kategori referansını (yerel client_id
 * "npo_1" veya sunucu sayısal id'si) şirketin categories kümesinde çözer.
 * PgAdoptFinanceKasaRepository.loadCategoryResolver ile aynı kural: önce
 * client_id eşleşmesi, sonra geçerli sayısal id.
 */
import type { Pool } from 'pg';

import type { CashflowCategoryResolver } from '../../application/ports/EInvoiceRepositories.js';

const NUMERIC_ID_RE = /^\d+$/;

export class PgCashflowCategoryResolver implements CashflowCategoryResolver {
  constructor(private readonly pool: Pool) {}

  async resolveRef(companyId: number, ref: string): Promise<number | null> {
    const byClient = await this.pool.query(
      'SELECT id FROM categories WHERE company_id = $1 AND client_id = $2 LIMIT 1',
      [companyId, ref],
    );
    const clientHit = (byClient.rows ?? [])[0] as { id: number | string } | undefined;
    if (clientHit !== undefined) return Number(clientHit.id);

    if (NUMERIC_ID_RE.test(ref)) {
      const byId = await this.pool.query(
        'SELECT id FROM categories WHERE company_id = $1 AND id = $2 LIMIT 1',
        [companyId, Number(ref)],
      );
      const idHit = (byId.rows ?? [])[0] as { id: number | string } | undefined;
      if (idHit !== undefined) return Number(idHit.id);
    }
    return null;
  }
}
