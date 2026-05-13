/**
 * Logo eLogo Provider Adapter
 * ---------------------------
 * Logo Yazılım'ın eLogo (https://www.elogo.com.tr) entegratör servisini
 * Promet CF backend'inden kullanmak için SOAP istemcisi.
 *
 * Genel akış:
 *   1. login(username, password) → sessionID
 *   2. getInvoiceList(sessionID, dateRange, direction) → fatura UUID listesi
 *   3. getInvoice(sessionID, uuid) → UBL XML
 *   4. logout(sessionID)
 *
 * eLogo WSDL endpoint'leri:
 *   - Test: https://test.uyumsoft.com.tr/Services/BasicIntegration?wsdl  (Logo eLogo whitelabel)
 *     - VEYA: müşterinin abonelik panelinde verilen özel test URL'i
 *   - Prod: https://api.elogo.com.tr/...  (müşteri özel)
 *
 * NOT: eLogo'nun resmi public dökümantasyonu paywall arkasında.
 * Gerçek WSDL URL'i ve method adları Promet'in eLogo panelinden alınmalıdır
 * ("Geliştirici / API" sekmesinde indirilebilir WSDL ve örnek istek dosyaları var).
 *
 * Bu sınıf SOAP istek/yanıt yapısı standart kabul ederek yazılmıştır.
 * Gerçek endpoint farklı isimlerde method bekliyorsa adapter'da değiştirilebilir.
 *
 * Kurulum: npm install strong-soap fast-xml-parser
 */

import type {
  IEInvoiceProvider, EInvoiceProviderConfig, EInvoiceSummary,
  FetchInvoicesParams,
} from "./types";
import { parseUblInvoiceSummary } from "./ubl-parser";

// Dinamik import: SOAP modül opsiyonel, test ortamında olmayabilir.
async function getSoapClient() {
  const mod = await import("strong-soap").catch(() => null);
  if (!mod) {
    throw new Error("strong-soap modülü yüklü değil. `npm install strong-soap` çalıştırın.");
  }
  return mod.soap;
}

export class ELogoProvider implements IEInvoiceProvider {
  readonly name = "elogo";

  private getWsdlUrl(config: EInvoiceProviderConfig): string {
    if (config.wsdlUrl) return config.wsdlUrl;
    // Mustafa eLogo panelinden bu URL'i alıp .env'de WSDL_URL olarak ayarlayabilir
    return config.env === "prod"
      ? "https://earsiv.elogo.com.tr/api/api.svc?singleWsdl"
      : "https://test.elogo.com.tr/api/api.svc?singleWsdl";
  }

  async testConnection(config: EInvoiceProviderConfig) {
    try {
      const sessionID = await this.login(config);
      await this.logout(config, sessionID);
      return { ok: true, message: "Bağlantı başarılı. Oturum açılabiliyor." };
    } catch (err: any) {
      return { ok: false, message: err.message || "Bilinmeyen hata" };
    }
  }

  async fetchInvoices(config: EInvoiceProviderConfig, params: FetchInvoicesParams): Promise<EInvoiceSummary[]> {
    const sessionID = await this.login(config);
    try {
      const results: EInvoiceSummary[] = [];
      if (params.direction === "incoming" || params.direction === "both") {
        const incoming = await this.fetchListBySide(config, sessionID, params.dateFrom, params.dateTo, "incoming");
        results.push(...incoming);
      }
      if (params.direction === "outgoing" || params.direction === "both") {
        const outgoing = await this.fetchListBySide(config, sessionID, params.dateFrom, params.dateTo, "outgoing");
        results.push(...outgoing);
      }
      return results;
    } finally {
      await this.logout(config, sessionID).catch(() => {});
    }
  }

  async fetchInvoiceXml(config: EInvoiceProviderConfig, uuid: string, direction: "incoming" | "outgoing"): Promise<string> {
    const sessionID = await this.login(config);
    try {
      const client = await this.createClient(config);
      // eLogo method adı: GetInboxInvoice / GetOutboxInvoice
      const methodName = direction === "incoming" ? "GetInboxInvoice" : "GetOutboxInvoice";
      const result: any = await callSoap(client, methodName, {
        SessionID: sessionID,
        UUID: uuid,
        Format: "XML",
      });
      const xml = result?.XmlData || result?.InvoiceData || result?.Xml;
      if (!xml) throw new Error(`eLogo ${methodName} XML döndürmedi`);
      // Bazı entegratörler base64 olarak gönderir
      if (/^[A-Za-z0-9+/=\s]+$/.test(xml) && xml.length > 100) {
        try { return Buffer.from(xml, "base64").toString("utf-8"); } catch {}
      }
      return xml;
    } finally {
      await this.logout(config, sessionID).catch(() => {});
    }
  }

  // ────────────────────────────────────────────────────────────────────

