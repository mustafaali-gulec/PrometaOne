/**
 * TcmbRateProvider testleri — fetch stub ile EVDS parse + tarih dönüşümü.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RateProviderError } from '../domain/errors/FxErrors.js';
import { TcmbRateProvider } from '../infrastructure/rates/TcmbRateProvider.js';

function jsonResponse(
  body: unknown,
  ok = true,
): {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
} {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Server Error',
    json: () => Promise.resolve(body),
  };
}

describe('TcmbRateProvider', () => {
  it("EVDS yanıtını DailyRate[]'e çevirir, tarih YYYY-MM-DD olur", async () => {
    let capturedUrl = '';
    const provider = new TcmbRateProvider({
      fetchFn: (url) => {
        capturedUrl = url;
        return Promise.resolve(
          jsonResponse({
            totalCount: 1,
            items: [
              { Tarih: '30-05-2026', TP_DK_USD_A_YTL: '32.1500', TP_DK_EUR_A_YTL: '35.0000' },
            ],
          }),
        );
      },
    });

    const rates = await provider.fetchRates('2026-05-25', '2026-05-30');

    // URL EVDS DD-MM-YYYY formatı + series
    assert.ok(capturedUrl.includes('startDate=25-05-2026'));
    assert.ok(capturedUrl.includes('endDate=30-05-2026'));
    assert.ok(capturedUrl.includes('TP.DK.USD.A.YTL'));

    assert.equal(rates.length, 2);
    const usd = rates.find((r) => r.currency === 'USD')!;
    const eur = rates.find((r) => r.currency === 'EUR')!;
    assert.equal(usd.date, '2026-05-30');
    assert.equal(usd.rate, 32.15);
    assert.equal(eur.rate, 35.0);
  });

  it('sıfır/eksik kuru atlar', async () => {
    const provider = new TcmbRateProvider({
      fetchFn: () =>
        Promise.resolve(
          jsonResponse({ items: [{ Tarih: '30-05-2026', TP_DK_USD_A_YTL: '32.15' }] }),
        ),
    });
    const rates = await provider.fetchRates('2026-05-30', '2026-05-30');
    assert.equal(rates.length, 1); // sadece USD
    assert.equal(rates[0]!.currency, 'USD');
  });

  it('boş items → boş liste', async () => {
    const provider = new TcmbRateProvider({
      fetchFn: () => Promise.resolve(jsonResponse({ items: [] })),
    });
    assert.deepEqual(await provider.fetchRates('2026-05-30', '2026-05-30'), []);
  });

  it('HTTP hatası → RateProviderError', async () => {
    const provider = new TcmbRateProvider({
      fetchFn: () => Promise.resolve(jsonResponse({}, false)),
    });
    await assert.rejects(provider.fetchRates('2026-05-30', '2026-05-30'), RateProviderError);
  });

  it('fetch exception → RateProviderError', async () => {
    const provider = new TcmbRateProvider({
      fetchFn: () => Promise.reject(new Error('network down')),
    });
    await assert.rejects(provider.fetchRates('2026-05-30', '2026-05-30'), RateProviderError);
  });
});
