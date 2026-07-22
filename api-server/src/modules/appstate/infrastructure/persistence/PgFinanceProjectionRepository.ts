/**
 * PgFinanceProjectionRepository — FinanceProjectionMirror PG implementasyonu.
 * Tablolar: banks / bank_accounts / categories (üst entiteler)
 * + cells / transfers / invoices / invoice_payments (detaylar)
 * (003/004/005/015/017 + 048_finance_projection.sql client_id kolonları).
 *
 * MEZUNİYET (yazma-cutover): kasa_accounts + kasa_entries SUNUCU-OTORİTERDİR
 * (FinanceProjection.GRADUATED_COLLECTIONS; POST /v1/finance/kasa/adopt-blob).
 * Bu repository o iki tabloya ASLA dokunmaz — upsert de prune/delete da yok.
 * Prune/delete edilseydi adopt edilen (client_id dolu) satırlar boş projeksiyon
 * kümesiyle SİLİNİRDİ. Transferlerin kasa uçları ve invoice_payments'ın kasa
 * referansı DB'deki geçerli kasa kümesinden çözülür: client_id eşleşmesi (eski
 * "ksa_..." referansları / önceki adopt) → sayısal sunucu id doğrulaması (FE
 * önbelleği sunucu id taşır) → çözülemeyen transfer düşer (from_id/to_id NOT
 * NULL), çözülemeyen ödeme referansı NULL kalır (kolon nullable).
 *
 * replaceAll TEK transaction'da (PgHrProjectionRepository kalıbı) ve YALNIZ
 * projeksiyon-sahipli satırlara (client_id IS NOT NULL) dokunur; finance CRUD
 * satırları (client_id IS NULL) korunur. Akış:
 *
 *   0. companies lookup: var olmayan company_id'li satırlar FK ihlali yerine
 *      DÜŞÜRÜLÜR (console.error). banks GLOBAL'dir (şirket kolonu yok) —
 *      filtrelenmez.
 *   1. ÜST ENTİTELER — upsert (serial id kararlı) + (sonda) prune, FK sırasıyla:
 *      banks → categories → bank_accounts.
 *      Upsert: UPDATE ... WHERE client_id → yoksa INSERT. Doğal anahtar
 *      devralması yalnız tam-unique kısıtı olan tablolarda:
 *        banks      → ON CONFLICT (code)
 *        categories → ON CONFLICT (company_id, section, name)
 *   2. DETAYLAR — delete-then-insert (serial id churn'ü ayna için kabul):
 *      cells (doğal anahtar (company, category, fiscal_year, month_idx)
 *      çakışmasında CRUD hücresi DEVRALINIR — ON CONFLICT DO UPDATE),
 *      transfers, invoices (+ invoice_payments; fatura silme
 *      ödemeleri CASCADE süpürür). FK'lar 1. adımda kurulan client→serial
 *      haritalarından çözülür (kasa uçları MEZUN kasa_accounts kümesinden —
 *      yukarıya bkz.); çözülemeyen satır düşürülür + sayaç loglanır.
 *      NOT: invoice_payments INSERT'i DB trigger'ıyla invoices.paid_amount'u
 *      ödemelerin toplamına eşitler — payments'ı OLAN faturada trigger kazanır,
 *      olmayanda blob paidAmount (kırpılmış) kalır. Domain, ödeme toplamını
 *      total + 0.01 ile sınırlar (CHECK patlamaz).
 *   3. PRUNE — çocuktan ebeveyne: bank_accounts → categories →
 *      banks (bank_accounts.bank_id FK'sı RESTRICT-benzeri NO ACTION olduğundan
 *      banks en son). kasa_accounts MEZUN — prune edilmez.
 *
 * Bilinen sınırlar (access/hr emsallerindeki gibi — hata üst katmanda yutulur,
 * ayna bir önceki tutarlı hâlinde kalır; kaynak-of-truth blob olduğundan veri
 * kaybı yoktur):
 *   - banks.name UNIQUE: blob bankası bir CRUD bankasıyla yalnız AD üzerinden
 *     çakışırsa (code farklı) transaction geri alınır.
 *   - categories UPDATE'i (company, section, name) CRUD satırıyla çakışırsa
 *     geri alınır (batch içi çiftler domain'de düşürülür).
 *   - CRUD satırı bir projeksiyon satırına elle FK bağlanmışsa (örn. CRUD
 *     bank_account → projeksiyon banks) prune geri alabilir.
 */
