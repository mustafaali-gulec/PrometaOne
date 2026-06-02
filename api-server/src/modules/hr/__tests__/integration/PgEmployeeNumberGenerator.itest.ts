/**
 * PgEmployeeNumberGenerator integration test.
 *
 * Doğrulanan davranışlar:
 *   - next(companyId) sıralı, monotonic artan değerler üretir.
 *   - Format: <PREFIX><zero-padded number> (default prefix "EMP", width 4).
 *   - Concurrency: Promise.all ile aynı anda 5 next() çağrısı → 5 benzersiz
 *     değer (UPSERT + RETURNING'in atomicity'si). PG'nin row lock'ı sayesinde
 *     yarış koşulu olmaz.
 *   - Şirket izolasyonu: company 1'in sayacı company 2'ye etki etmez.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { PgEmployeeNumberGenerator } from '../../infrastructure/sequences/PgEmployeeNumberGenerator.js';

import {
  seedCompany,
  startHrPgContainer,
  truncateAuthAndHrTables,
  type HrPgContext,
} from './setup.js';

/**
 * Format: prefix + zero-padded number, örn. "EMP0001" (width=4).
 * SequentialEmployeeNumberGenerator implementasyonuyla tutarlı.
 */
function parseEmployeeNo(value: string, prefix: string): number {
  if (!value.startsWith(prefix)) {
    throw new Error(`Beklenmedik format: ${value} (prefix=${prefix})`);
  }
  return Number(value.slice(prefix.length));
}

describe('PgEmployeeNumberGenerator [integration]', () => {
  let ctx: HrPgContext;

  before(
    async () => {
      ctx = await startHrPgContainer();
    },
    { timeout: 180_000 },
  );

  after(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  beforeEach(async () => {
    await truncateAuthAndHrTables(ctx.pool);
    await seedCompany(ctx.pool, { id: 1, name: 'Test A.Ş.' });
    await seedCompany(ctx.pool, { id: 2, name: 'Diğer A.Ş.' });
  });

  it('next(): sıralı çağrılar monotonic artan değerler verir', async () => {
    const gen = new PgEmployeeNumberGenerator(ctx.pool, { prefix: 'EMP', width: 4 });
    const first = await gen.next(1);
    const second = await gen.next(1);
    const third = await gen.next(1);

    // Format: "EMP" + 4 hane (örn. "EMP0001")
    assert.match(first.value, /^EMP\d{4}$/);
    assert.match(second.value, /^EMP\d{4}$/);
    assert.match(third.value, /^EMP\d{4}$/);

    // Numerik kısım monotonic artar
    const n1 = parseEmployeeNo(first.value, 'EMP');
    const n2 = parseEmployeeNo(second.value, 'EMP');
    const n3 = parseEmployeeNo(third.value, 'EMP');
    assert.ok(n1 < n2, `${n1} < ${n2} bekleniyor`);
    assert.ok(n2 < n3, `${n2} < ${n3} bekleniyor`);
  });

  it('concurrency: 5 paralel next() çağrısı 5 benzersiz değer üretir', async () => {
    const gen = new PgEmployeeNumberGenerator(ctx.pool, { prefix: 'EMP', width: 4 });
    const results = await Promise.all([
      gen.next(1),
      gen.next(1),
      gen.next(1),
      gen.next(1),
      gen.next(1),
    ]);
    const values = results.map((r) => r.value);
    const unique = new Set(values);

    assert.equal(
      unique.size,
      5,
      `5 paralel çağrı 5 benzersiz değer üretmeli; alındı: ${values.join(', ')}`,
    );
  });

  it('şirket izolasyonu: company 1 ve company 2 sayaçları bağımsız', async () => {
    const gen = new PgEmployeeNumberGenerator(ctx.pool, { prefix: 'EMP', width: 4 });

    const a1 = await gen.next(1);
    const a2 = await gen.next(1);
    const b1 = await gen.next(2);
    const b2 = await gen.next(2);

    const na1 = parseEmployeeNo(a1.value, 'EMP');
    const na2 = parseEmployeeNo(a2.value, 'EMP');
    const nb1 = parseEmployeeNo(b1.value, 'EMP');
    const nb2 = parseEmployeeNo(b2.value, 'EMP');

    // Şirket 1 sayacı: a1 → a2 monotonic
    assert.ok(na1 < na2);
    // Şirket 2 sayacı: b1 → b2 monotonic
    assert.ok(nb1 < nb2);
    // Bağımsızlık: her iki şirketin de ilk değeri 1'den başlamalı (truncate
    // sonrası hr_employee_no_counters boş).
    assert.equal(na1, 1);
    assert.equal(nb1, 1);
  });

  it('custom prefix ve width parametreleri uygulanır', async () => {
    const gen = new PgEmployeeNumberGenerator(ctx.pool, { prefix: 'PRO', width: 6 });
    const r = await gen.next(1);
    // Format: "PRO" + 6 hane (örn. "PRO000001")
    assert.match(r.value, /^PRO\d{6}$/);
  });
});
