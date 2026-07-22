/**
 * PgAdoptFinanceKasaRepository — AdoptFinanceKasaRepository PG implementasyonu.
 * Tablolar: kasa_accounts, kasa_entries (004_banks_kasa_transfers.sql +
 * 048_finance_projection.sql client_id kolonları).
 * Emsal: PgAdoptHrRecruitingRepository (işe alım yazma-cutover'ı).
 *
 * adoptAll TEK transaction'da (BEGIN/COMMIT/ROLLBACK):
 *   1. Kategori çözücü (yalnız cashflowCatRef'li hareket varsa): şirketin
 *      categories kümesi (client_id haritası + geçerli sayısal id doğrulaması
 *      — kategoriler projeksiyon/CRUD karışık, FE önbelleği sunucu id
 *      taşıyabilir). Çözülemeyen NULL (nullable FK).
 *   2. kasa_accounts upsert — ON CONFLICT (company_id, client_id) DO UPDATE
 *      (048 uq_kasa_accounts_company_client).
 *   3. entries.kasaRef üç kademeli çözülür (bu çağrının haritası → DB'deki
 *      client_id [önceki adopt / eski projeksiyon satırı] → geçerli sayısal
 *      sunucu id); çözülemeyen hareket DÜŞER (kasa_account_id NOT NULL),
 *      transaction bozulmaz, sayısı outcome.unresolvedEntries ile döner.
 *   4. kasa_entries upsert — ON CONFLICT (client_id) DO UPDATE
 *      (048 uq_kasa_entries_client — tabloda company_id yok, düz UNIQUE).
 *      committed_to_cells/committed_at/created_by adopt'ta DOKUNULMAZ
 *      (commit-to-cells durumu korunur).
 *
 * Kalan 23505 (beklenmedik benzersizlik çakışması) 409'a çevrilir
 * (FinanceKasaAdoptConflictError).
 */
import type {
  NormalizedAdoptKasaAccount,
  NormalizedAdoptKasaEntry,
} from '../../application/dto/AdoptFinanceKasaDtos.js';
import type {
  AdoptFinanceKasaOutcome,
  AdoptFinanceKasaPayload,
  AdoptFinanceKasaRepository,
} from '../../application/ports/AdoptFinanceKasaRepository.js';
import { FinanceKasaAdoptConflictError } from '../../domain/errors/FinanceErrors.js';

/** pg.PoolClient'ın burada kullanılan alt kümesi (testte mock'lanabilir). */
export interface AdoptFinanceKasaPoolClient {
  query(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<{ rows?: unknown[]; rowCount?: number | null }>;
  release(): void;
}

/** pg.Pool'un burada kullanılan alt kümesi. */
export interface AdoptFinanceKasaPool {
  connect(): Promise<AdoptFinanceKasaPoolClient>;
}

function isUniqueViolation(err: unknown): err is { code: string; detail?: string } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505';
}

interface IdRow {
  id: number;
}

interface IdClientRow {
  id: number;
  client_id: string;
}

function firstIdOf(result: { rows?: unknown[] }): number | null {
  const row = result.rows?.[0] as IdRow | undefined;
  if (row === undefined) return null;
  const id = Number(row.id);
  return Number.isFinite(id) ? id : null;
}

const NUMERIC_ID_RE = /^[0-9]+$/;

export class PgAdoptFinanceKasaRepository implements AdoptFinanceKasaRepository {
  constructor(private readonly pool: AdoptFinanceKasaPool) {}

  async adoptAll(
    companyId: number,
    payload: AdoptFinanceKasaPayload,
  ): Promise<AdoptFinanceKasaOutcome> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const accountIdByClient = await this.upsertAccounts(client, companyId, payload.accounts);
      const { entryIdByClient, unresolvedEntries } = await this.upsertEntries(
        client,
        companyId,
        payload.entries,
        accountIdByClient,
      );

