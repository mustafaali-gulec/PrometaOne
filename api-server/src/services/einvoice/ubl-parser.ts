/**
 * UBL-TR 2.1 XML Parser
 * --------------------
 * GİB standart e-Fatura/e-Arşiv XML formatını parse eder.
 * Türk e-fatura standardı UBL-TR 2.1 = OASIS UBL 2.1 + GİB özelleştirmeleri.
 *
 * Bu parser DOMParser/regex değil, fast-xml-parser kullanır (Node + browser uyumlu).
 *
 * Kurulum: npm install fast-xml-parser
 */

import { XMLParser } from "fast-xml-parser";
import type { EInvoiceFull, EInvoiceLine, EInvoiceSummary } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,           // <cac:PartyName> → <PartyName>
  parseTagValue: false,
  trimValues: true,
});

/**
 * UBL-TR Invoice XML → EInvoiceFull
 *
 * Genel UBL yapısı:
 * <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
 *   <cbc:UUID>...</cbc:UUID>                          → uuid
 *   <cbc:ID>FATURA_NO</cbc:ID>                        → invoiceNo
 *   <cbc:IssueDate>2026-05-12</cbc:IssueDate>         → issueDate
 *   <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
 *   <cbc:ProfileID>TEMELFATURA</cbc:ProfileID>
 *   <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
 *   <cac:AccountingSupplierParty>...</cac:AccountingSupplierParty>   (satıcı)
 *   <cac:AccountingCustomerParty>...</cac:AccountingCustomerParty>   (alıcı)
 *   <cac:TaxTotal>...</cac:TaxTotal>                                 (KDV)
 *   <cac:LegalMonetaryTotal>...</cac:LegalMonetaryTotal>             (tutarlar)
 *   <cac:InvoiceLine>...</cac:InvoiceLine>                           (kalem)
 * </Invoice>
 */
