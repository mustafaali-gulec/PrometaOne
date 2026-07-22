/**
 * PgFinanceProjectionRepository birim testleri — SQL üretimi mock Pool/Client
 * ile doğrulanır (üst entite upsert + doğal anahtar devralma + prune, detay
 * delete-then-insert, FK serial çözümü, FK-siz şirket düşürme, rollback,
 * MEZUNİYET: kasa_accounts/kasa_entries'e dokunulmaz — kasa referansları
 * DB kümesinden çözülür [client_id + sayısal sunucu id fallback]).
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import type { FinanceProjection } from '../domain/FinanceProjection.js';
import {
  PgFinanceProjectionRepository,
  type FinanceProjectionPool,
  type FinanceProjectionPoolClient,
} from '../infrastructure/persistence/PgFinanceProjectionRepository.js';

interface RecordedCall {
  sql: string;
  values: readonly unknown[] | undefined;
}

interface FakeOptions {
  companies?: number[];
  /** UPDATE ... WHERE client_id — bu client_id'ler "var" sayılır (rowCount 1). */
  existingClientIds?: string[];
  /** MEZUN kasa_accounts çözücü SELECT'inin döneceği satırlar (DB içeriği). */
  dbKasaAccounts?: Array<{ id: number; client_id: string | null }>;
  failOn?: (sql: string) => boolean;
}

