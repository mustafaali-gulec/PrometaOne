/**
 * @vitest-environment node
 *
 * EInvoiceApiClient unit testleri — MSW v2 ile gerçek fetch akışı.
 */
import { describe, expect, it } from 'vitest';

import {
  credentialFixture,
  currentRatesFixture,
  einvoicesFixture,
  revaluationFixture,
  syncResultFixture,
} from '../../../test/fixtures/einvoiceFixtures';
import {
  API_ORIGIN,
  FINANCE_BASE,
  createCapture,
  createRevaluationOk,
  currentRatesOk,
  einvoiceError,
  importEInvoiceOk,
  listEInvoicesOk,
  postRevaluationOk,
  saveCredentialOk,
  syncEInvoicesOk,
} from '../../../test/msw/einvoiceHandlers';
import { server } from '../../../test/msw/server';
import { StaticAuthTokenProvider } from '../application/ports/AuthTokenProvider';
import { EInvoiceApiClient } from '../infrastructure/api/EInvoiceApiClient';

const TOKEN = 'test-token-123';

function makeClient(token: string | null = TOKEN): EInvoiceApiClient {
  return new EInvoiceApiClient(API_ORIGIN, new StaticAuthTokenProvider(token));
}

describe('EInvoiceApiClient — happy path', () => {
  it('GET /einvoice direction + pendingOnly query + auth header', async () => {
    const capture = createCapture();
    server.use(listEInvoicesOk(einvoicesFixture, capture));

    const res = await makeClient().listEInvoices(100, { direction: 'incoming', pendingOnly: true });

    expect(res).toEqual(einvoicesFixture);
    const call = capture.calls[0]!;
    expect(call.authHeader).toBe(`Bearer ${TOKEN}`);
    expect(call.searchParams).toEqual({
      companyId: '100',
      direction: 'incoming',
      pendingOnly: 'true',
    });
  });

  it('POST /einvoice/sync body gönderir', async () => {
    const capture = createCapture();
    server.use(syncEInvoicesOk(syncResultFixture, capture));

    const res = await makeClient().syncEInvoices({
      companyId: 100,
      provider: 'elogo',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
    });

    expect(res).toEqual(syncResultFixture);
    expect(capture.calls[0]!.body).toEqual({
      companyId: 100,
      provider: 'elogo',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
    });
  });

  it('POST /einvoice/:id/import path + body', async () => {
    const capture = createCapture();
    server.use(importEInvoiceOk({ einvoiceId: 1, invoiceId: 42 }, capture));

    const res = await makeClient().importEInvoice(1, { companyId: 100, cashflowCatId: 5 });

    expect(res).toEqual({ einvoiceId: 1, invoiceId: 42 });
    expect(capture.calls[0]!.url).toBe(`${FINANCE_BASE}/einvoice/1/import`);
    expect(capture.calls[0]!.body).toEqual({ companyId: 100, cashflowCatId: 5 });
  });

  it('PUT /einvoice/credentials kaydeder', async () => {
    const capture = createCapture();
    server.use(saveCredentialOk(credentialFixture, capture));

    const res = await makeClient().saveCredential({
      companyId: 100,
      provider: 'elogo',
      config: { username: 'u', password: 'p', vergiNo: '1234567890', env: 'test' },
    });

    expect(res.provider).toBe('elogo');
    expect(capture.calls[0]!.method).toBe('PUT');
  });

  it('GET /fx/rates güncel kurları döner', async () => {
    server.use(currentRatesOk(currentRatesFixture));
    const res = await makeClient().getCurrentRates();
    expect(res).toEqual(currentRatesFixture);
  });

  it('POST /fx/revaluations create + /:id/post', async () => {
    server.use(createRevaluationOk(revaluationFixture));
    const created = await makeClient().createRevaluation({
      companyId: 100,
      referenceDate: '2026-01-01',
      valuationDate: '2026-06-01',
      positions: [{ label: 'USD', currency: 'USD', foreignAmountMajor: 1000 }],
    });
    expect(created.net).toBe('2000.00');

    server.use(postRevaluationOk({ ...revaluationFixture, posted: true }));
    const posted = await makeClient().postRevaluation(1, 100);
    expect(posted.posted).toBe(true);
  });
});

describe('EInvoiceApiClient — error path', () => {
  it('502 provider hatası body.message ile Error fırlatır', async () => {
    server.use(einvoiceError('post', '/einvoice/sync', 502, 'Entegratör erişilemiyor'));
    await expect(
      makeClient().syncEInvoices({
        companyId: 100,
        provider: 'elogo',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
      }),
    ).rejects.toThrow('Entegratör erişilemiyor');
  });

  it('token yoksa fetch yapılmadan hata', async () => {
    await expect(makeClient(null).getCurrentRates()).rejects.toThrow(/Auth token yok/);
  });
});
