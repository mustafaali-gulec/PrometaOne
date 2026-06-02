/**
 * Döviz kuru use-case testleri.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FetchAndStoreRatesUseCase,
  GetCurrentRatesUseCase,
  GetRateAtUseCase,
} from '../application/useCases/RateUseCases.js';
import { ExchangeRate } from '../domain/entities/ExchangeRate.js';
import { RateNotAvailableError } from '../domain/errors/FxErrors.js';

import { FakeRateProvider, FixedClock, InMemoryExchangeRateRepository } from './fxFakes.js';

describe('FetchAndStoreRatesUseCase', () => {
  it("provider kurlarını repository'ye yazar, latestDate döner", async () => {
    const repo = new InMemoryExchangeRateRepository();
    const provider = new FakeRateProvider([
      { date: '2026-05-30', currency: 'USD', rate: 32.0 },
      { date: '2026-05-30', currency: 'EUR', rate: 35.0 },
      { date: '2026-05-31', currency: 'USD', rate: 32.1 },
    ]);
    const uc = new FetchAndStoreRatesUseCase(provider, repo, new FixedClock());

    const res = await uc.execute();
    assert.equal(res.stored, 3);
    assert.equal(res.latestDate, '2026-05-31');

    const usd = await repo.getCurrent('USD');
    assert.equal(usd!.rate, 32.1); // en güncel
  });
});

describe('GetCurrentRatesUseCase', () => {
  it('USD/EUR ve en güncel tarih döner', async () => {
    const repo = new InMemoryExchangeRateRepository();
    await repo.upsert(
      ExchangeRate.create({ currency: 'USD', date: '2026-05-31', rate: 32.1, source: 'TCMB' }),
    );
    await repo.upsert(
      ExchangeRate.create({ currency: 'EUR', date: '2026-05-30', rate: 35.0, source: 'TCMB' }),
    );

    const dto = await new GetCurrentRatesUseCase(repo).execute();
    assert.equal(dto.USD, 32.1);
    assert.equal(dto.EUR, 35.0);
    assert.equal(dto.date, '2026-05-31');
  });

  it('hiç kur yoksa null döner', async () => {
    const dto = await new GetCurrentRatesUseCase(new InMemoryExchangeRateRepository()).execute();
    assert.equal(dto.USD, null);
    assert.equal(dto.EUR, null);
    assert.equal(dto.date, null);
  });
});

describe('GetRateAtUseCase', () => {
  it('tam tarih yoksa önceki en yakın kuru döner', async () => {
    const repo = new InMemoryExchangeRateRepository();
    await repo.upsert(
      ExchangeRate.create({ currency: 'USD', date: '2026-05-28', rate: 31.5, source: 'TCMB' }),
    );
    await repo.upsert(
      ExchangeRate.create({ currency: 'USD', date: '2026-05-31', rate: 32.1, source: 'TCMB' }),
    );

    const uc = new GetRateAtUseCase(repo);
    assert.equal(await uc.execute({ currency: 'USD', date: '2026-05-30' }), 31.5); // 28'i bulur
    assert.equal(await uc.execute({ currency: 'USD', date: '2026-06-05' }), 32.1);
  });

  it('TRY → 1', async () => {
    const uc = new GetRateAtUseCase(new InMemoryExchangeRateRepository());
    assert.equal(await uc.execute({ currency: 'TRY', date: '2026-05-30' }), 1);
  });

  it('kur yoksa RateNotAvailableError', async () => {
    const uc = new GetRateAtUseCase(new InMemoryExchangeRateRepository());
    await assert.rejects(
      uc.execute({ currency: 'USD', date: '2026-05-30' }),
      RateNotAvailableError,
    );
  });
});
