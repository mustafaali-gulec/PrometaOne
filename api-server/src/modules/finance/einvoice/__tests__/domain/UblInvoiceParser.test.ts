/**
 * UblInvoiceParser testleri — gerçek UBL-TR 2.1 yapısına yakın XML fixture'ları.
 *
 * Senaryolar: SATIS (TRY, %20 KDV, çok kalemli), TEVKIFAT, döviz (USD + kur),
 * e-Arşiv (Person party), geçersiz XML.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EInvoice } from '../../domain/entities/EInvoice.js';
import { UblParseError } from '../../domain/errors/EInvoiceErrors.js';
import { UblInvoiceParser } from '../../domain/services/UblInvoiceParser.js';

// --- Fixtures --------------------------------------------------------------

/** Giden SATIS faturası, TRY, 2 kalem, %20 KDV. subtotal 1000, kdv 200, payable 1200. */
const SATIS_TRY = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
  <cbc:UUID>a1b2c3d4-e5f6-7890-abcd-ef1234567890</cbc:UUID>
  <cbc:ID>FT2026000001</cbc:ID>
  <cbc:IssueDate>2026-05-12</cbc:IssueDate>
  <cbc:DueDate>2026-06-12</cbc:DueDate>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cbc:ProfileID>TICARIFATURA</cbc:ProfileID>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>Satıcı A.Ş.</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="VKN">9876543210</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>Alıcı Ltd.</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="TRY">200.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxAmount currencyID="TRY">200.00</cbc:TaxAmount>
      <cbc:Percent>20</cbc:Percent>
      <cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TRY">1000.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="TRY">1000.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="TRY">1200.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="TRY">1200.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">2</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">600.00</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cac:TaxSubtotal>
        <cbc:TaxAmount currencyID="TRY">120.00</cbc:TaxAmount>
        <cbc:Percent>20</cbc:Percent>
        <cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item><cbc:Name>Ürün A</cbc:Name><cbc:Description>Açıklama A</cbc:Description></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="TRY">300.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
  <cac:InvoiceLine>
    <cbc:ID>2</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">400.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Ürün B</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="TRY">400.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

/** Gelen TEVKIFAT faturası — KDV + tevkifat subtotal'leri. */
const TEVKIFAT = `<?xml version="1.0"?>
<Invoice xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
  <cbc:UUID>11111111-2222-3333-4444-555555555555</cbc:UUID>
  <cbc:ID>TEV2026</cbc:ID>
  <cbc:IssueDate>2026-04-01</cbc:IssueDate>
  <cbc:InvoiceTypeCode>TEVKIFAT</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>Hizmet Sağlayıcı</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:TaxTotal>
    <cac:TaxSubtotal>
      <cbc:TaxAmount currencyID="TRY">180.00</cbc:TaxAmount>
      <cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:TaxTotal>
    <cac:TaxSubtotal>
      <cbc:TaxAmount currencyID="TRY">90.00</cbc:TaxAmount>
      <cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>9015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TRY">1000.00</cbc:LineExtensionAmount>
    <cbc:PayableAmount currencyID="TRY">1090.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

/** Döviz faturası — USD + kur. */
const USD_INVOICE = `<?xml version="1.0"?>
<Invoice xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
  <cbc:UUID>aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee</cbc:UUID>
  <cbc:ID>USD-1</cbc:ID>
  <cbc:IssueDate>2026-03-10</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>USD</cbc:DocumentCurrencyCode>
  <cac:PricingExchangeRate><cbc:CalculationRate>32.1500</cbc:CalculationRate></cac:PricingExchangeRate>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="VKN">9876543210</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>Foreign Buyer</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="USD">500.00</cbc:LineExtensionAmount>
    <cbc:PayableAmount currencyID="USD">500.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

