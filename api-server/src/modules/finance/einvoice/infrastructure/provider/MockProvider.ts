/**
 * MockProvider — gerçek ağ olmadan EInvoiceProvider implementasyonu.
 *
 * Test ve demo için: sabit (seed) fatura özetleri + UBL XML'leri döner.
 * Sync/import akışı uçtan uca (provider → parse → cache) gerçek ağ olmadan
 * test edilebilir. `demo()` factory'si örnek veri üretir.
 */
import type {
  EInvoiceProvider,
  FetchInvoiceListParams,
  ProviderInvoiceSummary,
  ProviderTestResult,
} from '../../application/ports/EInvoiceProvider.js';
import type { CredentialConfig } from '../../domain/entities/EInvoiceCredential.js';
import { ProviderInvoiceNotFoundError } from '../../domain/errors/EInvoiceErrors.js';
import type { InvoiceDirection } from '../../domain/valueObjects/InvoiceDirection.js';

export interface MockInvoiceSeed {
  summary: ProviderInvoiceSummary;
  xml: string;
}

export class MockProvider implements EInvoiceProvider {
  readonly name = 'mock';

  constructor(
    private readonly seeds: ReadonlyArray<MockInvoiceSeed> = [],
    private readonly connectionOk = true,
  ) {}

  testConnection(_config: CredentialConfig): Promise<ProviderTestResult> {
    return Promise.resolve(
      this.connectionOk
        ? { ok: true, message: 'Mock bağlantı başarılı' }
        : { ok: false, message: 'Mock bağlantı reddedildi' },
    );
  }

  fetchInvoiceList(
    _config: CredentialConfig,
    params: FetchInvoiceListParams,
  ): Promise<ProviderInvoiceSummary[]> {
    const list = this.seeds
      .map((s) => s.summary)
      .filter((s) => params.direction === 'both' || s.direction === params.direction)
      .filter((s) => s.issueDate >= params.dateFrom && s.issueDate <= params.dateTo);
    return Promise.resolve(list);
  }

  fetchInvoiceXml(
    _config: CredentialConfig,
    uuid: string,
    direction: InvoiceDirection,
  ): Promise<string> {
    const found = this.seeds.find(
      (s) => s.summary.uuid === uuid && s.summary.direction === direction,
    );
    if (!found) {
      return Promise.reject(new ProviderInvoiceNotFoundError(uuid));
    }
    return Promise.resolve(found.xml);
  }

  /** Örnek demo verisi — bir gelen + bir giden fatura. */
  static demo(): MockProvider {
    const incomingXml = buildUbl({
      uuid: '11111111-1111-1111-1111-111111111111',
      id: 'GLN2026000001',
      issueDate: '2026-05-01',
      currency: 'TRY',
      supplierVkn: '1234567890',
      supplierName: 'Tedarikçi A.Ş.',
      lineExtension: '1000.00',
      kdv: '200.00',
      payable: '1200.00',
    });
    const outgoingXml = buildUbl({
      uuid: '22222222-2222-2222-2222-222222222222',
      id: 'TAS2026000001',
      issueDate: '2026-05-02',
      currency: 'TRY',
      customerVkn: '9876543210',
      customerName: 'Müşteri Ltd.',
      lineExtension: '500.00',
      kdv: '100.00',
      payable: '600.00',
    });
    return new MockProvider([
      {
        summary: {
          uuid: '11111111-1111-1111-1111-111111111111',
          invoiceNo: 'GLN2026000001',
          direction: 'incoming',
          invoiceType: 'SATIS',
          scenario: 'TEMELFATURA',
          issueDate: '2026-05-01',
          dueDate: null,
          partyVknTckn: '1234567890',
          partyName: 'Tedarikçi A.Ş.',
          currency: 'TRY',
          payableAmount: '1200.00',
          gibStatus: 'KABUL_EDILDI',
        },
        xml: incomingXml,
      },
      {
        summary: {
          uuid: '22222222-2222-2222-2222-222222222222',
          invoiceNo: 'TAS2026000001',
          direction: 'outgoing',
          invoiceType: 'SATIS',
          scenario: 'TEMELFATURA',
          issueDate: '2026-05-02',
          dueDate: null,
          partyVknTckn: '9876543210',
          partyName: 'Müşteri Ltd.',
          currency: 'TRY',
          payableAmount: '600.00',
          gibStatus: 'KABUL_EDILDI',
        },
        xml: outgoingXml,
      },
    ]);
  }
}

interface UblSeedParams {
  uuid: string;
  id: string;
  issueDate: string;
  currency: string;
  supplierVkn?: string;
  supplierName?: string;
  customerVkn?: string;
  customerName?: string;
  lineExtension: string;
  kdv: string;
  payable: string;
}

/** Minimal ama parser'ın okuyabileceği bir UBL-TR fatura XML'i üretir. */
function buildUbl(p: UblSeedParams): string {
  const supplier =
    p.supplierVkn !== undefined
      ? `<cac:AccountingSupplierParty><cac:Party>
           <cac:PartyIdentification><cbc:ID schemeID="VKN">${p.supplierVkn}</cbc:ID></cac:PartyIdentification>
           <cac:PartyName><cbc:Name>${p.supplierName ?? ''}</cbc:Name></cac:PartyName>
         </cac:Party></cac:AccountingSupplierParty>`
      : '';
  const customer =
    p.customerVkn !== undefined
      ? `<cac:AccountingCustomerParty><cac:Party>
           <cac:PartyIdentification><cbc:ID schemeID="VKN">${p.customerVkn}</cbc:ID></cac:PartyIdentification>
           <cac:PartyName><cbc:Name>${p.customerName ?? ''}</cbc:Name></cac:PartyName>
         </cac:Party></cac:AccountingCustomerParty>`
      : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
  <cbc:UUID>${p.uuid}</cbc:UUID>
  <cbc:ID>${p.id}</cbc:ID>
  <cbc:IssueDate>${p.issueDate}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cbc:ProfileID>TEMELFATURA</cbc:ProfileID>
  <cbc:DocumentCurrencyCode>${p.currency}</cbc:DocumentCurrencyCode>
  ${supplier}
  ${customer}
  <cac:TaxTotal>
    <cac:TaxSubtotal>
      <cbc:TaxAmount currencyID="${p.currency}">${p.kdv}</cbc:TaxAmount>
      <cbc:Percent>20</cbc:Percent>
      <cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${p.currency}">${p.lineExtension}</cbc:LineExtensionAmount>
    <cbc:PayableAmount currencyID="${p.currency}">${p.payable}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
}
