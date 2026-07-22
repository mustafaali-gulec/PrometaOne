/**
 * FinanceProjection birim testleri — blob→finance tablo eşlemesi, global banks
 * kök alanı, kategori section'ları, cells map çözümü, FK zinciri (banka →
 * hesap → transfer; fatura → ödeme), enum haritaları, şema uyum kırpmaları ve
 * düşürme sayaçları.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { INVOICE_TYPE_MAP, projectFinance } from '../domain/FinanceProjection.js';

/** companyData['2'] altına finans alanları + kök banks koyan yardımcı. */
function blob(
  fields: Record<string, unknown>,
  opts: { cid?: string; banks?: unknown[] } = {},
): unknown {
  return {
    banks: opts.banks ?? [{ id: 'bnk_1', name: 'Yapı Kredi', code: 'YKB', color: '#003a70' }],
    companyData: { [opts.cid ?? '2']: fields },
  };
}

const bankAccount = (id: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  bankId: 'bnk_1',
  name: 'Vadesiz TL',
  iban: 'TR120006701000000012345678',
  currency: 'TRY',
  openingBalance: 1000,
  active: true,
  ...over,
});

const kasa = (id: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  name: 'Merkez Kasa',
  currency: 'TRY',
  openingBalance: 0,
  ...over,
});

const invoice = (id: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  type: 'out',
  invoiceNo: 'FTR-1',
  counterparty: 'Acme AŞ',
  date: '2026-01-05',
  dueDate: '2026-02-05',
  currency: 'TRY',
  netAmount: 100,
  vatRate: 20,
  vatAmount: 20,
  total: 120,
  paidAmount: 0,
  ...over,
});

describe('projectFinance — genel & şirket çözümü', () => {
  it('boş/geçersiz blob → boş projeksiyon (prune sinyali), sayaç yok', () => {
    for (const v of [undefined, null, 42, 'x', [], {}, { companyData: 'bozuk' }]) {
      const p = projectFinance(v);
      assert.deepEqual(p.banks, []);
      assert.deepEqual(p.bankAccounts, []);
      assert.deepEqual(p.invoices, []);
      assert.deepEqual(p.cells, []);
      assert.deepEqual(p.dropped, {});
    }
  });

  it('şirket anahtarı: sayısal cid → o, sayısal olmayan → 1 (öndeğer)', () => {
    const p = projectFinance({
      companyData: {
        '7': { kasaAccounts: [kasa('ksa_a')] },
        comp_promet: { kasaAccounts: [kasa('ksa_b')] },
      },
    });
    assert.equal(p.kasaAccounts.find((k) => k.clientId === 'ksa_a')?.companyId, 7);
    assert.equal(p.kasaAccounts.find((k) => k.clientId === 'ksa_b')?.companyId, 1);
  });
});

describe('projectFinance — banks (GLOBAL kök alan)', () => {
  it('happy: kök banks companyData dışından okunur; color/code taşınır', () => {
    const p = projectFinance(blob({}));
    assert.deepEqual(p.banks, [
      { clientId: 'bnk_1', name: 'Yapı Kredi', code: 'YKB', color: '#003a70' },
    ]);
  });

  it('code yoksa addan türetilir (ilk 3 harf büyük); adsız banka düşer', () => {
    const p = projectFinance(
      blob(
        {},
        {
          banks: [
            { id: 'bnk_a', name: 'garanti' },
            { id: 'bnk_b', code: 'XX' },
          ],
        },
      ),
    );
    assert.equal(p.banks.length, 1);
    assert.equal(p.banks[0]!.code, 'GAR');
    assert.equal(p.dropped['banks.name'], 1);
  });

  it('batch içi çift code/name → SON kazanır, önceki düşer (UNIQUE kısıtları)', () => {
    const p = projectFinance(
      blob(
        {},
        {
          banks: [
            { id: 'bnk_a', name: 'A Bankası', code: 'AAA' },
            { id: 'bnk_b', name: 'B Bankası', code: 'AAA' }, // code çakışır → bnk_a düşer
            { id: 'bnk_c', name: 'B Bankası', code: 'CCC' }, // name çakışır → bnk_b düşer
          ],
        },
      ),
    );
    assert.deepEqual(
      p.banks.map((b) => b.clientId),
      ['bnk_c'],
    );
    assert.equal(p.dropped['banks.duplicateCode'], 1);
    assert.equal(p.dropped['banks.duplicateName'], 1);
  });
});

