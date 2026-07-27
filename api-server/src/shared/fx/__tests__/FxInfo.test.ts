/**
 * FxInfo birim testleri — dondurulmuş kur sözleşmesi (migration 051).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asFxCurrency, asFxRateSource, FxInfo } from '../FxInfo.js';

describe('asFxCurrency / asFxRateSource', () => {
  it('geçerli para birimini geçirir', () => {
    assert.equal(asFxCurrency('USD'), 'USD');
    assert.equal(asFxCurrency('EUR'), 'EUR');
  });

  it('geçersizi TRY ye indirger', () => {
    assert.equal(asFxCurrency('GBP'), 'TRY');
    assert.equal(asFxCurrency(null), 'TRY');
    assert.equal(asFxCurrency(undefined), 'TRY');
  });

  it('geçersiz kur kaynağı null olur', () => {
    assert.equal(asFxRateSource('manual'), 'manual');
    assert.equal(asFxRateSource('tcmb'), 'tcmb');
    assert.equal(asFxRateSource('otomatik'), null);
  });
});

describe('FxInfo.none — TRY kanonik biçim', () => {
  it('kur 1, kaynak yok', () => {
    const fx = FxInfo.none();
    assert.equal(fx.currency, 'TRY');
    assert.equal(fx.rate, 1);
    assert.equal(fx.source, null);
    assert.equal(fx.isForeign, false);
  });

  it('TRY girdisi kanonik biçime indirgenir (kur/kaynak yok sayılır)', () => {
    const fx = FxInfo.fromInput({
      currency: 'TRY',
      fxRate: 34,
      fxRateSource: 'manual',
      fxRateDate: '2026-07-20',
    });
    assert.equal(fx.rate, 1);
    assert.equal(fx.source, null);
    assert.equal(fx.rateDate, null);
  });
});

describe('FxInfo.fromInput', () => {
  it('dövizli girdiyi okur', () => {
    const fx = FxInfo.fromInput({
      currency: 'USD',
      fxRate: 34.5,
      fxRateSource: 'tcmb',
      fxRateDate: '2026-07-20',
    });
    assert.equal(fx.currency, 'USD');
    assert.equal(fx.rate, 34.5);
    assert.equal(fx.source, 'tcmb');
    assert.equal(fx.rateDate, '2026-07-20');
    assert.equal(fx.isForeign, true);
    assert.equal(fx.hasRate, true);
  });

  it('sayısal string kuru kabul eder', () => {
    assert.equal(FxInfo.fromInput({ currency: 'EUR', fxRate: '41.25' }).rate, 41.25);
  });

  it('sıfır/negatif/geçersiz kur null olur', () => {
    assert.equal(FxInfo.fromInput({ currency: 'USD', fxRate: 0 }).rate, null);
    assert.equal(FxInfo.fromInput({ currency: 'USD', fxRate: -3 }).rate, null);
    assert.equal(FxInfo.fromInput({ currency: 'USD', fxRate: 'abc' }).rate, null);
    assert.equal(FxInfo.fromInput({ currency: 'USD' }).hasRate, false);
  });

  it('geçersiz tarih null olur', () => {
    assert.equal(FxInfo.fromInput({ currency: 'USD', fxRateDate: '20.07.2026' }).rateDate, null);
  });
});

describe('FxInfo.fromRow — DB satırı', () => {
  it('numeric string kuru ve Date tarihini okur', () => {
    const fx = FxInfo.fromRow({
      currency: 'USD',
      fx_rate: '34.021700',
      fx_rate_source: 'tcmb',
      fx_rate_date: new Date('2026-07-20T00:00:00Z'),
    });
    assert.ok(Math.abs((fx.rate ?? 0) - 34.0217) < 1e-9);
    assert.equal(fx.rateDate, '2026-07-20');
  });

  it('TRY satırı kanonik biçime döner', () => {
    const fx = FxInfo.fromRow({ currency: 'TRY', fx_rate: null, fx_rate_source: null });
    assert.equal(fx.isForeign, false);
    assert.equal(fx.rate, 1);
  });
});

describe('toTRY — dondurulmuş kurla TRY karşılığı', () => {
  it('dövizli tutarı çevirir ve 2 ondalığa yuvarlar', () => {
    const fx = FxInfo.fromInput({ currency: 'USD', fxRate: 33.333, fxRateSource: 'manual' });
    assert.equal(fx.toTRY(10.333), 344.43);
  });

  it('TRY tutarı aynen döner (2 ondalık)', () => {
    assert.equal(FxInfo.none().toTRY(1234.567), 1234.57);
  });

  it('kur bilinmiyorsa null döner (çağıran tarihli kura düşer)', () => {
    assert.equal(FxInfo.fromInput({ currency: 'USD' }).toTRY(100), null);
  });

  it('sonlu olmayan tutar null döner', () => {
    assert.equal(FxInfo.none().toTRY(Number.NaN), null);
  });
});

describe('toRow / toJSON', () => {
  it('toRow 051 kolon adlarını üretir', () => {
    const fx = FxInfo.fromInput({
      currency: 'EUR',
      fxRate: 42,
      fxRateSource: 'tcmb',
      fxRateDate: '2026-07-15',
    });
    assert.deepEqual(fx.toRow(), {
      currency: 'EUR',
      fx_rate: 42,
      fx_rate_source: 'tcmb',
      fx_rate_date: '2026-07-15',
    });
  });

  it('TRY kaydında fx_rate NULL yazılır', () => {
    assert.deepEqual(FxInfo.none().toRow(), {
      currency: 'TRY',
      fx_rate: null,
      fx_rate_source: null,
      fx_rate_date: null,
    });
  });

  it('toJSON frontend alan adlarını kullanır', () => {
    const fx = FxInfo.fromInput({ currency: 'USD', fxRate: 34, fxRateSource: 'manual' });
    assert.deepEqual(fx.toJSON(), {
      currency: 'USD',
      fxRate: 34,
      fxRateSource: 'manual',
      fxRateDate: null,
    });
  });
});

describe('FxInfo.create doğrulama', () => {
  it('pozitif olmayan kur reddedilir', () => {
    assert.throws(
      () => FxInfo.create({ currency: 'USD', rate: 0, source: null, rateDate: null }),
      /pozitif/,
    );
    assert.throws(
      () => FxInfo.create({ currency: 'USD', rate: Number.NaN, source: null, rateDate: null }),
      /pozitif/,
    );
  });

  it('null kur kabul edilir (kur henüz bilinmiyor)', () => {
    assert.equal(
      FxInfo.create({ currency: 'USD', rate: null, source: null, rateDate: null }).hasRate,
      false,
    );
  });
});
