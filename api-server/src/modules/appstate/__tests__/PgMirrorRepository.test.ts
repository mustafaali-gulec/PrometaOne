/**
 * PgMirrorRepository birim testleri — SQL üretimi mock Pool/Client ile
 * doğrulanır (delete-prune + batched upsert + rollback).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MirrorRow } from '../domain/BlobProjector.js';
import {
  PgMirrorRepository,
  type MirrorPool,
  type MirrorPoolClient,
} from '../infrastructure/persistence/PgMirrorRepository.js';

interface RecordedCall {
  sql: string;
  values: readonly unknown[] | undefined;
}

function makeFakePool(failOn?: (sql: string) => boolean): {
  pool: MirrorPool;
  calls: RecordedCall[];
  released: () => boolean;
} {
  const calls: RecordedCall[] = [];
  let released = false;
  const client: MirrorPoolClient = {
    async query(sql: string, values?: readonly unknown[]) {
      calls.push({ sql, values });
      if (failOn?.(sql)) throw new Error('patladı');
      return {};
    },
    release() {
      released = true;
    },
  };
  return {
    pool: { connect: async () => client },
    calls,
    released: () => released,
  };
}

const row = (companyId: string, domain: string, clientId: string, data: unknown): MirrorRow => ({
  companyId,
  domain,
  clientId,
  data,
});

describe('PgMirrorRepository', () => {
  it('delete-prune + upsert: grup başına DELETE, tek transaction, boş grup tamamen budanır', async () => {
    const { pool, calls, released } = makeFakePool();
    const repo = new PgMirrorRepository(pool);

    await repo.replaceAll(
      [
        row('0', 'companies', 'c1', { id: 'c1' }),
        row('comp_promet', 'tasks', 't1', { id: 't1' }),
        row('comp_promet', 'tasks', 't2', { id: 't2' }),
      ],
      [
        { companyId: '0', domain: 'companies' },
        { companyId: 'comp_promet', domain: 'tasks' },
        { companyId: 'comp_promet', domain: 'hrEmployees' }, // boşalan dizi
      ],
    );

    assert.equal(calls[0]!.sql, 'BEGIN');
    assert.equal(calls[calls.length - 1]!.sql, 'COMMIT');
    assert.ok(released());

    const deletes = calls.filter((c) => c.sql.includes('DELETE FROM app_state_entities'));
    assert.equal(deletes.length, 3);
    // Prune parametreleri: [company_id, domain, tutulacak client_id dizisi]
    assert.deepEqual(deletes[0]!.values, ['0', 'companies', ['c1']]);
    assert.deepEqual(deletes[1]!.values, ['comp_promet', 'tasks', ['t1', 't2']]);
    // Boş grup: tutulacak id yok → grubun tamamı silinir, INSERT üretilmez.
    assert.deepEqual(deletes[2]!.values, ['comp_promet', 'hrEmployees', []]);

    const inserts = calls.filter((c) => c.sql.includes('INSERT INTO app_state_entities'));
    assert.equal(inserts.length, 2); // companies + tasks (hrEmployees yok)
    assert.ok(inserts.every((c) => c.sql.includes('ON CONFLICT (company_id, domain, client_id)')));
    assert.ok(inserts.every((c) => c.sql.includes('DO UPDATE SET data = EXCLUDED.data')));
    // data JSON.stringify ile $N::jsonb'ye gider.
    assert.deepEqual(inserts[1]!.values!.slice(0, 4), [
      'comp_promet',
      'tasks',
      't1',
      JSON.stringify({ id: 't1' }),
    ]);
  });

  it('batched upsert: 1201 satır → 500+500+201 üç INSERT; parametre düzeni doğru', async () => {
    const { pool, calls } = makeFakePool();
    const repo = new PgMirrorRepository(pool);

    const rows = Array.from({ length: 1201 }, (_, i) =>
      row('comp_promet', 'kasaEntries', 'ke_' + i, { id: 'ke_' + i, amount: i }),
    );
    await repo.replaceAll(rows);

    const inserts = calls.filter((c) => c.sql.includes('INSERT INTO app_state_entities'));
    assert.equal(inserts.length, 3);
    assert.deepEqual(
      inserts.map((c) => c.values!.length / 4),
      [500, 500, 201],
    );
    // İlk batch son tuple placeholder'ı $2000'de biter; ikinci batch $1'den başlar.
    assert.ok(inserts[0]!.sql.includes('$2000::jsonb'));
    assert.ok(inserts[1]!.sql.startsWith('INSERT INTO app_state_entities'.slice(0, 6)));
    assert.equal(inserts[1]!.values![0], 'comp_promet');
    assert.equal(inserts[1]!.values![2], 'ke_500');
  });

  it('dedupe: aynı (company, domain, clientId) çift gelirse SON kazanır (tek tuple)', async () => {
    const { pool, calls } = makeFakePool();
    const repo = new PgMirrorRepository(pool);

    await repo.replaceAll([
      row('0', 'banks', 'b1', { v: 'eski' }),
      row('0', 'banks', 'b1', { v: 'yeni' }),
    ]);

    const insert = calls.find((c) => c.sql.includes('INSERT INTO app_state_entities'));
    assert.ok(insert);
    assert.equal(insert.values!.length, 4); // tek satır
    assert.equal(insert.values![3], JSON.stringify({ v: 'yeni' }));
  });

  it('hata → ROLLBACK + release; hata çağırana fırlar (use-case yutar)', async () => {
    const { pool, calls, released } = makeFakePool((sql) => sql.includes('INSERT'));
    const repo = new PgMirrorRepository(pool);

    await assert.rejects(() => repo.replaceAll([row('0', 'banks', 'b1', {})]), /patladı/);
    assert.ok(calls.some((c) => c.sql === 'ROLLBACK'));
    assert.equal(
      calls.some((c) => c.sql === 'COMMIT'),
      false,
    );
    assert.ok(released());
  });

  it('boş girdi (satır + grup yok) → hiç bağlantı açılmaz', async () => {
    let connected = false;
    const pool: MirrorPool = {
      connect: async () => {
        connected = true;
        return { query: async () => ({}), release: () => undefined };
      },
    };
    await new PgMirrorRepository(pool).replaceAll([]);
    assert.equal(connected, false);
  });
});