describe('projectFinance — kategoriler & hücreler', () => {
  it('happy: 4 blob alanı 4 section olur; sortOrder dizi sırası', () => {
    const p = projectFinance(
      blob({
        inflows: [
          { id: 'in_1', name: 'Nakit Satışlar' },
          { id: 'in_2', name: 'Hakediş' },
        ],
        outflows: [{ id: 'out_1', name: 'Kira' }],
        nonPnlOutflows: [{ id: 'npo_1', name: 'Kredi Anapara' }],
        kasaCategories: [{ id: 'kc_1', name: 'Yakıt' }],
      }),
    );
    assert.equal(p.categories.length, 5);
    const in2 = p.categories.find((c) => c.clientId === 'in_2');
    assert.deepEqual(in2, {
      companyId: 2,
      clientId: 'in_2',
      section: 'inflows',
      name: 'Hakediş',
      sortOrder: 1,
      active: true,
    });
    assert.equal(p.categories.find((c) => c.clientId === 'kc_1')?.section, 'kasaCategories');
    assert.deepEqual(p.dropped, {});
  });

  it('doğal anahtar (company, section, name) çiftinde SON kazanır (UNIQUE)', () => {
    const p = projectFinance(
      blob({
        inflows: [
          { id: 'in_1', name: 'Aynı Ad' },
          { id: 'in_2', name: 'Aynı Ad' },
        ],
      }),
    );
    assert.equal(p.categories.length, 1);
    assert.equal(p.categories[0]!.clientId, 'in_2');
    assert.equal(p.dropped['categories.duplicateName'], 1);
  });

  it('cells map: "<catId>:<mi>" anahtarı çözülür; fiscalYear şirket alanından', () => {
    const p = projectFinance(
      blob({
        fiscalYear: 2025,
        inflows: [{ id: 'in_1', name: 'Satış' }],
        cells: { 'in_1:0': 100, 'in_1:11': '250.5' },
      }),
    );
    assert.equal(p.cells.length, 2);
    assert.deepEqual(p.cells[0], {
      companyId: 2,
      clientId: 'in_1:0',
      categoryClientId: 'in_1',
      fiscalYear: 2025,
      monthIdx: 0,
      value: 100,
    });
    assert.equal(p.cells[1]!.value, 250.5);
    assert.equal(p.cells[1]!.monthIdx, 11);
  });

  it('cells kırpmaları: geçersiz fiscalYear/monthIdx/kategori/değer düşer', () => {
    const p = projectFinance(
      blob({
        fiscalYear: 2025,
        inflows: [{ id: 'in_1', name: 'Satış' }],
        cells: {
          'in_1:12': 5, // month_idx 0-11 dışı
          'yok:3': 5, // çözülmeyen kategori
          'in_1:4': 'abc', // sayısal olmayan değer
          'in_1:5': 7, // geçerli
        },
      }),
    );
    assert.equal(p.cells.length, 1);
    assert.equal(p.cells[0]!.clientId, 'in_1:5');
    assert.equal(p.dropped['cells.monthIdx'], 1);
    assert.equal(p.dropped['cells.category'], 1);
    assert.equal(p.dropped['cells.value'], 1);
  });

  it('fiscalYear geçersizse o şirketin TÜM hücreleri düşer (fiscal_year NOT NULL)', () => {
    const p = projectFinance(
      blob({
        inflows: [{ id: 'in_1', name: 'Satış' }],
        cells: { 'in_1:0': 1, 'in_1:1': 2 },
      }),
    );
    assert.deepEqual(p.cells, []);
    assert.equal(p.dropped['cells.fiscalYear'], 2);
  });
});