export function parseUblInvoice(xml: string, direction: "incoming" | "outgoing"): EInvoiceFull {
  const root = parser.parse(xml);
  const inv = root.Invoice;
  if (!inv) throw new Error("Geçersiz UBL fatura XML'i: <Invoice> kök bulunamadı");

  const uuid = String(inv.UUID || "");
  const invoiceNo = String(inv.ID || "");
  const issueDate = String(inv.IssueDate || "").slice(0, 10);
  const dueDate = inv.DueDate ? String(inv.DueDate).slice(0, 10) : undefined;
  const invoiceType = inv.InvoiceTypeCode ? String(inv.InvoiceTypeCode) : undefined;
  const scenario = inv.ProfileID ? String(inv.ProfileID) : undefined;
  const currency = String(inv.DocumentCurrencyCode || "TRY");
  const exchangeRate = inv.PricingExchangeRate?.CalculationRate
    ? Number(inv.PricingExchangeRate.CalculationRate) : undefined;

  // Karşı taraf — gelen fatura için satıcı, giden fatura için alıcı
  const supplier = extractParty(inv.AccountingSupplierParty?.Party);
  const customer = extractParty(inv.AccountingCustomerParty?.Party);
  const party = direction === "incoming" ? supplier : customer;

  // Tutarlar — LegalMonetaryTotal
  const lmt = inv.LegalMonetaryTotal || {};
  const subtotal = num(lmt.LineExtensionAmount);
  const taxExclusive = num(lmt.TaxExclusiveAmount);
  const taxInclusive = num(lmt.TaxInclusiveAmount);
  const payableAmount = num(lmt.PayableAmount);

  // KDV ve Tevkifat — TaxTotal birden fazla olabilir (KDV, Tevkifat, ÖTV vs.)
  const taxTotals = arrayOf(inv.TaxTotal);
  let kdvTotal = 0;
  let tevkifatTotal = 0;
  for (const tt of taxTotals) {
    const subtotals = arrayOf(tt.TaxSubtotal);
    for (const ts of subtotals) {
      const taxCode = String(ts.TaxCategory?.TaxScheme?.TaxTypeCode || "");
      const amount = num(ts.TaxAmount);
      if (taxCode === "0015" || taxCode === "KDV") {
        kdvTotal += amount;
      } else if (taxCode === "9015" || taxCode.includes("TEVK")) {
        tevkifatTotal += amount;
      }
    }
  }

  // Kalemler
  const lines: EInvoiceLine[] = arrayOf(inv.InvoiceLine).map((ln) => {
    const qty = num(ln.InvoicedQuantity);
    const unit = ln.InvoicedQuantity?.["@_unitCode"] || "";
    const unitPrice = num(ln.Price?.PriceAmount);
    const lineTotal = num(ln.LineExtensionAmount);
    const itemName = String(ln.Item?.Name || "");
    const itemDesc = ln.Item?.Description ? String(ln.Item.Description) : undefined;

    // Kalem KDV
    let kdvRate = 0, kdvAmount = 0, tevkRate, tevkAmount;
    const lineTaxes = arrayOf(ln.TaxTotal);
    for (const tt of lineTaxes) {
      const subs = arrayOf(tt.TaxSubtotal);
      for (const ts of subs) {
        const code = String(ts.TaxCategory?.TaxScheme?.TaxTypeCode || "");
        if (code === "0015") {
          kdvRate = num(ts.Percent);
          kdvAmount = num(ts.TaxAmount);
        } else if (code === "9015") {
          tevkRate = num(ts.Percent);
          tevkAmount = num(ts.TaxAmount);
        }
      }
    }

    return {
      name: itemName,
      description: itemDesc,
      quantity: qty,
      unit: String(unit),
      unitPrice,
      lineTotal,
      kdvRate,
      kdvAmount,
      tevkifatRate: tevkRate,
      tevkifatAmount: tevkAmount,
    };
  });

  return {
    uuid,
    invoiceNo,
    direction,
    invoiceType,
    scenario,
    issueDate,
    dueDate,
    partyVknTckn: party.vknTckn,
    partyName: party.name,
    partyAlias: party.alias,
    currency,
    exchangeRate,
    subtotal: subtotal || taxExclusive,
    kdvTotal,
    tevkifatTotal,
    payableAmount,
    xmlRaw: xml,
    lines,
  };
}

/**
 * Sadece özet bilgileri çıkar (XML olmadan ya da minimum parse ile)
 */
export function parseUblInvoiceSummary(xml: string, direction: "incoming" | "outgoing"): EInvoiceSummary {
  const full = parseUblInvoice(xml, direction);
  const { xmlRaw, lines, ...summary } = full;
  return summary;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function extractParty(party: any): { vknTckn: string; name: string; alias?: string } {
  if (!party) return { vknTckn: "", name: "" };
  // PartyIdentification — birden çok olabilir (VKN_TCKN, GİB etiketi vs.)
  const idents = arrayOf(party.PartyIdentification);
  let vknTckn = "";
  for (const id of idents) {
    const scheme = id.ID?.["@_schemeID"];
    const value = String(id.ID?.["#text"] || id.ID || "");
    if (scheme === "VKN" || scheme === "TCKN" || scheme === "VKN_TCKN") {
      vknTckn = value;
      break;
    }
  }
  // İsim
  const name = String(party.PartyName?.Name
    || (party.Person ? `${party.Person.FirstName || ""} ${party.Person.FamilyName || ""}`.trim() : "")
    || "");
  // GİB etiketi (PK adresi)
  const alias = party.PartyIdentification && Array.isArray(party.PartyIdentification)
    ? party.PartyIdentification.find((p: any) => p.ID?.["@_schemeID"] === "ALIAS")?.ID?.["#text"]
    : undefined;
  return { vknTckn, name, alias };
}

function arrayOf<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: any): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "object" && "#text" in v) return Number(v["#text"]) || 0;
  return Number(v) || 0;
}
