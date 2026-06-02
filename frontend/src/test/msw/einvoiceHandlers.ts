/**
 * E-Fatura + FX endpoint handler factory'leri (MSW v2). createCapture hrHandlers'tan.
 */
import { http, HttpResponse, type HttpHandler, type JsonBodyType } from 'msw';

import type { createCapture } from './hrHandlers';
import { API_ORIGIN } from './hrHandlers';

export { API_ORIGIN, createCapture } from './hrHandlers';
export const FINANCE_BASE = `${API_ORIGIN}/v1/finance`;

type Method = 'get' | 'post' | 'put' | 'delete';
type Capture = ReturnType<typeof createCapture>;

async function captureRequest(request: Request, capture: Capture): Promise<void> {
  let body: unknown;
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

function ok<T extends JsonBodyType>(method: Method, pathSuffix: string) {
  return (data: T, capture?: Capture): HttpHandler =>
    http[method](`${FINANCE_BASE}${pathSuffix}`, async ({ request }) => {
      if (capture !== undefined) await captureRequest(request, capture);
      return HttpResponse.json(data);
    });
}

export function einvoiceError(
  method: Method,
  pathSuffix: string,
  status: number,
  message?: string,
): HttpHandler {
  return http[method](`${FINANCE_BASE}${pathSuffix}`, () =>
    message === undefined
      ? new HttpResponse(null, { status })
      : HttpResponse.json({ message }, { status }),
  );
}

// E-Fatura
export const listEInvoicesOk = ok('get', '/einvoice');
export const syncEInvoicesOk = ok('post', '/einvoice/sync');
export const importEInvoiceOk = ok('post', '/einvoice/:id/import');
export const ignoreEInvoiceOk = ok('post', '/einvoice/:id/ignore');
export const saveCredentialOk = ok('put', '/einvoice/credentials');
export const testConnectionOk = ok('post', '/einvoice/credentials/test');
export const unmappedPartiesOk = ok('get', '/einvoice/parties/unmapped');

// FX
export const currentRatesOk = ok('get', '/fx/rates');
export const fetchRatesOk = ok('post', '/fx/rates/fetch');
export const listRevaluationsOk = ok('get', '/fx/revaluations');
export const createRevaluationOk = ok('post', '/fx/revaluations');
export const postRevaluationOk = ok('post', '/fx/revaluations/:id/post');
