/**
 * Hazır Finance DTO fixture'ları — testlerin ortak veri kümesi.
 * Para alanları decimal string (backend Money serializasyonu ile birebir).
 */
import type {
  BankAccountsResponse,
  BudgetMatrixDto,
  CashPositionDto,
  CategoriesResponse,
  CategoryDto,
  InvoiceDto,
  InvoicePaymentDto,
  InvoicesResponse,
  KasaAccountsResponse,
  KasaEntryDto,
  RecordPaymentResult,
  TransfersResponse,
} from '../../modules/finance/application/dto/FinanceDtos';

const ISO = '2026-01-01T00:00:00.000Z';
const zeros12 = (): string[] => Array.from({ length: 12 }, () => '0.00');

export const categoryFixture: CategoryDto = {
  id: 1,
  companyId: 100,
  section: 'inflows',
  name: 'Satış',
  sortOrder: 0,
  active: true,
  createdAt: ISO,
  updatedAt: ISO,
};

export const categoriesFixture: CategoriesResponse = {
  categories: [categoryFixture, { ...categoryFixture, id: 2, section: 'outflows', name: 'Kira' }],
};

export const budgetMatrixFixture: BudgetMatrixDto = {
  currency: 'TRY',
  fiscalYear: 2026,
  sections: [
    {
      section: 'inflows',
      rows: [
        {
          categoryId: 1,
          name: 'Satış',
          months: ['10000.00', '12000.00', ...Array.from({ length: 10 }, () => '0.00')],
          rowTotal: '22000.00',
        },
      ],
      monthlyTotals: ['10000.00', '12000.00', ...Array.from({ length: 10 }, () => '0.00')],
      sectionTotal: '22000.00',
    },
    {
      section: 'outflows',
      rows: [
        {
          categoryId: 2,
          name: 'Kira',
          months: ['3000.00', ...Array.from({ length: 11 }, () => '0.00')],
          rowTotal: '3000.00',
        },
      ],
      monthlyTotals: ['3000.00', ...Array.from({ length: 11 }, () => '0.00')],
      sectionTotal: '3000.00',
    },
    { section: 'nonPnlOutflows', rows: [], monthlyTotals: zeros12(), sectionTotal: '0.00' },
    { section: 'kasaCategories', rows: [], monthlyTotals: zeros12(), sectionTotal: '0.00' },
  ],
  pnlNetMonthly: ['7000.00', '12000.00', ...Array.from({ length: 10 }, () => '0.00')],
  pnlNetTotal: '19000.00',
};

export const bankAccountsFixture: BankAccountsResponse = {
  accounts: [
    {
      id: 1,
      companyId: 100,
      bankId: 1,
      name: 'İş Bankası TL',
      iban: 'TR000000000000000000000001',
      accountNo: '123-456',
      currency: 'TRY',
      openingBalance: '5000.00',
      cashflowCatId: null,
      active: true,
    },
  ],
};

export const kasaAccountsFixture: KasaAccountsResponse = {
  accounts: [
    {
      id: 1,
      companyId: 100,
      name: 'Ana Kasa',
      currency: 'TRY',
      openingBalance: '1000.00',
      active: true,
    },
  ],
};

export const kasaEntryFixture: KasaEntryDto = {
  id: 1,
  kasaAccountId: 1,
  date: '2026-03-15',
  type: 'in',
  amount: '1500.00',
  description: 'Nakit tahsilat',
  category: null,
  cashflowCatId: 1,
  committedToCells: false,
};

export const transfersFixture: TransfersResponse = {
  transfers: [
    {
      id: 1,
      companyId: 100,
      date: '2026-02-01',
      fromType: 'bank',
      fromId: 1,
      toType: 'kasa',
      toId: 1,
      fromAmount: '2000.00',
      toAmount: '2000.00',
      description: 'Kasa beslemesi',
      committedToCells: false,
    },
  ],
};

export const cashPositionFixture: CashPositionDto = {
  endpointType: 'kasa',
  accountId: 1,
  name: 'Ana Kasa',
  currency: 'TRY',
  openingBalance: '1000.00',
  currentBalance: '4500.00',
};

export const invoiceFixture: InvoiceDto = {
  id: 1,
  companyId: 100,
  type: 'in',
  invoiceNo: 'FT-2026-001',
  counterparty: 'Acme Ltd.',
  issueDate: '2026-01-10',
  dueDate: '2026-02-10',
  currency: 'TRY',
  subtotal: '1000.00',
  kdvRate: 0.2,
  kdv: '200.00',
  total: '1200.00',
  paidAmount: '500.00',
  remaining: '700.00',
  status: 'partial',
  cashflowCatId: 1,
  committedToCells: false,
  note: null,
};

export const invoicesFixture: InvoicesResponse = {
  invoices: [
    invoiceFixture,
    {
      ...invoiceFixture,
      id: 2,
      invoiceNo: 'FT-2026-002',
      counterparty: 'Beta A.Ş.',
      type: 'out',
      dueDate: '2020-01-01',
      paidAmount: '0.00',
      remaining: '1200.00',
      status: 'overdue',
    },
  ],
};

export const invoicePaymentFixture: InvoicePaymentDto = {
  id: 10,
  invoiceId: 1,
  amount: '500.00',
  date: '2026-01-20',
  currency: 'TRY',
  bankAccountId: 1,
  kasaAccountId: null,
  note: null,
};

export const recordPaymentResultFixture: RecordPaymentResult = {
  invoice: { ...invoiceFixture, paidAmount: '500.00', remaining: '700.00', status: 'partial' },
  payment: invoicePaymentFixture,
};
