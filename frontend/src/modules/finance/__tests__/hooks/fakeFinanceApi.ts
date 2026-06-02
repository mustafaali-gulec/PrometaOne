/**
 * Hook testleri için stub FinanceApi factory (fakeHrApi ile aynı desen).
 *
 * Sadece test edilen hook'un çağırdığı metod stub'lanır; gerisi çağrılırsa
 * net bir hata fırlatır.
 */
import { vi, type MockedFunction } from 'vitest';

import type { FinanceApi } from '../../application/ports/FinanceApi';

type FinanceApiMock = {
  [K in keyof FinanceApi]: MockedFunction<FinanceApi[K]>;
};

function stub<K extends keyof FinanceApi>(name: K): MockedFunction<FinanceApi[K]> {
  const fn = vi.fn(() => {
    throw new Error(`fakeFinanceApi.${String(name)}() çağrıldı ama stub edilmedi`);
  });
  return fn as unknown as MockedFunction<FinanceApi[K]>;
}

export function createFakeFinanceApi(): FinanceApiMock {
  return {
    // Budget
    getBudgetMatrix: stub('getBudgetMatrix'),
    listCategories: stub('listCategories'),
    createCategory: stub('createCategory'),
    renameCategory: stub('renameCategory'),
    reorderCategories: stub('reorderCategories'),
    archiveCategory: stub('archiveCategory'),
    setCellValue: stub('setCellValue'),
    bulkSetCells: stub('bulkSetCells'),
    // Cash
    listBankAccounts: stub('listBankAccounts'),
    createBankAccount: stub('createBankAccount'),
    archiveBankAccount: stub('archiveBankAccount'),
    listKasaAccounts: stub('listKasaAccounts'),
    createKasaAccount: stub('createKasaAccount'),
    archiveKasaAccount: stub('archiveKasaAccount'),
    recordKasaEntry: stub('recordKasaEntry'),
    listTransfers: stub('listTransfers'),
    createTransfer: stub('createTransfer'),
    getCashPosition: stub('getCashPosition'),
    // Invoice
    listInvoices: stub('listInvoices'),
    getOverdueInvoices: stub('getOverdueInvoices'),
    createInvoice: stub('createInvoice'),
    recordPayment: stub('recordPayment'),
    deletePayment: stub('deletePayment'),
    // Commit
    commitKasaEntry: stub('commitKasaEntry'),
    commitTransfer: stub('commitTransfer'),
    commitInvoice: stub('commitInvoice'),
  };
}

export type { FinanceApiMock };