function makeFakePool(opts: FakeOptions = {}): {
  pool: FinanceProjectionPool;
  calls: RecordedCall[];
  released: () => boolean;
} {
  const calls: RecordedCall[] = [];
  let released = false;
  let nextId = 100;
  const client: FinanceProjectionPoolClient = {
    async query(sql: string, values?: readonly unknown[]) {
      calls.push({ sql, values });
      if (opts.failOn?.(sql)) throw new Error('patladı');
      if (sql.includes('SELECT id FROM companies')) {
        return { rows: (opts.companies ?? [1, 2, 3]).map((id) => ({ id })) };
      }
      if (sql.includes('SELECT id, client_id FROM kasa_accounts')) {
        return { rows: opts.dbKasaAccounts ?? [] };
      }
      if (sql.trimStart().startsWith('UPDATE') && sql.includes('WHERE client_id = $')) {
        const clientId = values?.[values.length - 1];
        const exists = (opts.existingClientIds ?? []).includes(String(clientId));
        return exists ? { rows: [{ id: nextId++ }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO') && sql.includes('RETURNING id')) {
        return { rows: [{ id: nextId++ }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {
      released = true;
    },
  };
  return { pool: { connect: async () => client }, calls, released: () => released };
}

const emptyProjection = (over: Partial<FinanceProjection> = {}): FinanceProjection => ({
  banks: [],
  bankAccounts: [],
  kasaAccounts: [],
  categories: [],
  cells: [],
  kasaEntries: [],
  transfers: [],
  invoices: [],
  invoicePayments: [],
  dropped: {},
  ...over,
});

/** Tam FK zincirli örnek projeksiyon (banka → hesap → transfer; fatura → ödeme). */
const fullProjection = (): FinanceProjection =>
  emptyProjection({
    banks: [{ clientId: 'bnk_1', name: 'YKB', code: 'YKB', color: '#003a70' }],
    categories: [
      {
        companyId: 2,
        clientId: 'in_1',
        section: 'inflows',
        name: 'Satış',
        sortOrder: 0,
        active: true,
      },
    ],
    bankAccounts: [
      {
        companyId: 2,
        clientId: 'acc_1',
        bankClientId: 'bnk_1',
        name: 'Vadesiz',
        iban: null,
        accountingCode: null,
        currency: 'TRY',
        openingBalance: 0,
        cashflowCatClientId: 'in_1',
        active: true,
      },
    ],
    // kasaAccounts/kasaEntries MEZUN — projeksiyon her zaman boş üretir.
    cells: [
      {
        companyId: 2,
        clientId: 'in_1:0',
        categoryClientId: 'in_1',
        fiscalYear: 2025,
        monthIdx: 0,
        value: 100,
      },
    ],
    transfers: [
      {
        companyId: 2,
        clientId: 'trf_1',
        date: '2026-01-02',
        fromType: 'bank',
        fromClientId: 'acc_1',
        toType: 'kasa',
        toClientId: 'ksa_1',
        fromAmount: 500,
        toAmount: 500,
        fromCurrency: 'TRY',
        toCurrency: 'TRY',
        description: null,
        cashflowCatClientId: null,
      },
    ],
    invoices: [
      {
        companyId: 2,
        clientId: 'inv_1',
        type: 'out',
        invoiceNo: 'FTR-1',
        counterparty: 'Acme',
        issueDate: '2026-01-05',
        dueDate: '2026-02-05',
        currency: 'TRY',
        subtotal: 100,
        kdvRate: 0.2,
        kdv: 20,
        total: 120,
        paidAmount: 50,
        cashflowCatClientId: null,
        committedToCells: false,
        note: null,
      },
    ],
    invoicePayments: [
      {
        companyId: 2,
        clientId: 'pay_1',
        invoiceClientId: 'inv_1',
        amount: 50,
        date: '2026-02-01',
        currency: 'TRY',
        bankAccountClientId: 'acc_1',
        kasaAccountClientId: null,
        note: null,
      },
    ],
  });

describe('PgFinanceProjectionRepository', () => {
  it('happy: BEGIN → companies lookup → upsert/insert zinciri → COMMIT + release', async () => {
    const { pool, calls, released } = makeFakePool({
      dbKasaAccounts: [{ id: 7, client_id: 'ksa_1' }],
    });
    await new PgFinanceProjectionRepository(pool).replaceAll(fullProjection());

    assert.equal(calls[0]!.sql, 'BEGIN');
    assert.ok(calls[1]!.sql.includes('SELECT id FROM companies'));
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
    assert.ok(released());
  });

  it('banks: yeni banka INSERT ... ON CONFLICT (code) ile devralınır', async () => {
    const { pool, calls } = makeFakePool();
    await new PgFinanceProjectionRepository(pool).replaceAll(
      emptyProjection({ banks: [{ clientId: 'bnk_1', name: 'YKB', code: 'YKB', color: null }] }),
    );

    const insert = calls.find((c) => c.sql.includes('INSERT INTO banks'));
    assert.ok(insert, 'banks INSERT bekleniyordu');
    assert.ok(insert.sql.includes('ON CONFLICT (code)'));
    assert.deepEqual(insert.values, ['YKB', 'YKB', null, 'bnk_1']);
  });

  it('banks: var olan client_id → UPDATE, INSERT atlanır', async () => {
    const { pool, calls } = makeFakePool({ existingClientIds: ['bnk_1'] });
    await new PgFinanceProjectionRepository(pool).replaceAll(
      emptyProjection({ banks: [{ clientId: 'bnk_1', name: 'YKB', code: 'YKB', color: null }] }),
    );

    assert.ok(calls.some((c) => c.sql.includes('UPDATE banks')));
    assert.ok(!calls.some((c) => c.sql.includes('INSERT INTO banks')));
  });

  it('categories: doğal anahtar devralması ON CONFLICT (company_id, section, name)', async () => {
    const { pool, calls } = makeFakePool({
      dbKasaAccounts: [{ id: 7, client_id: 'ksa_1' }],
    });
    await new PgFinanceProjectionRepository(pool).replaceAll(fullProjection());

    const insert = calls.find((c) => c.sql.includes('INSERT INTO categories'));
    assert.ok(insert);
    assert.ok(insert.sql.includes('ON CONFLICT (company_id, section, name)'));
  });

  it('FK zinciri: hesap banka serial id ile, transferin kasa ucu DB kasa kümesinden, ödeme fatura serial id ile yazılır', async () => {
    const { pool, calls } = makeFakePool({
      dbKasaAccounts: [{ id: 7, client_id: 'ksa_1' }],
    });
    await new PgFinanceProjectionRepository(pool).replaceAll(fullProjection());

    const bankInsert = calls.find((c) => c.sql.includes('INSERT INTO banks'));
    assert.ok(bankInsert);

    const accountInsert = calls.find((c) => c.sql.includes('INSERT INTO bank_accounts'));
    assert.ok(accountInsert);
    // values: [companyId, bankId, name, ...] — bankId sayısal serial olmalı
    assert.equal(typeof accountInsert.values?.[1], 'number');

    const transferInsert = calls.find((c) => c.sql.includes('INSERT INTO transfers'));
    assert.ok(transferInsert);
    assert.equal(typeof transferInsert.values?.[3], 'number'); // from_id (banka upsert'i)
    assert.equal(transferInsert.values?.[5], 7); // to_id — MEZUN kasa DB client_id'den
    assert.notEqual(transferInsert.values?.[3], transferInsert.values?.[5]);

    const paymentInsert = calls.find((c) => c.sql.includes('INSERT INTO invoice_payments'));
    assert.ok(paymentInsert);
    assert.equal(typeof paymentInsert.values?.[0], 'number'); // invoice_id
    assert.equal(typeof paymentInsert.values?.[4], 'number'); // bank_account_id
    assert.equal(paymentInsert.values?.[5], null); // kasa_account_id (XOR CHECK)
    assert.equal(paymentInsert.values?.[7], 'pay_1');
  });

  it('detaylar delete-then-insert: cells/transfers/invoice_payments/invoices projeksiyon-sahipli silinir; kasa_entries MEZUN — silinmez', async () => {
    const { pool, calls } = makeFakePool();
    await new PgFinanceProjectionRepository(pool).replaceAll(emptyProjection());

    for (const table of ['cells', 'transfers', 'invoice_payments', 'invoices']) {
      assert.ok(
        calls.some((c) => c.sql.includes(`DELETE FROM ${table} WHERE client_id IS NOT NULL`)),
        `${table} delete bekleniyordu`,
      );
    }
    // MEZUN: kasa_entries delete edilseydi adopt edilen (client_id dolu)
    // satırlar silinirdi.
    assert.equal(
      calls.some((c) => c.sql.includes('DELETE FROM kasa_entries')),
      false,
    );
    // Fatura silinmeden önce ödemeler silinmeli (CASCADE + CRUD koruması).
    const payIdx = calls.findIndex((c) =>
      c.sql.includes('DELETE FROM invoice_payments WHERE client_id IS NOT NULL'),
    );
    const invIdx = calls.findIndex((c) =>
      c.sql.includes('DELETE FROM invoices WHERE client_id IS NOT NULL'),
    );
    assert.ok(payIdx >= 0 && invIdx > payIdx);
  });

  it('MEZUNİYET: kasa_accounts/kasa_entries tablolarına hiç dokunulmaz (INSERT/UPDATE/DELETE yok)', async () => {
    const { pool, calls } = makeFakePool({
      dbKasaAccounts: [{ id: 7, client_id: 'ksa_1' }],
    });
    await new PgFinanceProjectionRepository(pool).replaceAll(fullProjection());

    const touching = calls.filter(
      (c) =>
        (c.sql.includes('kasa_accounts') || c.sql.includes('kasa_entries')) &&
        !c.sql.trimStart().startsWith('SELECT'),
    );
    assert.deepEqual(
      touching.map((c) => c.sql),
      [],
    );
  });

  it('MEZUN kasa çözücüsü tembel: kasa referansı yoksa kasa_accounts hiç sorgulanmaz', async () => {
    const { pool, calls } = makeFakePool();
    await new PgFinanceProjectionRepository(pool).replaceAll(emptyProjection());

    assert.equal(
      calls.some((c) => c.sql.includes('FROM kasa_accounts')),
      false,
    );
  });

  it('MEZUN kasa çözücüsü: sayısal sunucu id fallback — geçerli id kullanılır, ödemede çözülemeyen NULL kalır', async () => {
    const { pool, calls } = makeFakePool({
      dbKasaAccounts: [{ id: 7, client_id: null }], // CRUD/adopt satırı — client_id yok
    });
    const projection = emptyProjection({
      banks: [{ clientId: 'bnk_1', name: 'YKB', code: 'YKB', color: null }],
      bankAccounts: [
        {
          companyId: 2,
          clientId: 'acc_1',
          bankClientId: 'bnk_1',
          name: 'Vadesiz',
          iban: null,
          accountingCode: null,
          currency: 'TRY',
          openingBalance: 0,
          cashflowCatClientId: null,
          active: true,
        },
      ],
      transfers: [
        {
          companyId: 2,
          clientId: 'trf_1',
          date: '2026-01-02',
          fromType: 'bank',
          fromClientId: 'acc_1',
          toType: 'kasa',
          toClientId: '7', // FE önbelleğinden sunucu id'si
          fromAmount: 500,
          toAmount: 500,
          fromCurrency: 'TRY',
          toCurrency: 'TRY',
          description: null,
          cashflowCatClientId: null,
        },
      ],
      invoices: [
        {
          companyId: 2,
          clientId: 'inv_1',
          type: 'out',
          invoiceNo: null,
          counterparty: 'Acme',
          issueDate: null,
          dueDate: '2026-02-05',
          currency: 'TRY',
          subtotal: 100,
          kdvRate: 0,
          kdv: 0,
          total: 120,
          paidAmount: 50,
          cashflowCatClientId: null,
          committedToCells: false,
          note: null,
        },
      ],
      invoicePayments: [
        {
          companyId: 2,
          clientId: 'pay_1',
          invoiceClientId: 'inv_1',
          amount: 50,
          date: '2026-02-01',
          currency: 'TRY',
          bankAccountClientId: null,
          kasaAccountClientId: 'ksa_bilinmez', // çözülemez → NULL (kolon nullable)
          note: null,
        },
      ],
    });
    await new PgFinanceProjectionRepository(pool).replaceAll(projection);

    const transferInsert = calls.find((c) => c.sql.includes('INSERT INTO transfers'));
    assert.ok(transferInsert);
    assert.equal(transferInsert.values?.[5], 7); // sayısal fallback doğrulandı

    const paymentInsert = calls.find((c) => c.sql.includes('INSERT INTO invoice_payments'));
    assert.ok(paymentInsert); // ödeme DÜŞMEZ — kasa referansı NULL'lanır
    assert.equal(paymentInsert.values?.[5], null);
  });

  it('cells: doğal anahtar devralması ON CONFLICT (company_id, category_id, fiscal_year, month_idx)', async () => {
    const { pool, calls } = makeFakePool({
      dbKasaAccounts: [{ id: 7, client_id: 'ksa_1' }],
    });
    await new PgFinanceProjectionRepository(pool).replaceAll(fullProjection());

    const insert = calls.find((c) => c.sql.includes('INSERT INTO cells'));
    assert.ok(insert);
    assert.ok(insert.sql.includes('ON CONFLICT (company_id, category_id, fiscal_year, month_idx)'));
    assert.equal(insert.values?.[5], 'in_1:0');
  });

  it('prune: çocuktan ebeveyne — bank_accounts → categories → banks (banks EN SON); kasa_accounts MEZUN — prune edilmez', async () => {
    const { pool, calls } = makeFakePool({
      dbKasaAccounts: [{ id: 7, client_id: 'ksa_1' }],
    });
    await new PgFinanceProjectionRepository(pool).replaceAll(fullProjection());

    const pruneIdx = (table: string): number =>
      calls.findIndex(
        (c) =>
          c.sql.includes(`DELETE FROM ${table}`) &&
          c.sql.includes('NOT (client_id = ANY($1::text[]))'),
      );
    const ba = pruneIdx('bank_accounts');
    const cat = pruneIdx('categories');
    const banks = pruneIdx('banks');
    assert.ok(ba >= 0 && cat > ba && banks > cat);
    // MEZUN: kasa_accounts prune edilseydi adopt satırları silinirdi.
    assert.equal(pruneIdx('kasa_accounts'), -1);
    // Prune listesi projeksiyondaki client_id'leri taşır.
    assert.deepEqual(calls[banks]!.values, [['bnk_1']]);
  });

  it("FK-siz şirket: companies'te olmayan company_id'li satırlar düşürülür (banks global kalır)", async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { pool, calls } = makeFakePool({ companies: [1] }); // 2 YOK
      await new PgFinanceProjectionRepository(pool).replaceAll(fullProjection());

      assert.ok(!calls.some((c) => c.sql.includes('INSERT INTO bank_accounts')));
      assert.ok(!calls.some((c) => c.sql.includes('INSERT INTO invoices')));
      assert.ok(calls.some((c) => c.sql.includes('INSERT INTO banks'))); // global — düşmez
      assert.ok(errSpy.mock.calls.length >= 1);
      assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
    } finally {
      errSpy.mock.restore();
    }
  });

  it('çözülmeyen detay FK satırı atlanır + loglanır (transferin kasa ucu DB kümesinde yok)', async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { pool, calls } = makeFakePool({ dbKasaAccounts: [] }); // DB'de kasa yok
      await new PgFinanceProjectionRepository(pool).replaceAll(
        emptyProjection({
          transfers: [
            {
              companyId: 2,
              clientId: 'trf_1',
              date: '2026-01-02',
              fromType: 'kasa',
              fromClientId: 'ksa_yok',
              toType: 'kasa',
              toClientId: 'ksa_yok_2',
              fromAmount: 5,
              toAmount: 5,
              fromCurrency: 'TRY',
              toCurrency: 'TRY',
              description: null,
              cashflowCatClientId: null,
            },
          ],
        }),
      );
      assert.ok(!calls.some((c) => c.sql.includes('INSERT INTO transfers')));
      assert.ok(
        errSpy.mock.calls.some((c) => String(c.arguments[0]).includes('transfer düşürüldü')),
      );
    } finally {
      errSpy.mock.restore();
    }
  });

  it('edge: hata → ROLLBACK + release, hata fırlatılır (üst katman yutar)', async () => {
    const { pool, calls, released } = makeFakePool({
      dbKasaAccounts: [{ id: 7, client_id: 'ksa_1' }],
      failOn: (sql) => sql.includes('INSERT INTO invoices'),
    });
    await assert.rejects(
      () => new PgFinanceProjectionRepository(pool).replaceAll(fullProjection()),
      /patladı/,
    );
    assert.equal(calls[calls.length - 1]!.sql, 'ROLLBACK');
    assert.ok(released());
  });

  it('boş projeksiyon: yalnız delete + prune (tüm projeksiyon-sahipli satırlar budanır), INSERT yok', async () => {
    const { pool, calls } = makeFakePool();
    await new PgFinanceProjectionRepository(pool).replaceAll(emptyProjection());

    assert.ok(!calls.some((c) => c.sql.includes('INSERT INTO')));
    assert.ok(calls.some((c) => c.sql.includes('DELETE FROM banks')));
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
  });
});
