/**
 * Kasa Excel Import parser testleri (can_tekel_daily + generic + parseAmount).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { KasaImportEntry, KasaImportExpenseCard } from '../application/dto/KasaImportDtos.js';
import { ParseKasaImportUseCase, parseAmount } from '../application/useCases/KasaImportUseCases.js';

function findEntry(
  entries: KasaImportEntry[],
  predicate: (e: KasaImportEntry) => boolean,
): KasaImportEntry | undefined {
  return entries.find(predicate);
}

function findCard(cards: KasaImportExpenseCard[], name: string): KasaImportExpenseCard | undefined {
  return cards.find(
    (c) => c.name.trim().toLocaleUpperCase('tr-TR') === name.toLocaleUpperCase('tr-TR'),
  );
}

describe('parseAmount', () => {
  it('EN format: "24,435.00 ₺" → 24435', () => {
    assert.equal(parseAmount('24,435.00 ₺'), 24435);
  });
  it('TR format: "1.234,56" → 1234.56', () => {
    assert.equal(parseAmount('1.234,56'), 1234.56);
  });
  it('TR format: "1234,56" → 1234.56', () => {
    assert.equal(parseAmount('1234,56'), 1234.56);
  });
  it('sadece nokta: "44606.00" → 44606', () => {
    assert.equal(parseAmount('44606.00'), 44606);
  });
  it('boş / geçersiz → 0', () => {
    assert.equal(parseAmount(''), 0);
    assert.equal(parseAmount('   '), 0);
    assert.equal(parseAmount('abc'), 0);
  });
  it('mutlak değer döner', () => {
    assert.equal(parseAmount('-50,00'), 50);
  });
  it('NBSP ve ₺ temizlenir', () => {
    assert.equal(parseAmount('25,000.00 ₺'), 25000);
  });
});

describe('ParseKasaImportUseCase — can_tekel_daily', () => {
  const sheetRows: string[][] = [];
  sheetRows[0] = ['', 'TEKEL', 'GÜNLÜK RAPORU', '', '', 'TARİH', 'Friday, May 01, 2026'];
  sheetRows[1] = ['', '', '', '', '', '', ''];
  sheetRows[2] = ['', 'HASILATLAR', '', '', 'Nakit', 'Kredi Kartı', 'Toplam'];
  sheetRows[3] = ['', '', '', '', '', '', ''];
  sheetRows[4] = ['1', 'TEKEL KASA', '', '', '24,435.00 ₺', '44,606.00 ₺', '69,041.00 ₺'];
  sheetRows[5] = ['', '', '', '', '', '', ''];
  sheetRows[6] = ['3', 'KASİYER FAZLASI', '', '', '155.00 ₺', '0.00 ₺', '155.00 ₺'];
  sheetRows[7] = ['', '', '', '', '', '', ''];
  sheetRows[8] = ['', '', '', '', '', '', ''];
  sheetRows[9] = ['', '', 'GENEL TOPLAM', '', '24,590.00 ₺', '44,606.00 ₺', '69,196.00 ₺'];
  sheetRows[10] = ['', '', '', '', '', '', ''];
  sheetRows[11] = ['', 'KASİYER NO', 'GİDERLER', 'Mahiyeti', 'Nakit', 'Kredi Kartı', 'Fatura No'];
  sheetRows[12] = ['1', 'KASIYER', 'ISTAKAYA VERILEN ', 'CARIYE', '4,650.00 ₺', '', ''];
  sheetRows[13] = [
    '2',
    'KASIYER',
    'PERSONEL 2.5LT KOLA IKRAM ',
    'İŞLETME GIDERI',
    '95.00 ₺',
    '',
    '',
  ];
  sheetRows[14] = [
    '3',
    'KASIYER',
    'ALI MUHASEBE NISAN MAAŞ MAHSUBEN AVANS ',
    'İŞLETME GIDERI',
    '400.00 ₺',
    '',
    '',
  ];
  sheetRows[15] = ['4', '', '', '', '', '', ''];
  sheetRows[16] = ['5', '', '', '', '', '', ''];
  sheetRows[17] = ['6', '', '', '', '', '', ''];
  sheetRows[18] = [
    '7',
    'ADALI AK BANK ',
    'REMZI ÇAKAR CARI HESABA MAHSUBEN ÖDEME ',
    'ÖDEME ',
    '',
    '25,000.00 ₺',
    'İLGİLİ DEKONT',
  ];
  sheetRows[19] = ['8', '', '', '', '', '', ''];
  // doldurucu boş satırlar
  for (let i = 20; i < 42; i += 1) sheetRows[i] = ['', '', '', '', '', '', ''];
  sheetRows[42] = ['', '', 'GENEL TOPLAM', '', '6,675.00 ₺', '25,000.00 ₺', '6,675.00 ₺'];

  const uc = new ParseKasaImportUseCase();
  const result = uc.execute({
    companyId: 100,
    formatId: 'can_tekel_daily',
    sheets: [{ name: '01.05', rows: sheetRows }],
  });

  it('tarih tam tarihten 2026-05-01 olarak ayrıştırılır', () => {
    assert.equal(result.summary.dateRange.from, '2026-05-01');
    assert.equal(result.summary.dateRange.to, '2026-05-01');
    for (const e of result.entries) assert.equal(e.date, '2026-05-01');
  });

  it('TEKEL KASA → in/cash 24435 ve in/card 44606', () => {
    const cash = findEntry(
      result.entries,
      (e) => e.description === 'TEKEL KASA' && e.paymentMethod === 'cash',
    );
    assert.ok(cash, 'nakit hasılat girişi bulunmalı');
    assert.equal(cash.type, 'in');
    assert.equal(cash.amount, 24435);
    assert.equal(cash.category, 'HASILAT');

    const card = findEntry(
      result.entries,
      (e) => e.description === 'TEKEL KASA' && e.paymentMethod === 'card',
    );
    assert.ok(card, 'kart hasılat girişi bulunmalı');
    assert.equal(card.type, 'in');
    assert.equal(card.amount, 44606);
  });

  it('KASİYER FAZLASI: nakit 155 girişi var, kart 0 → giriş yok', () => {
    const cash = findEntry(
      result.entries,
      (e) => e.description === 'KASİYER FAZLASI' && e.paymentMethod === 'cash',
    );
    assert.ok(cash);
    assert.equal(cash.amount, 155);
    const card = findEntry(
      result.entries,
      (e) => e.description === 'KASİYER FAZLASI' && e.paymentMethod === 'card',
    );
    assert.equal(card, undefined);
  });

  it('ISTAKAYA VERILEN → out/cash 4650, kategori CARIYE', () => {
    const e = findEntry(result.entries, (x) => x.description === 'ISTAKAYA VERILEN');
    assert.ok(e);
    assert.equal(e.type, 'out');
    assert.equal(e.paymentMethod, 'cash');
    assert.equal(e.amount, 4650);
    assert.equal(e.category, 'CARIYE');
  });

  it('REMZI ÇAKAR → out/card 25000, kategori ÖDEME, fatura İLGİLİ DEKONT', () => {
    const e = findEntry(result.entries, (x) => x.description.startsWith('REMZI ÇAKAR'));
    assert.ok(e);
    assert.equal(e.type, 'out');
    assert.equal(e.paymentMethod, 'card');
    assert.equal(e.amount, 25000);
    assert.equal(e.category, 'ÖDEME');
    assert.equal(e.invoiceNo, 'İLGİLİ DEKONT');
  });

  it('boş numaralı satırlar HİÇ giriş üretmez', () => {
    // rowRef 15,16,17,19 + 20..41 boş → entry yok
    const blankRefs = [15, 16, 17, 19, 20, 30, 41];
    for (const ref of blankRefs) {
      const e = findEntry(result.entries, (x) => x.rowRef === ref);
      assert.equal(e, undefined, `rowRef ${ref} giriş üretmemeli`);
    }
  });

  it('expenseCards: CARIYE, İŞLETME GIDERI, ÖDEME doğru occurrence', () => {
    const cariye = findCard(result.expenseCards, 'CARIYE');
    assert.ok(cariye);
    assert.equal(cariye.occurrences, 1);
    assert.equal(cariye.direction, 'out');

    const isletme = findCard(result.expenseCards, 'İŞLETME GIDERI');
    assert.ok(isletme);
    // iki gider satırı (KOLA IKRAM + MAAŞ AVANS) aynı mahiyet
    assert.equal(isletme.occurrences, 2);

    const odeme = findCard(result.expenseCards, 'ÖDEME');
    assert.ok(odeme);
    assert.equal(odeme.occurrences, 1);
  });

  it('summary totalleri doğru', () => {
    // in: 24435 + 44606 + 155 = 69196
    assert.equal(result.summary.totalIn, 69196);
    // out: 4650 + 95 + 400 + 25000 = 30145
    assert.equal(result.summary.totalOut, 30145);
    assert.equal(result.summary.sheetCount, 1);
    assert.equal(result.formatId, 'can_tekel_daily');
  });

  it('eksik bölümlü sayfa crash etmez', () => {
    const partial = uc.execute({
      companyId: 100,
      formatId: 'can_tekel_daily',
      sheets: [{ name: '02.05', rows: [['', '', '', '', '', '', 'Saturday, May 02, 2026']] }],
    });
    assert.equal(partial.entries.length, 0);
    assert.equal(partial.warnings.length, 0);
  });

  it('tarihsiz sayfa → warning + atlanır', () => {
    const noDate = uc.execute({
      companyId: 100,
      formatId: 'can_tekel_daily',
      sheets: [{ name: 'Özet', rows: [['', 'HASILATLAR']] }],
    });
    assert.equal(noDate.entries.length, 0);
    assert.equal(noDate.warnings.length, 1);
  });
});

describe('ParseKasaImportUseCase — generic', () => {
  const uc = new ParseKasaImportUseCase();

  it('amountIn/amountOut kolonları ile in/out üretir', () => {
    const rows: string[][] = [
      ['Tarih', 'Açıklama', 'Giriş', 'Çıkış', 'Kategori'],
      ['Friday, May 01, 2026', 'Satış geliri', '1.000,00', '', 'GELIR'],
      ['Friday, May 01, 2026', 'Kira ödemesi', '', '2.500,00', 'KIRA'],
      ['', '', '', '', ''],
    ];
    const result = uc.execute({
      companyId: 100,
      formatId: 'generic',
      sheets: [{ name: 'Kasa', rows }],
      columnMap: {
        headerRowIndex: 0,
        date: 0,
        description: 1,
        amountIn: 2,
        amountOut: 3,
        category: 4,
      },
    });
    assert.equal(result.entries.length, 2);
    const gelir = result.entries.find((e) => e.type === 'in');
    assert.ok(gelir);
    assert.equal(gelir.amount, 1000);
    assert.equal(gelir.date, '2026-05-01');
    const kira = result.entries.find((e) => e.type === 'out');
    assert.ok(kira);
    assert.equal(kira.amount, 2500);
    assert.equal(kira.category, 'KIRA');
  });

  it('amount + type kolonları ile yön tespiti', () => {
    const rows: string[][] = [
      ['Tarih', 'Açıklama', 'Tutar', 'Tür'],
      ['2026-05-03', 'Tahsilat', '500', 'Tahsilat'],
      ['2026-05-03', 'Gider', '300', 'Ödeme'],
    ];
    const result = uc.execute({
      companyId: 100,
      formatId: 'generic',
      year: 2026,
      sheets: [{ name: 'Kasa', rows }],
      columnMap: { headerRowIndex: 0, date: 0, description: 1, amount: 2, type: 3 },
    });
    assert.equal(result.entries.length, 2);
    assert.equal(result.entries[0]!.type, 'in');
    assert.equal(result.entries[1]!.type, 'out');
  });

  it('columnMap yoksa warning', () => {
    const result = uc.execute({
      companyId: 100,
      formatId: 'generic',
      sheets: [{ name: 'Kasa', rows: [['a', 'b']] }],
    });
    assert.equal(result.entries.length, 0);
    assert.equal(result.warnings.length, 1);
  });
});