describe('projectFinance — banka & kasa hesapları', () => {
  it('happy: banka hesabı FK zinciri + accountingCode/iban/cashflowCatId', () => {
    const p = projectFinance(
      blob({
        inflows: [{ id: 'in_1', name: 'Satış' }],
        bankAccounts: [bankAccount('acc_1', { accountingCode: '102.01', cashflowCatId: 'in_1' })],
      }),
    );
    assert.equal(p.bankAccounts.length, 1);
    assert.deepEqual(p.bankAccounts[0], {
      companyId: 2,
      clientId: 'acc_1',
      bankClientId: 'bnk_1',
      name: 'Vadesiz TL',
      iban: 'TR120006701000000012345678',
      accountingCode: '102.01',
      currency: 'TRY',
      openingBalance: 1000,
      cashflowCatClientId: 'in_1',
      active: true,
    });
  });

  it('çözülmeyen bankId → hesap düşer (bank_id NOT NULL FK)', () => {
    const p = projectFinance(blob({ bankAccounts: [bankAccount('acc_1', { bankId: 'yok' })] }));
    assert.deepEqual(p.bankAccounts, []);
    assert.equal(p.dropped['bankAccounts.bank'], 1);
  });

  it('para birimi: TL→TRY, EURO→EUR, boş→TRY; bilinmeyen → satır düşer', () => {
    const p = projectFinance(
      blob({
        bankAccounts: [bankAccount('acc_1', { currency: 'tl' })],
        kasaAccounts: [
          kasa('ksa_1', { currency: 'EURO' }),
          kasa('ksa_2', { currency: undefined }),
          kasa('ksa_3', { currency: 'GBP' }),
        ],
      }),
    );
    assert.equal(p.bankAccounts[0]!.currency, 'TRY');
    assert.equal(p.kasaAccounts.find((k) => k.clientId === 'ksa_1')?.currency, 'EUR');
    assert.equal(p.kasaAccounts.find((k) => k.clientId === 'ksa_2')?.currency, 'TRY');
    assert.equal(
      p.kasaAccounts.find((k) => k.clientId === 'ksa_3'),
      undefined,
    );
    assert.equal(p.dropped['kasaAccounts.currency'], 1);
  });
});

describe('projectFinance — kasa hareketleri', () => {
  it('happy: kasa hareketi; şirket bağlı kasadan; kategori adı serbest metin', () => {
    const p = projectFinance(
      blob({
        kasaAccounts: [kasa('ksa_1')],
        inflows: [{ id: 'in_1', name: 'Satış' }],
        kasaEntries: [
          {
            id: 'kse_1',
            kasaAccountId: 'ksa_1',
            date: '2026-03-10',
            type: 'out',
            amount: '150.257', // string + 2 haneye yuvarlama
            description: 'Yakıt alımı',
            category: 'Yakıt',
            cashflowCatId: 'in_1',
          },
        ],
      }),
    );
    assert.deepEqual(p.kasaEntries, [
      {
        companyId: 2,
        clientId: 'kse_1',
        kasaAccountClientId: 'ksa_1',
        date: '2026-03-10',
        type: 'out',
        amount: 150.26,
        description: 'Yakıt alımı',
        category: 'Yakıt',
        cashflowCatClientId: 'in_1',
      },
    ]);
  });

  it('kırpmalar: kasa yok / tarih bozuk / tip bozuk / tutar <= 0 → düşer', () => {
    const p = projectFinance(
      blob({
        kasaAccounts: [kasa('ksa_1')],
        kasaEntries: [
          { id: 'k1', kasaAccountId: 'yok', date: '2026-01-01', type: 'in', amount: 5 },
          { id: 'k2', kasaAccountId: 'ksa_1', date: 'dün', type: 'in', amount: 5 },
          { id: 'k3', kasaAccountId: 'ksa_1', date: '2026-01-01', type: 'giris', amount: 5 },
          { id: 'k4', kasaAccountId: 'ksa_1', date: '2026-01-01', type: 'in', amount: 0 },
        ],
      }),
    );
    assert.deepEqual(p.kasaEntries, []);
    assert.equal(p.dropped['kasaEntries.kasaAccount'], 1);
    assert.equal(p.dropped['kasaEntries.date'], 1);
    assert.equal(p.dropped['kasaEntries.type'], 1);
    assert.equal(p.dropped['kasaEntries.amount'], 1);
  });
});