import type { FinanceProjectionMirror } from '../../application/ports/FinanceProjectionMirror.js';
import type {
  FinanceBankAccountProjection,
  FinanceBankProjection,
  FinanceCategoryProjection,
  FinanceCellProjection,
  FinanceInvoicePaymentProjection,
  FinanceInvoiceProjection,
  FinanceProjection,
  FinanceTransferProjection,
} from '../../domain/FinanceProjection.js';

/** pg.PoolClient'ın burada kullanılan alt kümesi (testte mock'lanabilir). */
export interface FinanceProjectionPoolClient {
  query(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<{ rows?: unknown[]; rowCount?: number | null }>;
  release(): void;
}

/** pg.Pool'un burada kullanılan alt kümesi. */
export interface FinanceProjectionPool {
  connect(): Promise<FinanceProjectionPoolClient>;
}

interface IdRow {
  id: number;
}

function firstIdOf(result: { rows?: unknown[] }): number | null {
  const row = result.rows?.[0] as IdRow | undefined;
  if (row === undefined) return null;
  const id = Number(row.id);
  return Number.isFinite(id) ? id : null;
}

type IdMap = Map<string, number>;

const NUMERIC_ID_RE = /^[0-9]+$/;

/** MEZUN kasa_accounts referans çözücüsü — çözülemezse undefined. */
type KasaAccountResolver = (ref: string) => number | undefined;

export class PgFinanceProjectionRepository implements FinanceProjectionMirror {
  constructor(private readonly pool: FinanceProjectionPool) {}

  async replaceAll(projection: FinanceProjection): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 0) Var olan şirketler — FK ihlali yerine satır düşürme (banks hariç).
      const companiesRes = await client.query('SELECT id FROM companies');
      const known = new Set((companiesRes.rows ?? []).map((r) => Number((r as IdRow).id)));
      const p = filterByCompany(projection, known);

      // 1) ÜST ENTİTELER — upsert + (sonda) prune.
      // kasa_accounts MEZUN — upsert edilmez; kasa referansları DB'deki geçerli
      // kümeden çözülür (yalnız kasa referansı varsa yüklenir).
      const bankIds = await this.upsertBanks(client, p.banks);
      const categoryIds = await this.upsertCategories(client, p.categories);
      const bankAccountIds = await this.upsertBankAccounts(
        client,
        p.bankAccounts,
        bankIds,
        categoryIds,
      );
      const kasaResolver = await this.loadKasaResolver(client, p);

      // 2) DETAYLAR — delete-then-insert (yalnız projeksiyon-sahipli satırlar).
      // kasa_entries MEZUN — delete de insert da yok (adopt/CRUD satırları
      // korunur).
      await client.query('DELETE FROM cells WHERE client_id IS NOT NULL');
      await this.insertCells(client, p.cells, categoryIds);

      await client.query('DELETE FROM transfers WHERE client_id IS NOT NULL');
      await this.insertTransfers(client, p.transfers, bankAccountIds, kasaResolver, categoryIds);

      // Fatura silme ödemeleri CASCADE süpürür; CRUD faturasına yanlışlıkla
      // bağlanmış projeksiyon ödemesi kalmasın diye ödemeler de ayrıca silinir.
      await client.query('DELETE FROM invoice_payments WHERE client_id IS NOT NULL');
      await client.query('DELETE FROM invoices WHERE client_id IS NOT NULL');
      const invoiceIds = await this.insertInvoices(client, p.invoices, categoryIds);
      await this.insertInvoicePayments(
        client,
        p.invoicePayments,
        invoiceIds,
        bankAccountIds,
        kasaResolver,
      );