/** e-Arşiv — Person party (PartyName yok), TCKN. */
const EARSIV_PERSON = `<?xml version="1.0"?>
<Invoice xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
  <cbc:UUID>99999999-8888-7777-6666-555555555555</cbc:UUID>
  <cbc:ID>EA-1</cbc:ID>
  <cbc:IssueDate>2026-02-20</cbc:IssueDate>
  <cbc:ProfileID>EARSIVFATURA</cbc:ProfileID>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="TCKN">10000000146</cbc:ID></cac:PartyIdentification>
      <cac:Person><cbc:FirstName>Ahmet</cbc:FirstName><cbc:FamilyName>Yılmaz</cbc:FamilyName></cac:Person>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="TRY">250.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

describe('UblInvoiceParser', () => {
  it('SATIS (TRY): temel alanlar + KDV + 2 kalem doğru parse edilir', () => {
    const p = UblInvoiceParser.parse(SATIS_TRY, 'outgoing');
    assert.equal(p.uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    assert.equal(p.invoiceNo, 'FT2026000001');
    assert.equal(p.issueDate, '2026-05-12');
    assert.equal(p.dueDate, '2026-06-12');
    assert.equal(p.invoiceType, 'SATIS');
    assert.equal(p.scenario, 'TICARIFATURA');
    assert.equal(p.currency, 'TRY');
    assert.equal(p.subtotal.toDecimalString(), '1000.00');
    assert.equal(p.kdvTotal.toDecimalString(), '200.00');
    assert.equal(p.tevkifatTotal.toDecimalString(), '0.00');
    assert.equal(p.payableAmount.toDecimalString(), '1200.00');
    assert.equal(p.lines.length, 2);
    assert.equal(p.lines[0]!.name, 'Ürün A');
    assert.equal(p.lines[0]!.quantity, 2);
    assert.equal(p.lines[0]!.unit, 'C62');
    assert.equal(p.lines[0]!.lineTotal.toDecimalString(), '600.00');
    assert.equal(p.lines[0]!.kdvRatePercent, 20);
    assert.equal(p.lines[0]!.kdvAmount.toDecimalString(), '120.00');
  });

  it('outgoing → karşı taraf ALICI (customer) seçilir', () => {
    const p = UblInvoiceParser.parse(SATIS_TRY, 'outgoing');
    assert.equal(p.party.vknTckn, '9876543210');
    assert.equal(p.party.name, 'Alıcı Ltd.');
  });

  it('incoming → karşı taraf SATICI (supplier) seçilir', () => {
    const p = UblInvoiceParser.parse(SATIS_TRY, 'incoming');
    assert.equal(p.party.vknTckn, '1234567890');
    assert.equal(p.party.name, 'Satıcı A.Ş.');
  });

  it('TEVKIFAT: KDV ve tevkifat ayrı toplanır', () => {
    const p = UblInvoiceParser.parse(TEVKIFAT, 'incoming');
    assert.equal(p.invoiceType, 'TEVKIFAT');
    assert.equal(p.kdvTotal.toDecimalString(), '180.00');
    assert.equal(p.tevkifatTotal.toDecimalString(), '90.00');
    assert.equal(p.payableAmount.toDecimalString(), '1090.00');
  });

  it('döviz: USD currency + exchange rate parse edilir, Money USD', () => {
    const p = UblInvoiceParser.parse(USD_INVOICE, 'outgoing');
    assert.equal(p.currency, 'USD');
    assert.equal(p.exchangeRate, 32.15);
    assert.equal(p.payableAmount.toDecimalString(), '500.00');
    assert.equal(p.payableAmount.currency, 'USD');
  });

  it('e-Arşiv: Person party adı FirstName + FamilyName olarak birleşir', () => {
    const p = UblInvoiceParser.parse(EARSIV_PERSON, 'outgoing');
    assert.equal(p.scenario, 'EARSIVFATURA');
    assert.equal(p.party.vknTckn, '10000000146');
    assert.equal(p.party.name, 'Ahmet Yılmaz');
    assert.equal(p.dueDate, null);
  });

  it('geçersiz XML (Invoice kökü yok) → UblParseError', () => {
    assert.throws(() => UblInvoiceParser.parse('<Foo></Foo>', 'incoming'), UblParseError);
  });

  it('desteklenmeyen para birimi → UblParseError', () => {
    const xml = USD_INVOICE.replace('DocumentCurrencyCode>USD', 'DocumentCurrencyCode>GBP');
    assert.throws(() => UblInvoiceParser.parse(xml, 'outgoing'), UblParseError);
  });
});

describe('EInvoice.fromParsed', () => {
  it('parse sonucunu şirket+provider bağlamıyla cache kaydına çevirir', () => {
    const parsed = UblInvoiceParser.parse(SATIS_TRY, 'outgoing');
    const e = EInvoice.fromParsed(parsed, { companyId: 100, provider: 'elogo' });
    assert.equal(e.id, null);
    assert.equal(e.companyId, 100);
    assert.equal(e.uuid, parsed.uuid);
    assert.equal(e.isImported, false);
    assert.equal(e.isIgnored, false);
    assert.equal(e.lines.length, 2);
    assert.equal(e.payableAmount.toDecimalString(), '1200.00');
  });

  it('markImported / markIgnored yeni instance döner', () => {
    const parsed = UblInvoiceParser.parse(SATIS_TRY, 'outgoing');
    const e = EInvoice.fromParsed(parsed, { companyId: 100, provider: 'mock' });
    const imported = e.markImported(42);
    assert.equal(imported.isImported, true);
    assert.equal(e.isImported, false); // orijinal değişmez

    const ignored = e.markIgnored('mükerrer');
    assert.equal(ignored.isIgnored, true);
    assert.equal(e.isIgnored, false);
  });

  it('boş party (vkn/name) → null serialize', () => {
    const parsed = UblInvoiceParser.parse(USD_INVOICE, 'incoming'); // incoming ama supplier yok
    const e = EInvoice.fromParsed(parsed, { companyId: 1, provider: 'mock' });
    assert.equal(e.toJSON().partyVknTckn, null);
    assert.equal(e.toJSON().partyName, null);
  });
});