  private async createClient(config: EInvoiceProviderConfig): Promise<any> {
    const soap = await getSoapClient();
    const wsdlUrl = this.getWsdlUrl(config);
    return new Promise((resolve, reject) => {
      soap.createClient(wsdlUrl, { connection: "keep-alive" }, (err: any, client: any) => {
        if (err) return reject(new Error(`WSDL alınamadı (${wsdlUrl}): ${err.message}`));
        resolve(client);
      });
    });
  }

  private async login(config: EInvoiceProviderConfig): Promise<string> {
    const client = await this.createClient(config);
    const result: any = await callSoap(client, "Login", {
      UserName: config.username,
      Password: config.password,
      VergiTcKimlikNo: config.vergiNo,
    });
    const sessionID = result?.SessionID || result?.sessionId || result?.token;
    if (!sessionID) {
      throw new Error("eLogo Login: SessionID alınamadı. Kullanıcı adı/şifre veya VKN hatalı olabilir.");
    }
    return sessionID;
  }

  private async logout(config: EInvoiceProviderConfig, sessionID: string): Promise<void> {
    const client = await this.createClient(config);
    await callSoap(client, "Logout", { SessionID: sessionID }).catch(() => {});
  }

  private async fetchListBySide(
    config: EInvoiceProviderConfig,
    sessionID: string,
    dateFrom: string,
    dateTo: string,
    direction: "incoming" | "outgoing"
  ): Promise<EInvoiceSummary[]> {
    const client = await this.createClient(config);
    const methodName = direction === "incoming" ? "GetInboxInvoiceList" : "GetOutboxInvoiceList";
    const result: any = await callSoap(client, methodName, {
      SessionID: sessionID,
      StartDate: dateFrom,
      EndDate: dateTo,
    });
    const items: any[] = ensureArray(result?.InvoiceList?.Invoice || result?.Invoices || result?.Items || []);

    return items.map((it) => ({
      uuid: String(it.UUID || it.Uuid || it.ETTN || ""),
      invoiceNo: String(it.ID || it.InvoiceNo || it.FaturaNo || ""),
      direction,
      invoiceType: it.InvoiceTypeCode || it.FaturaTipi,
      scenario: it.ProfileID || it.Senaryo,
      issueDate: String(it.IssueDate || it.FaturaTarihi || "").slice(0, 10),
      dueDate: it.DueDate ? String(it.DueDate).slice(0, 10) : undefined,
      partyVknTckn: String(
        direction === "incoming"
          ? (it.SenderVKN || it.SaticiVKN || it.SupplierVKN)
          : (it.ReceiverVKN || it.AliciVKN || it.CustomerVKN)
        || ""
      ),
      partyName: String(
        direction === "incoming"
          ? (it.SenderName || it.SaticiUnvan || it.SupplierName)
          : (it.ReceiverName || it.AliciUnvan || it.CustomerName)
        || ""
      ),
      currency: String(it.Currency || it.DocumentCurrencyCode || "TRY"),
      subtotal: Number(it.Subtotal || it.TaxExclusiveAmount || 0),
      kdvTotal: Number(it.TaxAmount || it.KdvToplam || 0),
      payableAmount: Number(it.PayableAmount || it.OdenecekTutar || it.Total || 0),
      gibStatus: it.GibStatus || it.Durum,
      responseCode: it.ResponseCode || it.YanitKodu,
    })).filter(s => s.uuid);
  }

  /**
   * Test/demo mode — eLogo erişimi yokken sahte veri üret (geliştirme için)
   */
  static mockSummaries(count = 20): EInvoiceSummary[] {
    const today = new Date();
    const out: EInvoiceSummary[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i * 2);
      const incoming = i % 2 === 0;
      const tutar = 1000 + Math.random() * 50000;
      const kdv = tutar * 0.20;
      out.push({
        uuid: `mock-${Date.now()}-${i}`,
        invoiceNo: `${incoming ? "GLN" : "TAS"}2026${String(i+1).padStart(6, "0")}`,
        direction: incoming ? "incoming" : "outgoing",
        invoiceType: "SATIS",
        scenario: "TEMELFATURA",
        issueDate: d.toISOString().slice(0,10),
        partyVknTckn: incoming ? `123456789${i%10}` : `987654321${i%10}`,
        partyName: incoming ? `Tedarikçi ${i+1} A.Ş.` : `Müşteri ${i+1} Ltd. Şti.`,
        currency: "TRY",
        subtotal: tutar,
        kdvTotal: kdv,
        payableAmount: tutar + kdv,
        gibStatus: "KABUL_EDILDI",
      });
    }
    return out;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function callSoap(client: any, method: string, args: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof client[method] !== "function") {
      return reject(new Error(`SOAP method bulunamadı: ${method}. Mevcut: ${Object.keys(client).filter(k => typeof client[k] === "function").join(", ")}`));
    }
    client[method](args, (err: any, result: any) => {
      if (err) return reject(new Error(`SOAP ${method} hatası: ${err.message || JSON.stringify(err)}`));
      resolve(result);
    });
  });
}

function ensureArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : (v ? [v] : []);
}