describe('projectFinance — transferler', () => {
  const accounts = {
    bankAccounts: [bankAccount('acc_1'), bankAccount('acc_2', { currency: 'USD' })],
    kasaAccounts: [kasa('ksa_1')],
  };

  it('happy: banka→kasa transferi; uçlar client id ile çözülür', () => {
    const p = projectFinance(
      blob({
        ...accounts,
        transfers: [
          {
            id: 'trf_1',
            date: '2026-05-01',
            fromType: 'bank',
            fromId: 'acc_1',
            toType: 'kasa',
            toId: 'ksa_1',
            fromAmount: 500,
            toAmount: 500,
            fromCurrency: 'TRY',
            toCurrency: 'TRY',
            description: 'Kasa besleme',
            cashflowCatId: null,
          },
        ],
      }),
    );
    assert.equal(p.transfers.length, 1);
    assert.equal(p.transfers[0]!.fromClientId, 'acc_1');
    assert.equal(p.transfers[0]!.toClientId, 'ksa_1');
    assert.equal(p.transfers[0]!.description, 'Kasa besleme');
  });

  it('toAmount yok → fromAmount; para birimi yok → uç hesabın birimi', () => {
    const p = projectFinance(
      blob({
        ...accounts,
        transfers: [
          {
            id: 'trf_1',
            date: '2026-05-01',
            fromType: 'bank',
            fromId: 'acc_2', // USD hesabı
            toType: 'kasa',
            toId: 'ksa_1',
            fromAmount: 99.999,
          },
        ],
      }),
    );
    assert.equal(p.transfers[0]!.fromAmount, 100);
    assert.equal(p.transfers[0]!.toAmount, 100);
    assert.equal(p.transfers[0]!.fromCurrency, 'USD');
    assert.equal(p.transfers[0]!.toCurrency, 'TRY');
  });

  it('kırpmalar: aynı uca transfer / çözülmeyen uç / tutar <= 0 → düşer', () => {
    const p = projectFinance(
      blob({
        ...accounts,
        transfers: [
          {
            id: 't1',
            date: '2026-01-01',
            fromType: 'bank',
            fromId: 'acc_1',
            toType: 'bank',
            toId: 'acc_1', // CHECK: aynı hesaba yasak
            fromAmount: 5,
          },
          {
            id: 't2',
            date: '2026-01-01',
            fromType: 'kasa',
            fromId: 'acc_1', // kasa tipiyle banka id'si çözülmez
            toType: 'bank',
            toId: 'acc_2',
            fromAmount: 5,
          },
          {
            id: 't3',
            date: '2026-01-01',
            fromType: 'bank',
            fromId: 'acc_1',
            toType: 'kasa',
            toId: 'ksa_1',
            fromAmount: -3,
          },
        ],
      }),
    );
    assert.deepEqual(p.transfers, []);
    assert.equal(p.dropped['transfers.sameEndpoint'], 1);
    assert.equal(p.dropped['transfers.endpoint'], 1);
    assert.equal(p.dropped['transfers.amount'], 1);
  });
});

