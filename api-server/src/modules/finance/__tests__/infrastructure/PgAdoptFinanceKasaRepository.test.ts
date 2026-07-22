/**
 * PgAdoptFinanceKasaRepository birim testleri — SQL üretimi mock Pool/Client
 * ile doğrulanır: tek transaction, ON CONFLICT (company_id, client_id) hesap
 * upsert'ü + ON CONFLICT (client_id) hareket upsert'ü (idempotens), kasaRef'in
 * üç kademeli çözümü (çağrı-içi + DB'deki önceki adopt + geçerli sayısal
 * sunucu id), kategori çözücüsü, çözülemeyen hareketin düşmesi (COMMIT bozulmaz),
 * 23505 → conflict, rollback.
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import type {
  NormalizedAdoptKasaAccount,
  NormalizedAdoptKasaEntry,
} from '../../application/dto/AdoptFinanceKasaDtos.js';
import { FinanceKasaAdoptConflictError } from '../../domain/errors/FinanceErrors.js';
import {
  PgAdoptFinanceKasaRepository,
  type AdoptFinanceKasaPool,
  type AdoptFinanceKasaPoolClient,
} from '../../infrastructure/persistence/PgAdoptFinanceKasaRepository.js';

interface RecordedCall {
  sql: string;
  values: readonly unknown[] | undefined;
}

interface FakeOptions {
  /** kasa_accounts client_id lookup'ının döneceği satırlar (önceki adopt). */
  dbKasaByClient?: Array<{ id: number; client_id: string }>;
  /** Sayısal id doğrulama lookup'ının döneceği id'ler. */
  dbKasaIds?: number[];
  /** Kategori çözücü SELECT'inin döneceği satırlar. */
  dbCategories?: Array<{ id: number; client_id: string | null }>;
  failOn?: (sql: string) => boolean;
}

