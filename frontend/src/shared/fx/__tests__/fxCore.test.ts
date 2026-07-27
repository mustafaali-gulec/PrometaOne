/**
 * fxCore birim testleri — kur önceliği ve çift-kayıt saklama sözleşmesi.
 */
import { describe, expect, it } from 'vitest';

import {
  convertTRYForDisplay,
  displayAmount,
  findHistoryRate,
  fmtFxMoney,
  fmtRate,
  fxFromTRY,
  fxToTRY,
  normalizeFxDraft,
  rateBookFromAppState,
  recordAmountTRY,
  resolveRate,
  sumTRY,
  toIsoDate,
  type RateBook,
} from '../fxCore';

/** App.jsx `rateHistory` biçimi: tarih DD-MM-YYYY. */
const rateBook: RateBook = {
  current: { USD: 40, EUR: 45 },
  history: [
    { date: '15-07-2026', USD: 38, EUR: 42 },
    { date: '01-07-2026', USD: 36, EUR: 40 },
    { date: '10-06-2026', USD: 34, EUR: 38 },
  ],
};

describe('toIsoDate', () => {
  it('DD-MM-YYYY biçimini ISO ya çevirir', () => {
    expect(toIsoDate('15-07-2026')).toBe('2026-07-15');
  });
  it('ISO girdiyi olduğu gibi bırakır', () => {
    expect(toIsoDate('2026-07-15')).toBe('2026-07-15');
  });
  it('ISO zaman damgasını güne kırpar', () => {
    expect(toIsoDate('2026-07-15T10:22:00Z')).toBe('2026-07-15');
  });
  it('ayrıştırılamayanı null döner', () => {
    expect(toIsoDate('abc')).toBeNull();
    expect(toIsoDate(null)).toBeNull();
  });
});

describe('findHistoryRate', () => {
  it('tarihe eşit ya da ondan önceki en yakın kuru bulur', () => {
    expect(findHistoryRate(rateBook.history, 'USD', '2026-07-10')).toEqual({
      rate: 36,
      rateDate: '2026-07-01',
    });
  });
  it('tam tarih eşleşmesini kullanır', () => {
    expect(findHistoryRate(rateBook.history, 'EUR', '2026-07-15')).toEqual({
      rate: 42,
      rateDate: '2026-07-15',
    });
  });
  it('geçmişten önceki tarihte null döner', () => {
    expect(findHistoryRate(rateBook.history, 'USD', '2026-01-01')).toBeNull();
  });
});

describe('resolveRate — öncelik: kayıt kuru → tarihli TCMB → güncel', () => {
  it('TRY için çevrim yapmaz', () => {
    expect(resolveRate('TRY', { rateBook })).toEqual({
      rate: 1,
      basis: 'identity',
      rateDate: null,
    });
  });

  it('kaydın kendi kuru varsa onu kullanır', () => {
    const r = resolveRate('USD', { date: '2026-07-20', recordRate: 33.5, rateBook });
    expect(r.rate).toBe(33.5);
    expect(r.basis).toBe('record');
  });

  it('kayıt kuru yoksa kayıt tarihli TCMB kurunu kullanır', () => {
    const r = resolveRate('USD', { date: '2026-07-20', rateBook });
    expect(r.rate).toBe(38);
    expect(r.basis).toBe('history');
    expect(r.rateDate).toBe('2026-07-15');
  });

  it('tarihsel kur yoksa güncel kura düşer', () => {
    const r = resolveRate('USD', { date: '2020-01-01', rateBook });
    expect(r.rate).toBe(40);
    expect(r.basis).toBe('current');
  });

  it('hiç kur yoksa 1 döner ve missing işaretler', () => {
    const r = resolveRate('USD', { date: '2026-07-20', rateBook: { current: {}, history: [] } });
    expect(r).toEqual({ rate: 1, basis: 'missing', rateDate: null });
  });

  it('sıfır/negatif kaydedilmiş kuru yok sayar', () => {
    expect(resolveRate('USD', { date: '2026-07-20', recordRate: 0, rateBook }).basis).toBe(
      'history',
    );
    expect(resolveRate('USD', { date: '2026-07-20', recordRate: -5, rateBook }).basis).toBe(
      'history',
    );
  });
});

describe('fxToTRY / fxFromTRY', () => {
  it('dövizi TRY ye çevirir', () => {
    expect(fxToTRY(100, 'USD', { date: '2026-07-20', rateBook })).toBe(3800);
  });
  it('TRY yi dövize çevirir', () => {
    expect(fxFromTRY(3800, 'USD', { date: '2026-07-20', rateBook })).toBe(100);
  });
  it('boş tutar için 0 döner', () => {
    expect(fxToTRY(null, 'USD', { rateBook })).toBe(0);
    expect(fxFromTRY('', 'EUR', { rateBook })).toBe(0);
  });
});

describe('recordAmountTRY — çift kayıt', () => {
  it('saklanmış amountTRY otoriterdir (kur donmuştur)', () => {
    const rec = { amount: 100, currency: 'USD', fxRate: 30, amountTRY: 3000, date: '2026-07-20' };
    expect(recordAmountTRY(rec, rateBook)).toBe(3000);
  });

  it('amountTRY yoksa kaydın kuruyla hesaplar', () => {
    const rec = { amount: 100, currency: 'USD', fxRate: 30, date: '2026-07-20' };
    expect(recordAmountTRY(rec, rateBook)).toBe(3000);
  });

  it('kur da yoksa tarihli TCMB ile hesaplar', () => {
    const rec = { amount: 100, currency: 'USD', date: '2026-07-20' };
    expect(recordAmountTRY(rec, rateBook)).toBe(3800);
  });

  it('TRY kayıtta tutarı aynen döner', () => {
    expect(recordAmountTRY({ amount: 250, currency: 'TRY' }, rateBook)).toBe(250);
  });
});