describe('projectFinance — faturalar & ödemeler', () => {
  it('happy (elle girilen şekil): vatRate % → oran, netAmount → subtotal', () => {
    const p = projectFinance(blob({ invoices: [invoice('inv_1', { description: 'Mart işi' })] }));
    assert.equal(p.invoices.length, 1);
    assert.deepEqual(p.invoices[0], {
      companyId: 2,
      clientId: 'inv_1',
      type: 'out',
      invoiceNo: 'FTR-1',
      counterparty: 'Acme AŞ',
      issueDate: '2026-01-05',
      dueDate: '2026-02-05',
      currency: 'TRY',
      subtotal: 100,
      kdvRate: 0.2,
      kdv: 20,
      total: 120,
      paidAmount: 0,
      cashflowCatClientId: null,
      committedToCells: false,
      note: 'Mart işi',
    });
  });

  it('happy (e-fatura şekli): AP→in, issueDate/partyName COALESCE mantığı', () => {
    const p = projectFinance(
      blob({
        invoices: [
          {
            id: 'inv_e',
            type: 'AP',
            invoiceNo: 'GIB2026-1',
            partyName: 'Tedarikçi Ltd',
            issueDate: '2026-04-01T00:00:00Z',
            dueDate: '2026-05-01',
            currency: 'TRY',
            total: 1000,
            paidAmount: 0,
            source: 'einvoice',
          },
        ],
      }),
    );
    assert.equal(p.invoices[0]!.type, 'in');
    assert.equal(p.invoices[0]!.counterparty, 'Tedarikçi Ltd');
    assert.equal(p.invoices[0]!.issueDate, '2026-04-01');
    assert.equal(p.invoices[0]!.subtotal, 1000); // netAmount yok → total
    assert.equal(p.invoices[0]!.kdvRate, 0); // vatRate yok → 0
  });

  it('INVOICE_TYPE_MAP: in/ap→in, out/ar→out; bilinmeyen tip → fatura düşer', () => {
    assert.deepEqual(INVOICE_TYPE_MAP, { in: 'in', ap: 'in', out: 'out', ar: 'out' });
    const p = projectFinance(
      blob({ invoices: [invoice('inv_1', { type: 'AR' }), invoice('inv_2', { type: 'satis' })] }),
    );
    assert.equal(p.invoices.length, 1);
    assert.equal(p.invoices[0]!.type, 'out');
    assert.equal(p.dropped['invoices.type'], 1);
  });

  it('kırpmalar: dueDate fallback zinciri; taraf/total yoksa düşer; paidAmount kırpılır', () => {
    const p = projectFinance(
      blob({
        invoices: [
          invoice('inv_1', { dueDate: '', paidAmount: 999 }), // dueDate → date; paid 999 → 120
          invoice('inv_2', { counterparty: '', partyName: undefined }),
          invoice('inv_3', { total: 0 }),
          invoice('inv_4', { date: '', dueDate: '', createdAt: '2026-06-01T10:00:00Z' }),
        ],
      }),
    );
    const inv1 = p.invoices.find((i) => i.clientId === 'inv_1');
    assert.equal(inv1?.dueDate, '2026-01-05');
    assert.equal(inv1?.paidAmount, 120); // CHECK paid_amount <= total
    assert.equal(p.invoices.find((i) => i.clientId === 'inv_4')?.dueDate, '2026-06-01');
    assert.equal(p.dropped['invoices.counterparty'], 1);
    assert.equal(p.dropped['invoices.total'], 1);
  });

  it('ödemeler: uç çözümü + id yoksa bileşik clientId; şirket faturadan', () => {
    const p = projectFinance(
      blob({
        bankAccounts: [bankAccount('acc_1')],
        kasaAccounts: [kasa('ksa_1')],
        invoices: [
          invoice('inv_1', {
            paidAmount: 70,
            payments: [
              {
                id: 'pay_1',
                date: '2026-02-01',
                amount: 50,
                currency: 'TRY',
                fromType: 'bank',
                fromId: 'acc_1',
                description: 'Havale',
              },
              { date: '2026-02-02', amount: 20, fromType: 'kasa', fromId: 'ksa_1' }, // id yok
            ],
          }),
        ],
      }),
    );
    assert.equal(p.invoicePayments.length, 2);
    assert.deepEqual(p.invoicePayments[0], {
      companyId: 2,
      clientId: 'pay_1',
      invoiceClientId: 'inv_1',
      amount: 50,
      date: '2026-02-01',
      currency: 'TRY',
      bankAccountClientId: 'acc_1',
      kasaAccountClientId: null,
      note: 'Havale',
    });
    assert.equal(p.invoicePayments[1]!.clientId, 'inv_1:p1');
    assert.equal(p.invoicePayments[1]!.kasaAccountClientId, 'ksa_1');
    assert.equal(p.invoicePayments[1]!.currency, 'TRY'); // fatura biriminden
  });

  it("ödeme toplamı total'i aşamaz (trigger paid_amount'u yazar — CHECK korunur)", () => {
    const p = projectFinance(
      blob({
        invoices: [
          invoice('inv_1', {
            total: 100,
            payments: [
              { id: 'p1', date: '2026-02-01', amount: 60 },
              { id: 'p2', date: '2026-02-02', amount: 60 }, // kümülatif 120 > 100 → düşer
              { id: 'p3', date: '2026-02-03', amount: 40 }, // 60+40=100 → sığar
              { id: 'p4', date: 'bozuk', amount: 1 }, // tarih bozuk → düşer
              { id: 'p5', date: '2026-02-04', amount: -1 }, // CHECK amount > 0 → düşer
            ],
          }),
        ],
      }),
    );
    assert.deepEqual(
      p.invoicePayments.map((x) => x.clientId),
      ['p1', 'p3'],
    );
    assert.equal(p.dropped['invoicePayments.exceedsTotal'], 1);
    assert.equal(p.dropped['invoicePayments.date'], 1);
    assert.equal(p.dropped['invoicePayments.amount'], 1);
  });
});