      // 3) PRUNE — çocuktan ebeveyne (detaylar zaten silindi/yeniden yazıldı).
      // kasa_accounts MEZUN — prune edilmez.
      await this.prune(client, 'bank_accounts', p.bankAccounts);
      await this.prune(client, 'categories', p.categories);
      await this.prune(client, 'banks', p.banks);

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK hatası orijinal hatayı gölgelemesin
      }
      throw err;
    } finally {
      client.release();
    }
  }

  private async prune(
    client: FinanceProjectionPoolClient,
    table: string,
    rows: readonly { clientId: string }[],
  ): Promise<void> {
    await client.query(
      `DELETE FROM ${table}
        WHERE client_id IS NOT NULL AND NOT (client_id = ANY($1::text[]))`,
      [rows.map((r) => r.clientId)],
    );
  }

  // --- Üst entite upsert'leri ------------------------------------------------

  private async upsertBanks(
    client: FinanceProjectionPoolClient,
    banks: readonly FinanceBankProjection[],
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    for (const bank of banks) {
      const values = [bank.name, bank.code, bank.color, bank.clientId];
      const updated = await client.query(
        `UPDATE banks
            SET name = $1, code = $2, color = $3
          WHERE client_id = $4
          RETURNING id`,
        values,
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        // Doğal anahtar devralma: aynı koddaki CRUD bankası projeksiyona geçer.
        const inserted = await client.query(
          `INSERT INTO banks (name, code, color, client_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (code)
           DO UPDATE SET name      = EXCLUDED.name,
                         color     = EXCLUDED.color,
                         client_id = EXCLUDED.client_id
           RETURNING id`,
          values,
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) ids.set(bank.clientId, id);
    }
    return ids;
  }

  private async upsertCategories(
    client: FinanceProjectionPoolClient,
    categories: readonly FinanceCategoryProjection[],
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    for (const cat of categories) {
      const values = [
        cat.companyId,
        cat.section,
        cat.name,
        cat.sortOrder,
        cat.active,
        cat.clientId,
      ];
      const updated = await client.query(
        `UPDATE categories
            SET company_id = $1, section = $2::category_section, name = $3,
                sort_order = $4, active = $5, updated_at = NOW()
          WHERE client_id = $6
          RETURNING id`,
        values,
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        // Doğal anahtar devralma: aynı (company, section, name) CRUD kategorisi
        // projeksiyon sahipliğine geçer.
        const inserted = await client.query(
          `INSERT INTO categories (company_id, section, name, sort_order, active, client_id)
           VALUES ($1, $2::category_section, $3, $4, $5, $6)
           ON CONFLICT (company_id, section, name)
           DO UPDATE SET sort_order = EXCLUDED.sort_order,
                         active     = EXCLUDED.active,
                         client_id  = EXCLUDED.client_id,
                         updated_at = NOW()
           RETURNING id`,
          values,
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) ids.set(cat.clientId, id);
    }
    return ids;
  }

  private async upsertBankAccounts(
    client: FinanceProjectionPoolClient,
    accounts: readonly FinanceBankAccountProjection[],
    bankIds: ReadonlyMap<string, number>,
    categoryIds: ReadonlyMap<string, number>,
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    let unresolved = 0;
    for (const acc of accounts) {
      const bankId = bankIds.get(acc.bankClientId);
      if (bankId === undefined) {
        unresolved += 1; // bank_id NOT NULL — düşür
        continue;
      }
      const cashflowCatId =
        acc.cashflowCatClientId !== null
          ? (categoryIds.get(acc.cashflowCatClientId) ?? null)
          : null;
      const values = [
        acc.companyId,
        bankId,
        acc.name,
        acc.iban,
        acc.accountingCode,
        acc.currency,
        acc.openingBalance,
        cashflowCatId,
        acc.active,
        acc.clientId,
      ];
      const updated = await client.query(
        `UPDATE bank_accounts
            SET company_id = $1, bank_id = $2, name = $3, iban = $4,
                accounting_code = $5, currency = $6::currency_code,
                opening_balance = $7, cashflow_cat_id = $8, active = $9,
                updated_at = NOW()
          WHERE client_id = $10
          RETURNING id`,
        values,
      );
      let id = (updated.rowCount ?? 0) > 0 ? firstIdOf(updated) : null;
      if (id === null) {
        const inserted = await client.query(
          `INSERT INTO bank_accounts
             (company_id, bank_id, name, iban, accounting_code, currency,
              opening_balance, cashflow_cat_id, active, client_id)
           VALUES ($1, $2, $3, $4, $5, $6::currency_code, $7, $8, $9, $10)
           RETURNING id`,
          values,
        );
        id = firstIdOf(inserted);
      }
      if (id !== null) ids.set(acc.clientId, id);
    }
    if (unresolved > 0) {
      console.error(`[appstate:finance] ${unresolved} banka hesabı düşürüldü (bank_id çözülemedi)`);
    }
    return ids;
  }

  /**
   * MEZUN kasa_accounts çözücüsü (işe alım emsalindeki departman çözücü
   * kalıbı): DB'deki geçerli kasa kümesi — client_id haritası (eski "ksa_..."
   * referansları / önceki adopt) + geçerli sayısal sunucu id kümesi (FE
   * önbelleği sunucu id taşır). Yalnız kasa referansı varsa yüklenir.
   */
  private async loadKasaResolver(
    client: FinanceProjectionPoolClient,
    p: FinanceProjection,
  ): Promise<KasaAccountResolver> {
    const needed =
      p.transfers.some((t) => t.fromType === 'kasa' || t.toType === 'kasa') ||
      p.invoicePayments.some((pay) => pay.kasaAccountClientId !== null);
    const byClient = new Map<string, number>();
    const validIds = new Set<number>();
    if (needed) {
      const res = await client.query('SELECT id, client_id FROM kasa_accounts');
      for (const raw of res.rows ?? []) {
        const row = raw as { id: number; client_id: string | null };
        const id = Number(row.id);
        if (!Number.isFinite(id)) continue;
        validIds.add(id);
        if (row.client_id !== null && row.client_id !== undefined) {
          byClient.set(row.client_id, id);
        }
      }
    }
    return (ref: string): number | undefined => {
      const hit = byClient.get(ref);
      if (hit !== undefined) return hit;
      if (NUMERIC_ID_RE.test(ref)) {
        const n = Number(ref);
        if (validIds.has(n)) return n; // FE önbelleği sunucu id'si
      }
      return undefined;
    };
  }

  // --- Detay insert'leri -------------------------------------------------------

  private async insertCells(
    client: FinanceProjectionPoolClient,
    cells: readonly FinanceCellProjection[],
    categoryIds: ReadonlyMap<string, number>,
  ): Promise<void> {
    let unresolved = 0;
    for (const cell of cells) {
      const categoryId = categoryIds.get(cell.categoryClientId);
      if (categoryId === undefined) {
        unresolved += 1;
        continue;
      }
      // Doğal anahtar devralma: aynı (company, category, year, month) CRUD
      // hücresi projeksiyon sahipliğine geçer (UNIQUE ihlali olmasın).
      await client.query(
        `INSERT INTO cells (company_id, category_id, fiscal_year, month_idx, value, client_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (company_id, category_id, fiscal_year, month_idx)
         DO UPDATE SET value = EXCLUDED.value, client_id = EXCLUDED.client_id`,
        [cell.companyId, categoryId, cell.fiscalYear, cell.monthIdx, cell.value, cell.clientId],
      );
    }
    if (unresolved > 0) {
      console.error(`[appstate:finance] ${unresolved} hücre düşürüldü (category çözülemedi)`);
    }
  }

  private async insertTransfers(
    client: FinanceProjectionPoolClient,
    transfers: readonly FinanceTransferProjection[],
    bankAccountIds: ReadonlyMap<string, number>,
    resolveKasa: KasaAccountResolver,
    categoryIds: ReadonlyMap<string, number>,
  ): Promise<void> {
    const endpointId = (type: 'bank' | 'kasa', clientId: string): number | undefined =>
      type === 'bank' ? bankAccountIds.get(clientId) : resolveKasa(clientId);

    let unresolved = 0;
    for (const tr of transfers) {
      const fromId = endpointId(tr.fromType, tr.fromClientId);
      const toId = endpointId(tr.toType, tr.toClientId);
      if (fromId === undefined || toId === undefined) {
        unresolved += 1; // from_id/to_id NOT NULL — düşür
        continue;
      }
      const cashflowCatId =
        tr.cashflowCatClientId !== null ? (categoryIds.get(tr.cashflowCatClientId) ?? null) : null;
      await client.query(
        `INSERT INTO transfers
           (company_id, date, from_type, from_id, to_type, to_id, from_amount,
            to_amount, from_currency, to_currency, description, cashflow_cat_id,
            client_id)
         VALUES ($1, $2, $3::endpoint_type, $4, $5::endpoint_type, $6, $7, $8,
                 $9::currency_code, $10::currency_code, $11, $12, $13)`,
        [
          tr.companyId,
          tr.date,
          tr.fromType,
          fromId,
          tr.toType,
          toId,
          tr.fromAmount,
          tr.toAmount,
          tr.fromCurrency,
          tr.toCurrency,
          tr.description,
          cashflowCatId,
          tr.clientId,
        ],
      );
    }
    if (unresolved > 0) {
      console.error(
        `[appstate:finance] ${unresolved} transfer düşürüldü (kaynak/hedef hesap çözülemedi)`,
      );
    }
  }

  private async insertInvoices(
    client: FinanceProjectionPoolClient,
    invoices: readonly FinanceInvoiceProjection[],
    categoryIds: ReadonlyMap<string, number>,
  ): Promise<IdMap> {
    const ids: IdMap = new Map();
    for (const inv of invoices) {
      const cashflowCatId =
        inv.cashflowCatClientId !== null
          ? (categoryIds.get(inv.cashflowCatClientId) ?? null)
          : null;
      const inserted = await client.query(
        `INSERT INTO invoices
           (company_id, type, invoice_no, counterparty, issue_date, due_date,
            currency, subtotal, kdv_rate, kdv, total, paid_amount,
            cashflow_cat_id, committed_to_cells, note, client_id)
         VALUES ($1, $2::flow_direction, $3, $4, $5, $6, $7::currency_code, $8,
                 $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id`,
        [
          inv.companyId,
          inv.type,
          inv.invoiceNo,
          inv.counterparty,
          inv.issueDate,
          inv.dueDate,
          inv.currency,
          inv.subtotal,
          inv.kdvRate,
          inv.kdv,
          inv.total,
          inv.paidAmount,
          cashflowCatId,
          inv.committedToCells,
          inv.note,
          inv.clientId,
        ],
      );
      const id = firstIdOf(inserted);
      if (id !== null) ids.set(inv.clientId, id);
    }
    return ids;
  }

  private async insertInvoicePayments(
    client: FinanceProjectionPoolClient,
    payments: readonly FinanceInvoicePaymentProjection[],
    invoiceIds: ReadonlyMap<string, number>,
    bankAccountIds: ReadonlyMap<string, number>,
    resolveKasa: KasaAccountResolver,
  ): Promise<void> {
    let unresolved = 0;
    for (const pay of payments) {
      const invoiceId = invoiceIds.get(pay.invoiceClientId);
      if (invoiceId === undefined) {
        unresolved += 1; // invoice_id NOT NULL — düşür
        continue;
      }
      const bankAccountId =
        pay.bankAccountClientId !== null
          ? (bankAccountIds.get(pay.bankAccountClientId) ?? null)
          : null;
      // CHECK: bank XOR kasa (ya da ikisi de NULL) — bank çözüldüyse kasa verilmez.
      // kasa MEZUN — DB kümesinden çözülür (client_id + sayısal id fallback);
      // çözülemezse NULL (kolon nullable).
      const kasaAccountId =
        bankAccountId === null && pay.kasaAccountClientId !== null
          ? (resolveKasa(pay.kasaAccountClientId) ?? null)
          : null;
      await client.query(
        `INSERT INTO invoice_payments
           (invoice_id, amount, date, currency, bank_account_id, kasa_account_id,
            note, client_id)
         VALUES ($1, $2, $3, $4::currency_code, $5, $6, $7, $8)`,
        [
          invoiceId,
          pay.amount,
          pay.date,
          pay.currency,
          bankAccountId,
          kasaAccountId,
          pay.note,
          pay.clientId,
        ],
      );
    }
    if (unresolved > 0) {
      console.error(
        `[appstate:finance] ${unresolved} fatura ödemesi düşürüldü (fatura çözülemedi)`,
      );
    }
  }
}

/**
 * companies'te olmayan company_id'li satırları düşürür (console.error ile
 * raporlar). banks GLOBAL'dir — filtrelenmez.
 */
function filterByCompany(
  projection: FinanceProjection,
  known: ReadonlySet<number>,
): FinanceProjection {
  const keep = <T extends { companyId: number }>(rows: readonly T[]): T[] =>
    rows.filter((r) => known.has(r.companyId));

  const filtered: FinanceProjection = {
    banks: [...projection.banks],
    bankAccounts: keep(projection.bankAccounts),
    kasaAccounts: keep(projection.kasaAccounts),
    categories: keep(projection.categories),
    cells: keep(projection.cells),
    kasaEntries: keep(projection.kasaEntries),
    transfers: keep(projection.transfers),
    invoices: keep(projection.invoices),
    invoicePayments: keep(projection.invoicePayments),
    dropped: projection.dropped,
  };

  const countOf = (pr: FinanceProjection): number =>
    pr.bankAccounts.length +
    pr.kasaAccounts.length +
    pr.categories.length +
    pr.cells.length +
    pr.kasaEntries.length +
    pr.transfers.length +
    pr.invoices.length +
    pr.invoicePayments.length;

  const before = countOf(projection);
  const after = countOf(filtered);
  if (before > after) {
    console.error(
      `[appstate:finance] ${before - after} satır düşürüldü (companies'te olmayan company_id) — blob şirket anahtarı sunucu şirketine haritalanamadı`,
    );
  }
  return filtered;
}
