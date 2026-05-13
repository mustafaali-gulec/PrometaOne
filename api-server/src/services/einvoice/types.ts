/**
 * E-Fatura Provider Abstraction
 * ----------------------------
 * Logo eLogo, QNB eFinans, Logo DB direkt vb. her entegratör bu interface'i
 * implement eder. Routes katmanı provider-agnostic kalır.
 */

export interface EInvoiceProviderConfig {
  username: string;
  password: string;
  vergiNo: string;            // mükellef VKN
  env?: "test" | "prod";
  wsdlUrl?: string;           // opsiyonel, default test/prod URL'leri provider'da
  extras?: Record<string, any>;
}

/**
 * Sade fatura özeti — listeleme için, XML olmadan
 */
export interface EInvoiceSummary {
  uuid: string;                     // GİB ETTN
  invoiceNo: string;
  direction: "incoming" | "outgoing";
  invoiceType?: string;             // SATIS | IADE | TEVKIFAT | ISTISNA
  scenario?: string;                // TEMELFATURA | TICARIFATURA | EARSIVFATURA
  issueDate: string;                // YYYY-MM-DD
  dueDate?: string;
  partyVknTckn: string;             // alıcı (outgoing için) veya satıcı (incoming için)
  partyName: string;
  partyAlias?: string;              // GİB etiketi
  currency: string;
  exchangeRate?: number;
  subtotal?: number;
  kdvTotal?: number;
  tevkifatTotal?: number;
  payableAmount: number;
  gibStatus?: string;
  responseCode?: string;
}

/**
 * Tam fatura — XML dahil
 */
export interface EInvoiceFull extends EInvoiceSummary {
  xmlRaw: string;
  pdfUrl?: string;
  lines?: EInvoiceLine[];
}

export interface EInvoiceLine {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  kdvRate: number;
  kdvAmount: number;
  tevkifatRate?: number;
  tevkifatAmount?: number;
}

export interface FetchInvoicesParams {
  dateFrom: string;        // YYYY-MM-DD
  dateTo: string;
  direction: "incoming" | "outgoing" | "both";
  /** Sadece UUID listesi getir, ham XML çekme (hızlı). XML lazy olarak `fetchInvoiceXml` ile alınır. */
  summaryOnly?: boolean;
}

export interface IEInvoiceProvider {
  readonly name: string;

  /** Credentials geçerli mi, oturum açabiliyor muyuz? */
  testConnection(config: EInvoiceProviderConfig): Promise<{ ok: boolean; message?: string }>;

  /** Tarih aralığındaki faturaları listele */
  fetchInvoices(config: EInvoiceProviderConfig, params: FetchInvoicesParams): Promise<EInvoiceSummary[]>;

  /** Tek bir faturanın ham UBL-TR XML'ini getir */
  fetchInvoiceXml(config: EInvoiceProviderConfig, uuid: string, direction: "incoming" | "outgoing"): Promise<string>;

  /** Tek bir faturanın PDF'ini getir (varsa) */
  fetchInvoicePdf?(config: EInvoiceProviderConfig, uuid: string, direction: "incoming" | "outgoing"): Promise<Buffer>;

  /** Gelen faturayı kabul/reddet (sadece TICARIFATURA için) */
  respondToInvoice?(config: EInvoiceProviderConfig, uuid: string, response: "accept" | "reject", reason?: string): Promise<{ ok: boolean; message?: string }>;
}
