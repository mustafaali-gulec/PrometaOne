/**
 * Finance endpoint handler factory'leri (MSW v2).
 *
 * HR handler'larındaki `createCapture` helper'ı yeniden kullanılır; capture
 * mantığı (request gövde/header/searchParams yakalama) burada lokal tanımlı.
 * Test base URL'i `FINANCE_BASE` constant'ından gelir.
 */
import { http, HttpResponse, type HttpHandler, type JsonBodyType } from 'msw';

import type {
  BankAccountDto,
  BankAccountsResponse,
  BudgetMatrixDto,
  CashPositionDto,
  CategoriesResponse,
  CategoryDto,
  InvoiceDto,
  InvoicesResponse,
  KasaAccountsResponse,
  KasaEntryDto,
  OkResponse,
  RecordPaymentResult,
  TransfersResponse,
} from '../../modules/finance/application/dto/FinanceDtos';

import type { createCapture } from './hrHandlers';
import { API_ORIGIN } from './hrHandlers';

export { API_ORIGIN, createCapture } from './hrHandlers';
export const FINANCE_BASE = `${API_ORIGIN}/v1/finance`;

type Method = 'get' | 'post' | 'patch' | 'delete';
type Capture = ReturnType<typeof createCapture>;

interface ErrorOptions {
  status: number;
  message?: string;
}

export function financeError(
  method: Method,
  pathSuffix: string,
  options: ErrorOptions,
): HttpHandler {
  const url = `${FINANCE_BASE}${pathSuffix}`;
  return http[method](url, () => {
    if (options.message === undefined) {
      return new HttpResponse(null, { status: options.status });
    }
    return HttpResponse.json({ message: options.message }, { status: options.status });
  });
}

async function captureRequest(request: Request, capture: Capture): Promise<void> {
  let body: unknown = undefined;
  const ct = request.headers.get('content-type');
  if (ct !== null && ct.includes('application/json')) {
    try {
      body = await request.clone().json();
    } catch {
      body = null;
    }
  }
  const url = new URL(request.url);
  const searchParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    searchParams[k] = v;
  });
  capture.push({
    url: request.url,
    method: request.method,
    authHeader: request.headers.get('authorization'),
    contentType: ct,
    body,
    searchParams,
  });
}

/** Generic JSON-Ok handler factory (capture opsiyonel). */
function ok<T extends JsonBodyType>(method: Method, pathSuffix: string) {
  return (data: T, capture?: Capture): HttpHandler =>
    http[method](`${FINANCE_BASE}${pathSuffix}`, async ({ request }) => {
      if (capture !== undefined) await captureRequest(request, capture);
      return HttpResponse.json(data);
    });
}

// --- Budget ---------------------------------------------------------------
export const budgetMatrixOk = ok<BudgetMatrixDto>('get', '/budget/matrix');
export const listCategoriesOk = ok<CategoriesResponse>('get', '/categories');
export const createCategoryOk = ok<CategoryDto>('post', '/categories');
export const renameCategoryOk = ok<CategoryDto>('patch', '/categories/:id');
export const reorderCategoriesOk = ok<OkResponse>('post', '/categories/reorder');
export const archiveCategoryOk = ok<CategoryDto>('delete', '/categories/:id');
export const setCellOk = ok<OkResponse>('post', '/cells');
export const bulkSetCellsOk = ok<OkResponse>('post', '/cells/bulk');

// --- Cash -----------------------------------------------------------------
export const listBankAccountsOk = ok<BankAccountsResponse>('get', '/bank-accounts');
export const createBankAccountOk = ok<BankAccountDto>('post', '/bank-accounts');
export const listKasaAccountsOk = ok<KasaAccountsResponse>('get', '/kasa-accounts');
export const recordKasaEntryOk = ok<KasaEntryDto>('post', '/kasa-entries');
export const listTransfersOk = ok<TransfersResponse>('get', '/transfers');
export const cashPositionOk = ok<CashPositionDto>('get', '/cash-position/:type/:id');

// --- Invoice --------------------------------------------------------------
export const listInvoicesOk = ok<InvoicesResponse>('get', '/invoices');
export const overdueInvoicesOk = ok<InvoicesResponse>('get', '/invoices/overdue');
export const createInvoiceOk = ok<InvoiceDto>('post', '/invoices');
export const recordPaymentOk = ok<RecordPaymentResult>('post', '/invoices/:id/payments');
export const deletePaymentOk = ok<InvoiceDto>('delete', '/payments/:id');

// --- Commit ---------------------------------------------------------------
export const commitKasaEntryOk = ok<OkResponse>('post', '/kasa-entries/:id/commit');
export const commitTransferOk = ok<OkResponse>('post', '/transfers/:id/commit');
export const commitInvoiceOk = ok<OkResponse>('post', '/invoices/:id/commit');
