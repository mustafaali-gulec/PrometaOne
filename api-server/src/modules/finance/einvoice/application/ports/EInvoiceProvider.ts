/**
 * EInvoiceProvider — e-fatura entegratörü portu (eLogo, QNB eFinans, mock).
 *
 * Application/sync katmanı provider-agnostic kalır. Concrete impl'ler
 * infrastructure/provider/ altında. Provider ham özet + ham UBL XML döner;
 * parse (UblInvoiceParser) ve cache/import application katmanında yapılır.
 */
import type { CredentialConfig } from '../../domain/entities/EInvoiceCredential.js';
import type { InvoiceDirection } from '../../domain/valueObjects/InvoiceDirection.js';

/** Liste çağrısından dönen hafif özet (XML olmadan). */
export interface ProviderInvoiceSummary {
  uuid: string;
  invoiceNo: string;
  direction: InvoiceDirection;
  invoiceType: string | null;
  scenario: string | null;
  issueDate: string;
  dueDate: string | null;
  partyVknTckn: string;
  partyName: string;
  /** Entegratörün döndürdüğü ham para birimi (henüz Currency'ye daraltılmamış). */
  currency: string;
  /** Ödenecek tutar (decimal string). */
  payableAmount: string;
  gibStatus: string | null;
}

export interface FetchInvoiceListParams {
  dateFrom: string;
  dateTo: string;
  direction: 'incoming' | 'outgoing' | 'both';
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
}

/** Entegratörden çekilen fatura görseli (PDF/HTML). */
export interface ProviderInvoicePdf {
  fileName: string;
  contentType: string;
  /** Dosya içeriği — base64. */
  base64Data: string;
}

export interface EInvoiceProvider {
  readonly name: string;
  testConnection(config: CredentialConfig): Promise<ProviderTestResult>;
  fetchInvoiceList(
    config: CredentialConfig,
    params: FetchInvoiceListParams,
  ): Promise<ProviderInvoiceSummary[]>;
  fetchInvoiceXml(
    config: CredentialConfig,
    uuid: string,
    direction: InvoiceDirection,
  ): Promise<string>;
  fetchInvoicePdf(
    config: CredentialConfig,
    uuid: string,
    direction: InvoiceDirection,
  ): Promise<ProviderInvoicePdf>;
}
