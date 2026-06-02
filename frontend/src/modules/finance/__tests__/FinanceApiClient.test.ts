/**
 * @vitest-environment node
 *
 * FinanceApiClient unit testleri — MSW v2 ile gerçek fetch akışı.
 *
 * `@vitest-environment node`: client'in DOM'a ihtiyacı yok (sadece fetch);
 * happy-dom fetch'i MSW v2 ile "ReadableStream is locked" tetikliyor. Node
 * native fetch (undici) MSW v2'nin resmi runtime'ı.
 */
import { describe, expect, it } from 'vitest';

import {
  budgetMatrixFixture,
  cashPositionFixture,
  categoriesFixture,
  categoryFixture,
  invoicesFixture,
  recordPaymentResultFixture,
} from '../../../test/fixtures/financeFixtures';
import {
  API_ORIGIN,
  FINANCE_BASE,
  archiveCategoryOk,
  budgetMatrixOk,
  cashPositionOk,
  commitInvoiceOk,
  createCapture,
  createCategoryOk,
  financeError,
  listCategoriesOk,
  listInvoicesOk,
  recordPaymentOk,
  renameCategoryOk,
} from '../../../test/msw/financeHandlers';
import { server } from '../../../test/msw/server';
import { StaticAuthTokenProvider } from '../application/ports/AuthTokenProvider';
import { FinanceApiClient } from '../infrastructure/api/FinanceApiClient';

const TOKEN = 'test-token-123';

function makeClient(token: string | null = TOKEN): FinanceApiClient {
  return new FinanceApiClient(API_ORIGIN, new StaticAuthTokenProvider(token));
}

describe('FinanceApiClient — happy path', () => {
  it('GET /budget/matrix doğru URL + auth header', async () => {
    const capture = createCapture();
    server.use(budgetMatrixOk(budgetMatrixFixture, capture));

    const result = await makeClient().getBudgetMatrix(100, 2026);

    expect(result).toEqual(budgetMatrixFixture);
    const call = capture.calls[0]!;
    expect(call.method).toBe('GET');
    expect(call.authHeader).toBe(`Bearer ${TOKEN}`);
    expect(call.searchParams).toEqual({ companyId: '100', fiscalYear: '2026' });
  });

  it('GET /budget/matrix currency query parametresini ekler', async () => {
    const capture = createCapture();
    server.use(budgetMatrixOk(budgetMatrixFixture, capture));

    await makeClient().getBudgetMatrix(100, 2026, 'EUR');

    expect(capture.calls[0]!.searchParams).toEqual({
      companyId: '100',
      fiscalYear: '2026',
      currency: 'EUR',
    });
  });

  it('GET /categories section filtresini ekler', async () => {
    const capture = createCapture();
    server.use(listCategoriesOk(categoriesFixture, capture));

    const result = await makeClient().listCategories(100, 'inflows');

    expect(result).toEqual(categoriesFixture);
    expect(capture.calls[0]!.searchParams).toEqual({ companyId: '100', section: 'inflows' });
  });

  it('POST /categories body gönderir, 201 döner', async () => {
    const capture = createCapture();
    server.use(createCategoryOk(categoryFixture, capture));

    const result = await makeClient().createCategory({
      companyId: 100,
      section: 'inflows',
      name: 'Satış',
    });

    expect(result).toEqual(categoryFixture);
    const call = capture.calls[0]!;
    expect(call.method).toBe('POST');
    expect(call.contentType).toContain('application/json');
    expect(call.body).toEqual({ companyId: 100, section: 'inflows', name: 'Satış' });
  });

  it('PATCH /categories/:id rename body gönderir', async () => {
    const capture = createCapture();
    server.use(renameCategoryOk({ ...categoryFixture, name: 'Yeni' }, capture));

    const result = await makeClient().renameCategory(1, { companyId: 100, name: 'Yeni' });

    expect(result.name).toBe('Yeni');
    const call = capture.calls[0]!;
    expect(call.method).toBe('PATCH');
    expect(call.url).toBe(`${FINANCE_BASE}/categories/1`);
    expect(call.body).toEqual({ companyId: 100, name: 'Yeni' });
  });

  it('DELETE /categories/:id companyId query ile arşivler', async () => {
    const capture = createCapture();
    server.use(archiveCategoryOk({ ...categoryFixture, active: false }, capture));

    const result = await makeClient().archiveCategory(1, 100);

    expect(result.active).toBe(false);
    const call = capture.calls[0]!;
    expect(call.method).toBe('DELETE');
    expect(call.searchParams).toEqual({ companyId: '100' });
  });

  it('GET /cash-position/:type/:id path segment + query doğru', async () => {
    const capture = createCapture();
    server.use(cashPositionOk(cashPositionFixture, capture));

    const result = await makeClient().getCashPosition(100, 'kasa', 1);

    expect(result).toEqual(cashPositionFixture);
    const call = capture.calls[0]!;
    expect(call.url).toBe(`${FINANCE_BASE}/cash-position/kasa/1?companyId=100`);
  });

  it('GET /invoices type + openOnly query forward eder', async () => {
    const capture = createCapture();
    server.use(listInvoicesOk(invoicesFixture, capture));

    const result = await makeClient().listInvoices(100, { type: 'in', openOnly: true });

    expect(result).toEqual(invoicesFixture);
    expect(capture.calls[0]!.searchParams).toEqual({
      companyId: '100',
      type: 'in',
      openOnly: 'true',
    });
  });

  it('POST /invoices/:id/payments invoiceId path + body gönderir', async () => {
    const capture = createCapture();
    server.use(recordPaymentOk(recordPaymentResultFixture, capture));

    const result = await makeClient().recordPayment(1, {
      companyId: 100,
      amount: 500,
      date: '2026-01-20',
      bankAccountId: 1,
    });

    expect(result).toEqual(recordPaymentResultFixture);
    const call = capture.calls[0]!;
    expect(call.url).toBe(`${FINANCE_BASE}/invoices/1/payments`);
    expect(call.body).toEqual({
      companyId: 100,
      amount: 500,
      date: '2026-01-20',
      bankAccountId: 1,
    });
  });

  it('POST /invoices/:id/commit companyId body gönderir', async () => {
    const capture = createCapture();
    server.use(commitInvoiceOk({ ok: true }, capture));

    const result = await makeClient().commitInvoice(1, 100);

    expect(result).toEqual({ ok: true });
    expect(capture.calls[0]!.body).toEqual({ companyId: 100 });
  });
});

describe('FinanceApiClient — error path', () => {
  it('403 yanıt body.message ile Error fırlatır', async () => {
    server.use(financeError('get', '/budget/matrix', { status: 403, message: 'cfo rolü gerekli' }));
    await expect(makeClient().getBudgetMatrix(100, 2026)).rejects.toThrow('cfo rolü gerekli');
  });

  it('404 mesajsız yanıtta HTTP status fallback mesajı', async () => {
    server.use(financeError('delete', '/categories/:id', { status: 404 }));
    await expect(makeClient().archiveCategory(99, 100)).rejects.toThrow('HTTP 404');
  });

  it('token yoksa fetch yapılmadan hata fırlatır', async () => {
    await expect(makeClient(null).getBudgetMatrix(100, 2026)).rejects.toThrow(/Auth token yok/);
  });
});