      await client.query('COMMIT');
      return { accountIdByClient, entryIdByClient, unresolvedEntries };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK hatası orijinal hatayı gölgelemesin
      }
      if (isUniqueViolation(err)) {
        throw new FinanceKasaAdoptConflictError(err.detail ?? 'benzersizlik çakışması');
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ===== KASA ACCOUNTS ======================================================

  private async upsertAccounts(
    client: AdoptFinanceKasaPoolClient,
    companyId: number,
    accounts: ReadonlyArray<NormalizedAdoptKasaAccount>,
  ): Promise<Record<string, number>> {
    const idByClient: Record<string, number> = {};
    for (const a of accounts) {
      const r = await client.query(
        `INSERT INTO kasa_accounts
           (company_id, name, currency, opening_balance, active, client_id)
         VALUES ($1, $2, $3::currency_code, $4, $5, $6)
         ON CONFLICT (company_id, client_id)
         DO UPDATE SET name            = EXCLUDED.name,
                       currency        = EXCLUDED.currency,
                       opening_balance = EXCLUDED.opening_balance,
                       active          = EXCLUDED.active,
                       updated_at      = NOW()
         RETURNING id`,
        [companyId, a.name, a.currency, a.openingBalance, a.active, a.clientId],
      );
      const id = firstIdOf(r);
      if (id !== null) idByClient[a.clientId] = id;
    }
    return idByClient;
  }

  // ===== KASA ENTRIES =======================================================

  /**
   * kasaRef çözümü: bu çağrının haritası → DB client_id (önceki adopt / eski
   * projeksiyon) → geçerli sayısal sunucu id doğrulaması (şirket kapsamlı).
   */
  private async resolveKasaRefs(
    client: AdoptFinanceKasaPoolClient,
    companyId: number,
    refs: ReadonlyArray<string>,
    inCall: Readonly<Record<string, number>>,
  ): Promise<Map<string, number>> {
    const resolved = new Map<string, number>(Object.entries(inCall));
    const missing = [...new Set(refs.filter((ref) => !resolved.has(ref)))];
    if (missing.length === 0) return resolved;

    const byClient = await client.query(
      `SELECT id, client_id FROM kasa_accounts
        WHERE company_id = $1 AND client_id = ANY($2::text[])`,
      [companyId, missing],
    );
    for (const row of (byClient.rows ?? []) as IdClientRow[]) {
      resolved.set(row.client_id, Number(row.id));
    }

    const numeric = [
      ...new Set(
        missing.filter((ref) => !resolved.has(ref) && NUMERIC_ID_RE.test(ref)).map(Number),
      ),
    ];
    if (numeric.length > 0) {
      const byId = await client.query(
        `SELECT id FROM kasa_accounts WHERE company_id = $1 AND id = ANY($2::int[])`,
        [companyId, numeric],
      );
      for (const row of (byId.rows ?? []) as IdRow[]) {
        resolved.set(String(row.id), Number(row.id));
      }
    }
    return resolved;
  }

  /**
   * Kategori çözücüsü: şirketin categories kümesi — client_id haritası +
   * geçerli sayısal id kümesi (yalnız cashflowCatRef'li hareket varsa yüklenir).
   */
  private async loadCategoryResolver(
    client: AdoptFinanceKasaPoolClient,
    companyId: number,
  ): Promise<(ref: string) => number | null> {
    const res = await client.query('SELECT id, client_id FROM categories WHERE company_id = $1', [
      companyId,
    ]);
    const byClient = new Map<string, number>();
    const valid = new Set<number>();
    for (const raw of res.rows ?? []) {
      const row = raw as { id: number; client_id: string | null };
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      valid.add(id);
      if (row.client_id !== null && row.client_id !== undefined) {
        byClient.set(row.client_id, id);
      }
    }
    return (ref: string): number | null => {
      const hit = byClient.get(ref);
      if (hit !== undefined) return hit;
      if (NUMERIC_ID_RE.test(ref)) {
        const n = Number(ref);
        if (valid.has(n)) return n; // FE önbelleği sunucu id'si
      }
      return null;
    };
  }

  private async upsertEntries(
    client: AdoptFinanceKasaPoolClient,
    companyId: number,
    entries: ReadonlyArray<NormalizedAdoptKasaEntry>,
    accountIdByClient: Readonly<Record<string, number>>,
  ): Promise<{ entryIdByClient: Record<string, number>; unresolvedEntries: number }> {
    const entryIdByClient: Record<string, number> = {};
    if (entries.length === 0) return { entryIdByClient, unresolvedEntries: 0 };

    const kasaIds = await this.resolveKasaRefs(
      client,
      companyId,
      entries.map((e) => e.kasaRef),
      accountIdByClient,
    );
    const resolveCategory = entries.some((e) => e.cashflowCatRef !== null)
      ? await this.loadCategoryResolver(client, companyId)
      : null;

    let unresolvedEntries = 0;
    for (const e of entries) {
      const kasaAccountId = kasaIds.get(e.kasaRef);
      if (kasaAccountId === undefined) {
        unresolvedEntries += 1; // kasa_account_id NOT NULL — düşer
        continue;
      }
      const cashflowCatId =
        e.cashflowCatRef !== null && resolveCategory !== null
          ? resolveCategory(e.cashflowCatRef)
          : null;
      const r = await client.query(
        `INSERT INTO kasa_entries
           (kasa_account_id, date, type, amount, description, category,
            cashflow_cat_id, client_id)
         VALUES ($1, $2, $3::flow_direction, $4, $5, $6, $7, $8)
         ON CONFLICT (client_id)
         DO UPDATE SET kasa_account_id = EXCLUDED.kasa_account_id,
                       date            = EXCLUDED.date,
                       type            = EXCLUDED.type,
                       amount          = EXCLUDED.amount,
                       description     = EXCLUDED.description,
                       category        = EXCLUDED.category,
                       cashflow_cat_id = EXCLUDED.cashflow_cat_id,
                       updated_at      = NOW()
         RETURNING id`,
        [
          kasaAccountId,
          e.date,
          e.type,
          e.amount,
          e.description,
          e.category,
          cashflowCatId,
          e.clientId,
        ],
      );
      const id = firstIdOf(r);
      if (id !== null) entryIdByClient[e.clientId] = id;
    }
    if (unresolvedEntries > 0) {
      console.error(
        `[finance:kasa-adopt] ${unresolvedEntries} kasa hareketi düşürüldü (kasa hesabı çözülemedi)`,
      );
    }
    return { entryIdByClient, unresolvedEntries };
  }
}
