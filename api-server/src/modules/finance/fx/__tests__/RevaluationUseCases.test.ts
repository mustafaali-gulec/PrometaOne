/**
 * Kur farkı değerleme use-case testleri.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  CreateRevaluationUseCase,
  ListRevaluationsUseCase,
  PostRevaluationUseCase,
} from '../application/useCases/RevaluationUseCases.js';
import { ExchangeRate } from '../domain/entities/ExchangeRate.js';
import { RateNotAvailableError, RevaluationNotFoundError } from '../domain/errors/FxErrors.js';

import {
  FixedClock,
  InMemoryExchangeRateRepository,
  InMemoryRevaluationRepository,
} from './fxFakes.js';

describe('Revaluation use-cases', () => {
  let rates: InMemoryExchangeRateRepository;
  let revals: InMemoryRevaluationRepository;
  let clock: FixedClock;

  beforeEach(async () => {
    rates = new InMemoryExchangeRateRepository();
    revals = new InMemoryRevaluationRepository();
    clock = new FixedClock();
    await rates.upsert(
      ExchangeRate.create({ currency: 'USD', date: '2026-01-01', rate: 30, source: 'TCMB' }),
    );
    await rates.upsert(
      ExchangeRate.create({ currency: 'USD', date: '2026-06-01', rate: 32, source: 'TCMB' }),
    );
    await rates.upsert(
      ExchangeRate.create({ currency: 'EUR', date: '2026-01-01', rate: 35, source: 'TCMB' }),
    );
    await rates.upsert(
      ExchangeRate.create({ currency: 'EUR', date: '2026-06-01', rate: 35, source: 'TCMB' }),
    );
  });

  it('CreateRevaluation: referans+değerleme kurlarıyla gain hesaplar ve kaydeder', async () => {
    const uc = new CreateRevaluationUseCase(revals, rates, clock);
    const r = await uc.execute({
      companyId: 100,
      referenceDate: '2026-01-01',
      valuationDate: '2026-06-01',
      positions: [{ label: 'USD Kasa', currency: 'USD', foreignAmountMajor: 1000 }],
      actorUserId: 7,
    });
    assert.ok(r.id! > 0);
    assert.equal(r.posted, false);
    assert.equal(r.net.toDecimalString(), '2000.00'); // 1000 USD: 30→32

    const list = await new ListRevaluationsUseCase(revals).execute({ companyId: 100 });
    assert.equal(list.length, 1);
  });

  it('CreateRevaluation: kur yoksa RateNotAvailableError', async () => {
    const uc = new CreateRevaluationUseCase(revals, rates, clock);
    await assert.rejects(
      uc.execute({
        companyId: 100,
        referenceDate: '2020-01-01', // kur yok
        valuationDate: '2026-06-01',
        positions: [{ label: 'USD', currency: 'USD', foreignAmountMajor: 100 }],
        actorUserId: null,
      }),
      RateNotAvailableError,
    );
  });

  it('PostRevaluation: posted=true, idempotent', async () => {
    const created = await new CreateRevaluationUseCase(revals, rates, clock).execute({
      companyId: 100,
      referenceDate: '2026-01-01',
      valuationDate: '2026-06-01',
      positions: [{ label: 'USD', currency: 'USD', foreignAmountMajor: 1000 }],
      actorUserId: null,
    });
    const post = new PostRevaluationUseCase(revals, clock);
    const posted = await post.execute({ companyId: 100, revaluationId: created.id! });
    assert.equal(posted.posted, true);

    const again = await post.execute({ companyId: 100, revaluationId: created.id! });
    assert.equal(again.posted, true); // idempotent
  });

  it('PostRevaluation: multi-tenant — başka şirket erişemez', async () => {
    const created = await new CreateRevaluationUseCase(revals, rates, clock).execute({
      companyId: 100,
      referenceDate: '2026-01-01',
      valuationDate: '2026-06-01',
      positions: [{ label: 'USD', currency: 'USD', foreignAmountMajor: 1000 }],
      actorUserId: null,
    });
    await assert.rejects(
      new PostRevaluationUseCase(revals, clock).execute({
        companyId: 200,
        revaluationId: created.id!,
      }),
      RevaluationNotFoundError,
    );
  });
});