describe('displayAmount — üst bardaki döviz cinsi', () => {
  const rec = { amount: 100, currency: 'USD', fxRate: 30, amountTRY: 3000, date: '2026-07-20' };

  it('TRY seçiliyken TL karşılığını döner', () => {
    expect(displayAmount(rec, 'TRY', rateBook)).toBe(3000);
  });

  it('kayıt zaten hedef para birimindeyse orijinal tutarı birebir döner', () => {
    // 3000/38 = 78,94 DEĞİL — kullanıcının girdiği 100 $ görünür.
    expect(displayAmount(rec, 'USD', rateBook)).toBe(100);
  });

  it('farklı para birimine kayıt tarihli TCMB kuruyla çevirir', () => {
    // 3000 TRY / 42 (15-07-2026 EUR) = 71,428…
    expect(displayAmount(rec, 'EUR', rateBook)).toBeCloseTo(3000 / 42, 6);
  });

  it('TRY kaydı seçili dövize kayıt tarihli kurla çevirir', () => {
    const tryRec = { amount: 3800, currency: 'TRY', amountTRY: 3800, date: '2026-07-20' };
    expect(displayAmount(tryRec, 'USD', rateBook)).toBe(100);
  });
});

describe('convertTRYForDisplay', () => {
  it('TRY hedefinde aynen döner', () => {
    expect(convertTRYForDisplay(1234.5, 'TRY', { rateBook })).toBe(1234.5);
  });
  it('tarih verilmezse güncel kuru kullanır', () => {
    expect(convertTRYForDisplay(4000, 'USD', { rateBook })).toBe(100);
  });
  it('tarih verilirse o günün kurunu kullanır', () => {
    expect(convertTRYForDisplay(3800, 'USD', { date: '2026-07-20', rateBook })).toBe(100);
  });
});

describe('normalizeFxDraft — kaydetme sözleşmesi', () => {
  it('dövizsiz draft TRY olarak normalize olur', () => {
    expect(normalizeFxDraft({ isFx: false, amount: 500, currency: 'USD' }, rateBook)).toEqual({
      currency: 'TRY',
      fxRate: null,
      fxRateSource: null,
      fxRateDate: null,
      amountTRY: 500,
    });
  });

  it('manuel kur kayda dondurulur', () => {
    const out = normalizeFxDraft(
      {
        isFx: true,
        amount: 100,
        currency: 'USD',
        fxRate: 33.25,
        fxRateSource: 'manual',
        date: '2026-07-20',
      },
      rateBook,
    );
    expect(out).toEqual({
      currency: 'USD',
      fxRate: 33.25,
      fxRateSource: 'manual',
      fxRateDate: '2026-07-20',
      amountTRY: 3325,
    });
  });

  it('TCMB kaynağında kayıt tarihli kur dondurulur', () => {
    const out = normalizeFxDraft(
      { isFx: true, amount: 200, currency: 'EUR', fxRateSource: 'tcmb', date: '2026-07-20' },
      rateBook,
    );
    expect(out.fxRate).toBe(42);
    expect(out.fxRateSource).toBe('tcmb');
    expect(out.fxRateDate).toBe('2026-07-15');
    expect(out.amountTRY).toBe(8400);
  });

  it('currency TRY iken isFx tiki yok sayılır', () => {
    const out = normalizeFxDraft({ isFx: true, amount: 100, currency: 'TRY' }, rateBook);
    expect(out.currency).toBe('TRY');
    expect(out.amountTRY).toBe(100);
  });

  it('TRY karşılığı 2 ondalığa yuvarlanır', () => {
    const out = normalizeFxDraft(
      {
        isFx: true,
        amount: 10.333,
        currency: 'USD',
        fxRate: 33.333,
        fxRateSource: 'manual',
        date: '2026-07-20',
      },
      rateBook,
    );
    expect(out.amountTRY).toBe(344.43);
  });
});

describe('sumTRY', () => {
  it('karışık para birimli kayıtları TRY de toplar', () => {
    const recs = [
      { amount: 100, currency: 'USD', fxRate: 30, amountTRY: 3000 },
      { amount: 100, currency: 'TRY', amountTRY: 100 },
      { amount: 10, currency: 'EUR', date: '2026-07-20' }, // 10 × 42
    ];
    expect(sumTRY(recs, rateBook)).toBe(3520);
  });
  it('boş liste için 0 döner', () => {
    expect(sumTRY(null, rateBook)).toBe(0);
  });
});

describe('rateBookFromAppState', () => {
  it('app-state alanlarını kur defterine eşler', () => {
    const book = rateBookFromAppState({
      exchangeRates: { USD: 41 },
      rateHistory: [{ date: '01-01-2026', USD: 30 }],
    });
    expect(book.current).toEqual({ USD: 41 });
    expect(book.history).toHaveLength(1);
  });
  it('eksik alanlarda boş defter döner', () => {
    expect(rateBookFromAppState(null)).toEqual({ current: {}, history: [] });
  });
});

describe('biçimleme', () => {
  it('sembollü tutar', () => {
    expect(fmtFxMoney(1234.5, 'USD')).toBe('1.234,50 $');
    expect(fmtFxMoney(1234.5, 'TRY', { symbolFirst: true })).toBe('₺ 1.234,50');
  });
  it('kur en çok 4 ondalık', () => {
    expect(fmtRate(34.021734)).toBe('34,0217');
    expect(fmtRate(null)).toBe('—');
  });
});
