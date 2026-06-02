/**
 * ELogoProvider — Logo eLogo (SOAP) EInvoiceProvider implementasyonu.
 *
 * Legacy `src/services/einvoice/elogo.ts`'in strict + port-uyumlu hâli.
 * Akış: Login → GetInbox/OutboxInvoiceList → GetInbox/OutboxInvoice (XML) → Logout.
 *
 * SOAP client dinamik (`strong-soap`); ambient declaration (src/types/strong-soap.d.ts)
 * yalnızca kullandığımız yüzeyi tipler. SOAP yanıtları `unknown` üzerinden
 * güvenli daraltılır. Bu adapter ağ gerektirdiği için birim testi MockProvider
 * ile yapılır; gerçek bağlantı kullanıcı ortamında doğrulanır.
 */
import type { SoapClient, soap } from 'strong-soap';

type SoapNamespace = typeof soap;

import type {
  EInvoiceProvider,
  FetchInvoiceListParams,
  ProviderInvoiceSummary,
  ProviderTestResult,
} from '../../application/ports/EInvoiceProvider.js';
import type { CredentialConfig } from '../../domain/entities/EInvoiceCredential.js';
import { ProviderAuthError, ProviderFetchError } from '../../domain/errors/EInvoiceErrors.js';
import type { InvoiceDirection } from '../../domain/valueObjects/InvoiceDirection.js';

export class ELogoProvider implements EInvoiceProvider {
  readonly name = 'elogo';

  private wsdlUrl(config: CredentialConfig): string {
    if (config.wsdlUrl !== undefined && config.wsdlUrl !== '') return config.wsdlUrl;
    return config.env === 'prod'
      ? 'https://earsiv.elogo.com.tr/api/api.svc?singleWsdl'
      : 'https://test.elogo.com.tr/api/api.svc?singleWsdl';
  }

  async testConnection(config: CredentialConfig): Promise<ProviderTestResult> {
    try {
      const sessionId = await this.login(config);
      await this.logout(config, sessionId);
      return { ok: true, message: 'Bağlantı başarılı. Oturum açılabiliyor.' };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async fetchInvoiceList(
    config: CredentialConfig,
    params: FetchInvoiceListParams,
  ): Promise<ProviderInvoiceSummary[]> {
    const sessionId = await this.login(config);
    try {
      const results: ProviderInvoiceSummary[] = [];
      if (params.direction === 'incoming' || params.direction === 'both') {
        results.push(...(await this.fetchListBySide(config, sessionId, params, 'incoming')));
      }
      if (params.direction === 'outgoing' || params.direction === 'both') {
        results.push(...(await this.fetchListBySide(config, sessionId, params, 'outgoing')));
      }
      return results;
    } finally {
      await this.logout(config, sessionId).catch(() => undefined);
    }
  }

  async fetchInvoiceXml(
    config: CredentialConfig,
    uuid: string,
    direction: InvoiceDirection,
  ): Promise<string> {
    const sessionId = await this.login(config);
    try {
      const client = await this.createClient(config);
      const method = direction === 'incoming' ? 'GetInboxInvoice' : 'GetOutboxInvoice';
      const result = asObj(
        await callSoap(client, method, { SessionID: sessionId, UUID: uuid, Format: 'XML' }),
      );
      const xml = str(result['XmlData'] ?? result['InvoiceData'] ?? result['Xml']);
      if (xml === '') {
        throw new ProviderFetchError(`${method} XML döndürmedi`);
      }
      // Bazı entegratörler base64 gönderir
      if (xml.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(xml)) {
        try {
          return Buffer.from(xml, 'base64').toString('utf-8');
        } catch {
          return xml;
        }
      }
      return xml;
    } finally {
      await this.logout(config, sessionId).catch(() => undefined);
    }
  }

  // --- SOAP iç akış --------------------------------------------------------
  private createClient(config: CredentialConfig): Promise<SoapClient> {
    const url = this.wsdlUrl(config);
    return loadSoap().then(
      (soap) =>
        new Promise<SoapClient>((resolve, reject) => {
          soap.createClient(url, { connection: 'keep-alive' }, (err, client) => {
            if (err) {
              reject(new ProviderFetchError(`WSDL alınamadı (${url}): ${errMsg(err)}`));
              return;
            }
            resolve(client);
          });
        }),
    );
  }

  private async login(config: CredentialConfig): Promise<string> {
    const client = await this.createClient(config);
    const result = asObj(
      await callSoap(client, 'Login', {
        UserName: config.username,
        Password: config.password,
        VergiTcKimlikNo: config.vergiNo,
      }),
    );
    const sessionId = str(result['SessionID'] ?? result['sessionId'] ?? result['token']);
    if (sessionId === '') {
      throw new ProviderAuthError('SessionID alınamadı (kullanıcı adı/şifre/VKN hatalı olabilir)');
    }
    return sessionId;
  }

  private async logout(config: CredentialConfig, sessionId: string): Promise<void> {
    const client = await this.createClient(config);
    await callSoap(client, 'Logout', { SessionID: sessionId }).catch(() => undefined);
  }

  private async fetchListBySide(
    config: CredentialConfig,
    sessionId: string,
    params: FetchInvoiceListParams,
    direction: InvoiceDirection,
  ): Promise<ProviderInvoiceSummary[]> {
    const client = await this.createClient(config);
    const method = direction === 'incoming' ? 'GetInboxInvoiceList' : 'GetOutboxInvoiceList';
    const result = asObj(
      await callSoap(client, method, {
        SessionID: sessionId,
        StartDate: params.dateFrom,
        EndDate: params.dateTo,
      }),
    );
    const items = arr(
      asObj(result['InvoiceList'])['Invoice'] ?? result['Invoices'] ?? result['Items'] ?? [],
    );
    return items.map((raw) => mapSummary(asObj(raw), direction)).filter((s) => s.uuid !== '');
  }
}

// --- yardımcılar -----------------------------------------------------------
async function loadSoap(): Promise<SoapNamespace> {
  const mod = await import('strong-soap').catch(() => null);
  if (mod === null) {
    throw new ProviderFetchError('strong-soap modülü yüklü değil (npm install strong-soap)');
  }
  return mod.soap;
}

function callSoap(client: SoapClient, method: string, args: unknown): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const fn = client[method];
    if (typeof fn !== 'function') {
      reject(new ProviderFetchError(`SOAP method bulunamadı: ${method}`));
      return;
    }
    (fn as (a: unknown, cb: (e: unknown, r: unknown) => void) => void)(args, (err, result) => {
      if (err !== null && err !== undefined) {
        reject(new ProviderFetchError(`SOAP ${method}: ${errMsg(err)}`));
        return;
      }
      resolve(result);
    });
  });
}

