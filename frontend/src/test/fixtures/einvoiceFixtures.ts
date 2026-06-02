/**
 * E-Fatura + FX DTO fixture'ları.
 */
import type {
  CredentialDto,
  CurrentRatesDto,
  EInvoiceDto,
  EInvoicesResponse,
  RevaluationDto,
  RevaluationsResponse,
  SyncResult,
} from '../../modules/finance/application/dto/EInvoiceDtos';

export const incomingPending: EInvoiceDto = {
  id: 1,
  companyId: 100,
  provider: 'elogo',
  uuid: '11111111-1111-1111-1111-111111111111',
  invoiceNo: 'GLN2026000001',
  direction: 'incoming',
  invoiceType: 'SATIS',
  scenario: 'TEMELFATURA',
  partyVknTckn: '1234567890',
  partyName: 'Tedarikçi A.Ş.',
  partyAlias: null,
  issueDate: '2026-05-01',
  dueDate: null,
  currency: 'TRY',
  exchangeRate: null,
  subtotal: '1000.00',
  kdvTotal: '200.00',
  tevkifatTotal: '0.00',
  konaklamaVergisi: '0.00',
  ozelTuketimVergisi: '0.00',
  payableAmount: '1200.00',
  gibStatus: 'KABUL_EDILDI',
  importedInvoiceId: null,
  ignored: false,
};

export const outgoingImported: EInvoiceDto = {
  ...incomingPending,
  id: 2,
  uuid: '22222222-2222-2222-2222-222222222222',
  invoiceNo: 'TAS2026000001',
  direction: 'outgoing',
  partyVknTckn: '9876543210',
  partyName: 'Müşteri Ltd.',
  payableAmount: '600.00',
  importedInvoiceId: 42,
};

export const einvoicesFixture: EInvoicesResponse = {
  einvoices: [incomingPending, outgoingImported],
};

export const syncResultFixture: SyncResult = {
  incomingFetched: 1,
  incomingNew: 1,
  outgoingFetched: 1,
  outgoingNew: 0,
  errorsCount: 0,
  status: 'success',
};

export const credentialFixture: CredentialDto = {
  id: 1,
  companyId: 100,
  provider: 'elogo',
  isActive: true,
  autoSyncEnabled: false,
  autoSyncCron: '0 6 * * *',
  lastSyncStatus: null,
  lastSyncAt: null,
};

export const currentRatesFixture: CurrentRatesDto = {
  USD: 32.15,
  EUR: 35.0,
  date: '2026-05-31',
};

export const revaluationFixture: RevaluationDto = {
  id: 1,
  companyId: 100,
  referenceDate: '2026-01-01',
  valuationDate: '2026-06-01',
  usdRate1: 30,
  usdRate2: 32,
  eurRate1: 35,
  eurRate2: 35,
  gainTotal: '2000.00',
  lossTotal: '0.00',
  net: '2000.00',
  details: [
    {
      label: 'USD Kasa',
      currency: 'USD',
      foreignAmount: '1000.00',
      tryValueBefore: '30000.00',
      tryValueAfter: '32000.00',
      delta: '2000.00',
    },
  ],
  posted: false,
  postedAt: null,
};

export const revaluationsFixture: RevaluationsResponse = {
  revaluations: [revaluationFixture],
};
