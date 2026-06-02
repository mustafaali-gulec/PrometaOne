/**
 * UblInvoiceParser — UBL-TR 2.1 e-Fatura XML → ParsedEInvoice (saf domain).
 *
 * Türk e-fatura standardı = OASIS UBL 2.1 + GİB özelleştirmeleri. fast-xml-parser
 * ile namespace prefix'leri sıyrılarak (`cbc:`/`cac:` → düz) parse edilir.
 * Tutarlar Faz 5 `Money` ile kuruş-kesin; dinamik XML ağacı `unknown` üzerinden
 * güvenli daraltılır (no `any`).
 *
 * Legacy `src/services/einvoice/ubl-parser.ts`'in strict + Money'li hâli.
 */
import { XMLParser } from 'fast-xml-parser';

import { toCurrency, type Currency } from '../../../domain/valueObjects/Currency.js';
import { Money } from '../../../domain/valueObjects/Money.js';
import { EInvoiceLine } from '../entities/EInvoiceLine.js';
import { UblParseError } from '../errors/EInvoiceErrors.js';
import type { InvoiceDirection } from '../valueObjects/InvoiceDirection.js';

// GİB vergi tipi kodları
const TAX_KDV = '0015';
const TAX_TEVKIFAT = '9015';
const TAX_OTV = '0071';
const TAX_KONAKLAMA = '0059';

export interface ParsedParty {
  vknTckn: string;
  name: string;
  alias: string | null;
}

export interface ParsedEInvoice {
  uuid: string;
  invoiceNo: string;
  direction: InvoiceDirection;
  invoiceType: string | null;
  scenario: string | null;
  party: ParsedParty;
  issueDate: string;
  dueDate: string | null;
  currency: Currency;
  exchangeRate: number | null;
  subtotal: Money;
  kdvTotal: Money;
  tevkifatTotal: Money;
  konaklamaVergisi: Money;
  ozelTuketimVergisi: Money;
  payableAmount: Money;
  lines: EInvoiceLine[];
  xmlRaw: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

// --- güvenli daraltma yardımcıları ----------------------------------------
function asObj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function asArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function toStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'symbol') return v.toString();
  return '';
}

function text(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') {
    const t = (v as Record<string, unknown>)['#text'];
    return toStr(t);
  }
  return toStr(v);
}

function attr(v: unknown, key: string): string {
  const o = asObj(v);
  return toStr(o[key]);
}

export const UblInvoiceParser = {
  parse(xml: string, direction: InvoiceDirection): ParsedEInvoice {
    let root: unknown;
    try {
      root = xmlParser.parse(xml) as unknown;
    } catch (err) {
      throw new UblParseError(err instanceof Error ? err.message : String(err));
    }
    const inv = asObj(asObj(root)['Invoice']);
    if (Object.keys(inv).length === 0) {
      throw new UblParseError('<Invoice> kök elemanı bulunamadı');
    }

    const currencyRaw = text(inv['DocumentCurrencyCode']) || 'TRY';
    let currency: Currency;
    try {
      currency = toCurrency(currencyRaw);
    } catch {
      throw new UblParseError(`desteklenmeyen para birimi: ${currencyRaw}`);
    }

    const moneyOf = (v: unknown): Money => {
      const t = text(v);
      return Money.fromDecimalString(t === '' ? '0' : t, currency);
    };

    // Karşı taraf: gelen → satıcı, giden → alıcı
    const supplier = extractParty(asObj(inv['AccountingSupplierParty'])['Party']);
    const customer = extractParty(asObj(inv['AccountingCustomerParty'])['Party']);
    const party = direction === 'incoming' ? supplier : customer;

    // Tutarlar
    const lmt = asObj(inv['LegalMonetaryTotal']);
    const lineExtension = moneyOf(lmt['LineExtensionAmount']);
    const taxExclusive = moneyOf(lmt['TaxExclusiveAmount']);
    const subtotal = lineExtension.isPositive() ? lineExtension : taxExclusive;
    const payableAmount = moneyOf(lmt['PayableAmount']);

    // Belge düzeyi vergiler (KDV/tevkifat/ÖTV/konaklama)
    let kdvTotal = Money.zero(currency);
    let tevkifatTotal = Money.zero(currency);
    let otv = Money.zero(currency);
    let konaklama = Money.zero(currency);
    for (const tt of asArray(inv['TaxTotal'])) {
      for (const ts of asArray(asObj(tt)['TaxSubtotal'])) {
        const tsObj = asObj(ts);
        const code = taxTypeCode(tsObj);
        const amount = moneyOf(tsObj['TaxAmount']);
        if (code === TAX_KDV) kdvTotal = kdvTotal.plus(amount);
        else if (code === TAX_TEVKIFAT) tevkifatTotal = tevkifatTotal.plus(amount);
        else if (code === TAX_OTV) otv = otv.plus(amount);
        else if (code === TAX_KONAKLAMA) konaklama = konaklama.plus(amount);
      }
    }

    // Kalemler
    const lines = asArray(inv['InvoiceLine']).map((raw) =>
      parseLine(asObj(raw), currency, moneyOf),
    );

    const exchangeRaw = text(asObj(inv['PricingExchangeRate'])['CalculationRate']);
    const exchangeRate = exchangeRaw === '' ? null : Number(exchangeRaw) || null;

    return {
      uuid: text(inv['UUID']),
      invoiceNo: text(inv['ID']),
      direction,
      invoiceType: text(inv['InvoiceTypeCode']) || null,
      scenario: text(inv['ProfileID']) || null,
      party,
      issueDate: text(inv['IssueDate']).slice(0, 10),
      dueDate: text(inv['DueDate']) ? text(inv['DueDate']).slice(0, 10) : null,
      currency,
      exchangeRate,
      subtotal,
      kdvTotal,
      tevkifatTotal,
      konaklamaVergisi: konaklama,
      ozelTuketimVergisi: otv,
      payableAmount,
      lines,
      xmlRaw: xml,
    };
  },
} as const;