function makeFakePool(opts: FakeOptions = {}): {
  pool: AdoptFinanceKasaPool;
  calls: RecordedCall[];
  released: () => boolean;
} {
  const calls: RecordedCall[] = [];
  let released = false;
  let nextId = 100;
  const client: AdoptFinanceKasaPoolClient = {
    async query(sql: string, values?: readonly unknown[]) {
      calls.push({ sql, values });
      if (opts.failOn?.(sql)) throw new Error('patladı');
      if (sql.includes('FROM categories')) {
        return { rows: opts.dbCategories ?? [] };
      }
      if (sql.includes('SELECT id, client_id FROM kasa_accounts')) {
        return { rows: opts.dbKasaByClient ?? [] };
      }
      if (sql.includes('SELECT id FROM kasa_accounts')) {
        return { rows: (opts.dbKasaIds ?? []).map((id) => ({ id })) };
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

const acc = (
  clientId: string,
  over: Partial<NormalizedAdoptKasaAccount> = {},
): NormalizedAdoptKasaAccount => ({
  clientId,
  name: `Kasa ${clientId}`,
  currency: 'TRY',
  openingBalance: 0,
  active: true,
  ...over,
});

const ent = (
  clientId: string,
  over: Partial<NormalizedAdoptKasaEntry> = {},
): NormalizedAdoptKasaEntry => ({
  clientId,
  kasaRef: 'ksa_1',
  date: '2026-03-10',
  type: 'out',
  amount: 100,
  description: null,
  category: null,
  cashflowCatRef: null,
  ...over,
});

describe('PgAdoptFinanceKasaRepository', () => {
  it('happy: tek transaction; hesap ON CONFLICT (company_id, client_id), hareket ON CONFLICT (client_id); kasaRef çağrı-içi çözülür', async () => {
    const { pool, calls, released } = makeFakePool();
    const repo = new PgAdoptFinanceKasaRepository(pool);

    const outcome = await repo.adoptAll(1, {
      accounts: [acc('ksa_1', { currency: 'EUR', openingBalance: 12.5 })],
      entries: [ent('kse_1', { description: 'Yakıt', category: 'Yakıt' })],
    });

    assert.equal(calls[0]!.sql, 'BEGIN');
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
    assert.ok(released());

    const accInsert = calls.find((c) => c.sql.includes('INSERT INTO kasa_accounts'));
    assert.ok(accInsert);
    assert.ok(accInsert.sql.includes('ON CONFLICT (company_id, client_id)'));
    assert.ok(accInsert.sql.includes('DO UPDATE'));
    assert.deepEqual(accInsert.values, [1, 'Kasa ksa_1', 'EUR', 12.5, true, 'ksa_1']);

    const entInsert = calls.find((c) => c.sql.includes('INSERT INTO kasa_entries'));
    assert.ok(entInsert);
    assert.ok(entInsert.sql.includes('ON CONFLICT (client_id)'));
    // committed_to_cells/committed_at/created_by adopt'ta yazılmaz — kolon
    // listesinde yok (commit-to-cells durumu korunur).
    assert.ok(!entInsert.sql.includes('committed_to_cells'));
    assert.deepEqual(entInsert.values, [
      100, // çağrı-içi haritadan çözülen kasa_account_id
      '2026-03-10',
      'out',
      100,
      'Yakıt',
      'Yakıt',
      null,
      'kse_1',
    ]);

    assert.deepEqual(outcome.accountIdByClient, { ksa_1: 100 });
    assert.deepEqual(outcome.entryIdByClient, { kse_1: 101 });
    assert.equal(outcome.unresolvedEntries, 0);

    // Çağrı-içi çözüm yeterli — kasa lookup'ları hiç yapılmaz.
    assert.equal(
      calls.some((c) => c.sql.includes('SELECT id, client_id FROM kasa_accounts')),
      false,
    );
    // cashflowCatRef yok → kategori çözücüsü hiç sorgulanmaz.
    assert.equal(
      calls.some((c) => c.sql.includes('FROM categories')),
      false,
    );
  });

  it("DB-önceki çözüm: çağrıda olmayan kasaRef'ler client_id'den, kalanı geçerli sayısal id'den bulunur (şirket kapsamlı)", async () => {
    const { pool, calls } = makeFakePool({
      dbKasaByClient: [{ id: 55, client_id: 'ksa_onceki' }],
      dbKasaIds: [77],
    });
    const repo = new PgAdoptFinanceKasaRepository(pool);

    const outcome = await repo.adoptAll(1, {
      accounts: [],
      entries: [ent('kse_a', { kasaRef: 'ksa_onceki' }), ent('kse_b', { kasaRef: '77' })],
    });

    const inserts = calls.filter((c) => c.sql.includes('INSERT INTO kasa_entries'));
    const kasaOf = new Map(inserts.map((c) => [c.values![7], c.values![0]]));
    assert.equal(kasaOf.get('kse_a'), 55); // DB client_id'den
    assert.equal(kasaOf.get('kse_b'), 77); // geçerli sayısal sunucu id'den
    assert.equal(outcome.unresolvedEntries, 0);

    const clientLookup = calls.find((c) =>
      c.sql.includes('SELECT id, client_id FROM kasa_accounts'),
    );
    assert.ok(clientLookup);
    assert.equal(clientLookup.values![0], 1); // şirket kapsamlı
    assert.deepEqual(clientLookup.values![1], ['ksa_onceki', '77']);
    const idLookup = calls.find((c) => c.sql.includes('SELECT id FROM kasa_accounts'));
    assert.ok(idLookup);
    assert.deepEqual(idLookup.values![1], [77]);
  });

  it('kategori çözücüsü: client_id haritası + geçerli SAYISAL sunucu id; çözülemeyen NULL', async () => {
    const { pool, calls } = makeFakePool({
      dbKasaByClient: [{ id: 55, client_id: 'ksa_1' }],
      dbCategories: [
        { id: 12, client_id: 'out_1' },
        { id: 34, client_id: null }, // CRUD satırı — sayısal ref doğrulanır
      ],
    });
    const repo = new PgAdoptFinanceKasaRepository(pool);

    await repo.adoptAll(1, {
      accounts: [],
      entries: [
        ent('kse_cli', { cashflowCatRef: 'out_1' }),
        ent('kse_num', { cashflowCatRef: '34' }),
        ent('kse_yok', { cashflowCatRef: 'out_bilinmez' }),
      ],
    });

    const catLookup = calls.find((c) => c.sql.includes('FROM categories'));
    assert.ok(catLookup);
    assert.deepEqual(catLookup.values, [1]); // şirket kapsamlı

    const inserts = calls.filter((c) => c.sql.includes('INSERT INTO kasa_entries'));
    const catOf = new Map(inserts.map((c) => [c.values![7], c.values![6]]));
    assert.equal(catOf.get('kse_cli'), 12);
    assert.equal(catOf.get('kse_num'), 34);
    assert.equal(catOf.get('kse_yok'), null);
  });

  it('çözülemeyen kasaRef: hareket DÜŞER (idMap dışı, unresolvedEntries sayılır), transaction COMMIT eder', async () => {
    const errSpy = mock.method(console, 'error', () => undefined);
    try {
      const { pool, calls } = makeFakePool(); // DB boş
      const repo = new PgAdoptFinanceKasaRepository(pool);

      const outcome = await repo.adoptAll(1, {
        accounts: [acc('ksa_1')],
        entries: [ent('kse_yetim', { kasaRef: 'ksa_yok' })],
      });

      assert.deepEqual(outcome.entryIdByClient, {});
      assert.equal(outcome.unresolvedEntries, 1);
      assert.equal(
        calls.some((c) => c.sql.includes('INSERT INTO kasa_entries')),
        false,
      );
      assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
      assert.ok(
        errSpy.mock.calls.some((c) => String(c.arguments[0]).includes('kasa hareketi düşürüldü')),
      );
    } finally {
      errSpy.mock.restore();
    }
  });

  it('boş payload: DB sorgusu üretmeden BEGIN/COMMIT ile boş sonuç döner', async () => {
    const { pool, calls } = makeFakePool();
    const repo = new PgAdoptFinanceKasaRepository(pool);

    const outcome = await repo.adoptAll(1, { accounts: [], entries: [] });

    assert.deepEqual(outcome, {
      accountIdByClient: {},
      entryIdByClient: {},
      unresolvedEntries: 0,
    });
    assert.deepEqual(
      calls.map((c) => c.sql),
      ['BEGIN', 'COMMIT'],
    );
  });

  it('23505 (beklenmedik benzersizlik çakışması) → FinanceKasaAdoptConflictError (409) + ROLLBACK', async () => {
    const calls: RecordedCall[] = [];
    let released = false;
    const client: AdoptFinanceKasaPoolClient = {
      async query(sql: string, values?: readonly unknown[]) {
        calls.push({ sql, values });
        if (sql.includes('INSERT INTO kasa_accounts')) {
          const err = new Error('duplicate key') as Error & { code: string; detail: string };
          err.code = '23505';
          err.detail = 'Key (company_id, client_id)=(1, ksa_1) already exists.';
          throw err;
        }
        return { rows: [], rowCount: 0 };
      },
      release() {
        released = true;
      },
    };
    const repo = new PgAdoptFinanceKasaRepository({ connect: async () => client });

    await assert.rejects(
      () => repo.adoptAll(1, { accounts: [acc('ksa_1')], entries: [] }),
      FinanceKasaAdoptConflictError,
    );
    assert.ok(calls.some((c) => c.sql === 'ROLLBACK'));
    assert.equal(
      calls.some((c) => c.sql === 'COMMIT'),
      false,
    );
    assert.ok(released);
  });

  it('beklenmeyen hata → ROLLBACK + release; hata çağırana fırlar', async () => {
    const { pool, calls, released } = makeFakePool({
      failOn: (sql) => sql.includes('INSERT INTO kasa_entries'),
    });
    const repo = new PgAdoptFinanceKasaRepository(pool);

    await assert.rejects(
      () => repo.adoptAll(1, { accounts: [acc('ksa_1')], entries: [ent('kse_1')] }),
      /patladı/,
    );
    assert.ok(calls.some((c) => c.sql === 'ROLLBACK'));
    assert.equal(
      calls.some((c) => c.sql === 'COMMIT'),
      false,
    );
    assert.ok(released());
  });
});
