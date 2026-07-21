/**
 * BlobProjector birim testleri — blob → ayna satırı projeksiyon kuralları.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GLOBAL_COMPANY_ID,
  MAX_ROWS_PER_DOMAIN,
  projectBlob,
  projectBlobWithGroups,
  type MirrorRow,
} from '../domain/BlobProjector.js';

function rowsOf(rows: MirrorRow[], domain: string, companyId?: string): MirrorRow[] {
  return rows.filter(
    (r) => r.domain === domain && (companyId === undefined || r.companyId === companyId),
  );
}

describe('BlobProjector', () => {
  it("kök dizi alanı (companies) → companyId 0 satırları, clientId eleman id'sinden", () => {
    const rows = projectBlob('promet:data', {
      companies: [
        { id: 'comp_promet', name: 'Promet' },
        { id: 'comp_2', name: 'Acme' },
      ],
    });
    const companies = rowsOf(rows, 'companies');
    assert.equal(companies.length, 2);
    assert.deepEqual(
      companies.map((r) => r.companyId),
      [GLOBAL_COMPANY_ID, GLOBAL_COMPANY_ID],
    );
    assert.deepEqual(
      companies.map((r) => r.clientId),
      ['comp_promet', 'comp_2'],
    );
    assert.deepEqual(companies[0]!.data, { id: 'comp_promet', name: 'Promet' });
  });

  it('companyData şirket alanları doğru companyId taşır (string cid dahil)', () => {
    // SAPMA NOTU: cid'ler blob'da istemci-üretimi STRING'dir ("comp_promet").
    // Number(cid)+NaN-atlaması TÜM şirket verisini düşürürdü; String(cid)
    // korunur (044 tablosunda company_id TEXT).
    const rows = projectBlob('promet:data', {
      companyData: {
        comp_promet: { hrEmployees: [{ id: 'emp_1', firstName: 'Ali' }] },
        '12': { invoices: [{ id: 'inv_1', total: 100 }] },
      },
    });
    const emp = rowsOf(rows, 'hrEmployees');
    assert.equal(emp.length, 1);
    assert.equal(emp[0]!.companyId, 'comp_promet');
    assert.equal(emp[0]!.clientId, 'emp_1');

    const inv = rowsOf(rows, 'invoices');
    assert.equal(inv.length, 1);
    assert.equal(inv[0]!.companyId, '12');
  });

  it("id'siz elemanlar → i+index; boş-string id de i+index", () => {
    const rows = projectBlob('promet:data', {
      rateHistory: [{ date: '2026-01-01' }, { id: '', x: 1 }, { id: 'rh_3' }, 42],
    });
    assert.deepEqual(
      rowsOf(rows, 'rateHistory').map((r) => r.clientId),
      ['i0', 'i1', 'rh_3', 'i3'],
    );
    // Skaler dizi elemanı {value: x} sarılır.
    assert.deepEqual(rowsOf(rows, 'rateHistory')[3]!.data, { value: 42 });
  });

  it('skaler kök alan → tek "_" satırı ({value: x} sarılı); obje alan olduğu gibi', () => {
    const rows = projectBlob('promet:data', {
      displayCurrency: 'TRY',
      exchangeRates: { USD: 34.02, EUR: 38.13 },
    });
    const cur = rowsOf(rows, 'displayCurrency');
    assert.equal(cur.length, 1);
    assert.equal(cur[0]!.clientId, '_');
    assert.deepEqual(cur[0]!.data, { value: 'TRY' });

    const fx = rowsOf(rows, 'exchangeRates');
    assert.equal(fx[0]!.clientId, '_');
    assert.deepEqual(fx[0]!.data, { USD: 34.02, EUR: 38.13 });
  });

  it('null kök alan → "_" satırı {value: null}', () => {
    const rows = projectBlob('promet:data', { activeCompanyId: null });
    assert.deepEqual(rowsOf(rows, 'activeCompanyId')[0]!.data, { value: null });
  });

  it('companyData kendisi domain olarak YAZILMAZ', () => {
    const rows = projectBlob('promet:data', {
      companies: [{ id: 'c1' }],
      companyData: { c1: { tasks: [] } },
    });
    assert.equal(rowsOf(rows, 'companyData').length, 0);
  });

  it('hassas üst-düzey anahtarlar silinir (tcmb.apiKey, hrEmailSettings.smtpPass)', () => {
    const rows = projectBlob('promet:data', {
      tcmb: { apiKey: 'GIZLI', rateType: 'selling' },
      companyData: {
        comp_promet: {
          hrEmailSettings: { provider: 'smtp', smtpPass: 'GIZLI', smtpUser: 'a@b.c' },
        },
      },
    });
    assert.deepEqual(rowsOf(rows, 'tcmb')[0]!.data, { rateType: 'selling' });
    assert.deepEqual(rowsOf(rows, 'hrEmailSettings')[0]!.data, {
      provider: 'smtp',
      smtpUser: 'a@b.c',
    });
  });

  it("'promet:users' → domain users, clientId username ?? id ?? i+index, password silinir", () => {
    const rows = projectBlob('promet:users', [
      {
        id: 'u_admin',
        username: 'admin',
        password: 'admin123',
        fullName: 'Yönetici',
        role: 'admin',
        active: true,
      },
      { id: 'u_2', password: 'x' },
      { fullName: 'Kimliksiz' },
    ]);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((r) => r.domain === 'users' && r.companyId === GLOBAL_COMPANY_ID));
    assert.deepEqual(
      rows.map((r) => r.clientId),
      ['admin', 'u_2', 'i2'],
    );
    // password aynaya asla yazılmaz.
    assert.deepEqual(rows[0]!.data, {
      id: 'u_admin',
      username: 'admin',
      fullName: 'Yönetici',
      role: 'admin',
      active: true,
    });
    assert.deepEqual(rows[1]!.data, { id: 'u_2' });
  });

  it("'promet:users' dizi değilse ayna yok", () => {
    assert.deepEqual(projectBlob('promet:users', { admin: {} }), []);
  });

  it('bilinmeyen anahtar → boş (satır da grup da yok)', () => {
    const p = projectBlobWithGroups('promet:einvoice:comp_promet', [{ id: 'e1' }]);
    assert.deepEqual(p.rows, []);
    assert.deepEqual(p.groups, []);
  });

  it("'promet:data' obje değilse boş", () => {
    assert.deepEqual(projectBlob('promet:data', [1, 2, 3]), []);
    assert.deepEqual(projectBlob('promet:data', 'metin'), []);
  });

  it('boş/whitespace cid atlanır; obje olmayan şirket verisi atlanır', () => {
    const rows = projectBlob('promet:data', {
      companyData: {
        '   ': { tasks: [{ id: 't1' }] },
        comp_ok: { tasks: [{ id: 't2' }] },
        comp_bozuk: 'dizi degil',
      },
    });
    const tasks = rowsOf(rows, 'tasks');
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]!.companyId, 'comp_ok');
  });

  it('runaway guard: > 50000 elemanlı domain atlanır ve işaretlenir; grup kaydedilmez', () => {
    const big = Array.from({ length: MAX_ROWS_PER_DOMAIN + 1 }, (_, i) => ({ id: 'x' + i }));
    const skipped: Array<{ companyId: string; domain: string; itemCount: number }> = [];
    const p = projectBlobWithGroups(
      'promet:data',
      { companies: [{ id: 'c1' }], companyData: { comp_promet: { kasaEntries: big } } },
      { onDomainSkipped: (g) => skipped.push(g) },
    );
    assert.equal(rowsOf(p.rows, 'kasaEntries').length, 0);
    assert.deepEqual(skipped, [
      { companyId: 'comp_promet', domain: 'kasaEntries', itemCount: MAX_ROWS_PER_DOMAIN + 1 },
    ]);
    // Atlanan domain grup listesinde YOK → mevcut ayna satırları budanmaz.
    assert.equal(
      p.groups.some((g) => g.domain === 'kasaEntries'),
      false,
    );
    // Diğer alanlar etkilenmez.
    assert.equal(rowsOf(p.rows, 'companies').length, 1);
  });

  it('boş dizi alan: satır üretmez ama GRUP kaydeder (ayna doğru boşalsın)', () => {
    const p = projectBlobWithGroups('promet:data', {
      companyData: { comp_promet: { hrEmployees: [] } },
    });
    assert.equal(p.rows.length, 0);
    assert.deepEqual(p.groups, [{ companyId: 'comp_promet', domain: 'hrEmployees' }]);
  });
});
