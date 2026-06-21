/**
 * QueryCompiler birim testleri — güvenlik & determinizm kritik.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCompilerCatalog, compileQuery } from '../../domain/compiler/QueryCompiler.js';
import { UnknownIdentifierError } from '../../domain/errors/ReportingErrors.js';
import { assertSafeSelect } from '../../domain/sql/SqlGuard.js';

const catalog = buildCompilerCatalog([
  {
    key: 'invoices',
    hasCompanyId: true,
    columns: [{ key: 'id' }, { key: 'type' }, { key: 'total' }, { key: 'due_date' }],
  },
  { key: 'companies', hasCompanyId: false, columns: [{ key: 'id' }, { key: 'name' }] },
]);
const ctx = (extra = {}) => ({ catalog, companyId: 7, ...extra });

describe('compileQuery', () => {
  it('basit select + otomatik company_id', () => {
    const r = compileQuery(
      { source: 'invoices', columns: [{ col: 'id' }, { col: 'total' }] },
      ctx(),
    );
    assert.match(r.sql, /SELECT "id" AS "id", "total" AS "total"/);
    assert.match(r.sql, /FROM "invoices"/);
    assert.match(r.sql, /WHERE "company_id" = \$1/);
    assert.deepEqual(r.values, [7]);
    assert.doesNotThrow(() => assertSafeSelect(r.sql)); // guard'dan geçer
  });

  it('company_id olmayan tabloda izolasyon eklenmez', () => {
    const r = compileQuery({ source: 'companies', columns: [{ col: 'name' }] }, ctx());
    assert.doesNotMatch(r.sql, /company_id/);
    assert.deepEqual(r.values, []);
  });

  it('agregasyon → otomatik GROUP BY', () => {
    const r = compileQuery(
      {
        source: 'invoices',
        columns: [{ col: 'type' }, { col: 'total', agg: 'sum', alias: 'toplam' }],
      },
      ctx(),
    );
    assert.match(r.sql, /SUM\("total"\) AS "toplam"/);
    assert.match(r.sql, /GROUP BY "type"/);
  });

  it('count(*)', () => {
    const r = compileQuery(
      { source: 'invoices', columns: [{ col: '*', agg: 'count', alias: 'adet' }] },
      ctx(),
    );
    assert.match(r.sql, /COUNT\(\*\) AS "adet"/);
    assert.doesNotMatch(r.sql, /GROUP BY/);
  });

  it('filtre: literal + param $n ile bağlanır', () => {
    const r = compileQuery(
      {
        source: 'invoices',
        columns: [{ col: 'id' }],
        filters: [
          { col: 'total', op: '>=', value: 100 },
          { col: 'type', op: '=', param: 't' },
        ],
      },
      ctx({ params: { t: 'in' }, paramDefs: [{ name: 't', type: 'text' }] }),
    );
    assert.match(r.sql, /"total" >= \$1 AND "type" = \$2 AND "company_id" = \$3/);
    assert.deepEqual(r.values, [100, 'in', 7]);
  });

  it("'in' → ANY, 'between' → iki bind", () => {
    const rIn = compileQuery(
      {
        source: 'invoices',
        columns: [{ col: 'id' }],
        filters: [{ col: 'type', op: 'in', value: ['in', 'out'] }],
      },
      ctx(),
    );
    assert.match(rIn.sql, /"type" = ANY\(\$1\)/);
    assert.deepEqual(rIn.values, [['in', 'out'], 7]);

    const rBt = compileQuery(
      {
        source: 'invoices',
        columns: [{ col: 'id' }],
        filters: [{ col: 'total', op: 'between', value: [10, 20] }],
      },
      ctx(),
    );
    assert.match(rBt.sql, /"total" BETWEEN \$1 AND \$2/);
    assert.deepEqual(rBt.values, [10, 20, 7]);
  });

  it('order by + limit', () => {
    const r = compileQuery(
      {
        source: 'invoices',
        columns: [{ col: 'id' }],
        orderBy: [{ col: 'due_date', dir: 'desc' }],
        limit: 10,
      },
      ctx(),
    );
    assert.match(r.sql, /ORDER BY "due_date" DESC/);
    assert.match(r.sql, /LIMIT 10/);
  });

  it('bilinmeyen tablo / kolon → UnknownIdentifierError', () => {
    assert.throws(
      () => compileQuery({ source: 'nope', columns: [{ col: 'x' }] }, ctx()),
      UnknownIdentifierError,
    );
    assert.throws(
      () => compileQuery({ source: 'invoices', columns: [{ col: 'ghost' }] }, ctx()),
      UnknownIdentifierError,
    );
    assert.throws(
      () =>
        compileQuery(
          {
            source: 'invoices',
            columns: [{ col: 'id' }],
            filters: [{ col: 'ghost', op: '=', value: 1 }],
          },
          ctx(),
        ),
      UnknownIdentifierError,
    );
  });

  it('is null / is not null → değer bağlanmaz', () => {
    const r = compileQuery(
      {
        source: 'invoices',
        columns: [{ col: 'id' }],
        filters: [{ col: 'due_date', op: 'is null' }],
      },
      ctx(),
    );
    assert.match(r.sql, /"due_date" IS NULL/);
    assert.deepEqual(r.values, [7]); // sadece company_id
  });
});