function mapSummary(
  it: Record<string, unknown>,
  direction: InvoiceDirection,
): ProviderInvoiceSummary {
  const partyVkn =
    direction === 'incoming'
      ? str(it['SenderVKN'] ?? it['SaticiVKN'] ?? it['SupplierVKN'])
      : str(it['ReceiverVKN'] ?? it['AliciVKN'] ?? it['CustomerVKN']);
  const partyName =
    direction === 'incoming'
      ? str(it['SenderName'] ?? it['SaticiUnvan'] ?? it['SupplierName'])
      : str(it['ReceiverName'] ?? it['AliciUnvan'] ?? it['CustomerName']);
  const dueRaw = str(it['DueDate']);
  return {
    uuid: str(it['UUID'] ?? it['Uuid'] ?? it['ETTN']),
    invoiceNo: str(it['ID'] ?? it['InvoiceNo'] ?? it['FaturaNo']),
    direction,
    invoiceType: nullable(str(it['InvoiceTypeCode'] ?? it['FaturaTipi'])),
    scenario: nullable(str(it['ProfileID'] ?? it['Senaryo'])),
    issueDate: str(it['IssueDate'] ?? it['FaturaTarihi']).slice(0, 10),
    dueDate: dueRaw === '' ? null : dueRaw.slice(0, 10),
    partyVknTckn: partyVkn,
    partyName,
    currency: str(it['Currency'] ?? it['DocumentCurrencyCode']) || 'TRY',
    payableAmount: str(it['PayableAmount'] ?? it['OdenecekTutar'] ?? it['Total']) || '0',
    gibStatus: nullable(str(it['GibStatus'] ?? it['Durum'])),
  };
}

function asObj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function arr(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'symbol') return v.toString();
  return '';
}

function nullable(s: string): string | null {
  return s === '' ? null : s;
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') return JSON.stringify(err);
  return str(err);
}
