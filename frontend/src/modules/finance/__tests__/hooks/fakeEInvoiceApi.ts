/**
 * Hook testleri için stub EInvoiceApi factory (fakeFinanceApi deseni).
 */
import { vi, type MockedFunction } from 'vitest';

import type { EInvoiceApi } from '../../application/ports/EInvoiceApi';

type EInvoiceApiMock = {
  [K in keyof EInvoiceApi]: MockedFunction<EInvoiceApi[K]>;
};

function stub<K extends keyof EInvoiceApi>(name: K): MockedFunction<EInvoiceApi[K]> {
  const fn = vi.fn(() => {
    throw new Error(`fakeEInvoiceApi.${String(name)}() çağrıldı ama stub edilmedi`);
  });
  return fn as unknown as MockedFunction<EInvoiceApi[K]>;
}

export function createFakeEInvoiceApi(): EInvoiceApiMock {
  return {
    listEInvoices: stub('listEInvoices'),
    syncEInvoices: stub('syncEInvoices'),
    importEInvoice: stub('importEInvoice'),
    ignoreEInvoice: stub('ignoreEInvoice'),
    saveCredential: stub('saveCredential'),
    testConnection: stub('testConnection'),
    deleteCredential: stub('deleteCredential'),
    listUnmappedParties: stub('listUnmappedParties'),
    mapParty: stub('mapParty'),
    getCurrentRates: stub('getCurrentRates'),
    fetchRates: stub('fetchRates'),
    getRateAt: stub('getRateAt'),
    listRevaluations: stub('listRevaluations'),
    createRevaluation: stub('createRevaluation'),
    postRevaluation: stub('postRevaluation'),
  };
}

export type { EInvoiceApiMock };