function taxTypeCode(taxSubtotal: Record<string, unknown>): string {
  const scheme = asObj(asObj(taxSubtotal['TaxCategory'])['TaxScheme']);
  return text(scheme['TaxTypeCode']);
}

function parseLine(
  ln: Record<string, unknown>,
  currency: Currency,
  moneyOf: (v: unknown) => Money,
): EInvoiceLine {
  let kdvRate = 0;
  let kdvAmount = Money.zero(currency);
  let tevkRate: number | null = null;
  let tevkAmount: Money | null = null;

  for (const tt of asArray(ln['TaxTotal'])) {
    for (const ts of asArray(asObj(tt)['TaxSubtotal'])) {
      const tsObj = asObj(ts);
      const code = taxTypeCode(tsObj);
      if (code === TAX_KDV) {
        kdvRate = Number(text(tsObj['Percent'])) || 0;
        kdvAmount = moneyOf(tsObj['TaxAmount']);
      } else if (code === TAX_TEVKIFAT) {
        tevkRate = Number(text(tsObj['Percent'])) || 0;
        tevkAmount = moneyOf(tsObj['TaxAmount']);
      }
    }
  }

  const item = asObj(ln['Item']);
  const descRaw = text(item['Description']);
  return EInvoiceLine.create({
    name: text(item['Name']),
    description: descRaw === '' ? null : descRaw,
    quantity: Number(text(ln['InvoicedQuantity'])) || 0,
    unit: attr(ln['InvoicedQuantity'], '@_unitCode'),
    unitPrice: moneyOf(asObj(ln['Price'])['PriceAmount']),
    lineTotal: moneyOf(ln['LineExtensionAmount']),
    kdvRatePercent: kdvRate,
    kdvAmount,
    tevkifatRatePercent: tevkRate,
    tevkifatAmount: tevkAmount,
  });
}

function extractParty(partyRaw: unknown): ParsedParty {
  const party = asObj(partyRaw);
  if (Object.keys(party).length === 0) {
    return { vknTckn: '', name: '', alias: null };
  }
  let vknTckn = '';
  let alias: string | null = null;
  for (const id of asArray(party['PartyIdentification'])) {
    const idObj = asObj(asObj(id)['ID']);
    const scheme = attr(asObj(id)['ID'], '@_schemeID');
    const value = text(asObj(id)['ID']) || text(idObj['#text']);
    if ((scheme === 'VKN' || scheme === 'TCKN' || scheme === 'VKN_TCKN') && vknTckn === '') {
      vknTckn = value;
    } else if (scheme === 'ALIAS' && alias === null) {
      alias = value;
    }
  }
  const person = asObj(party['Person']);
  const personName = `${text(person['FirstName'])} ${text(person['FamilyName'])}`.trim();
  const name = text(asObj(party['PartyName'])['Name']) || personName;
  return { vknTckn, name, alias };
}
