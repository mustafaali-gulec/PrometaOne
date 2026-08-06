/**
 * ELogoProvider — Logo eLogo (SOAP PostBoxService) EInvoiceProvider implementasyonu.
 *
 * Gerçek eLogo özel entegratör ucu: https://pb.elogo.com.tr/PostBoxService.svc
 * (WSDL: ?singleWsdl). Eski varsayılanlar (test.elogo.com.tr, test1.diyalogo.com.tr)
 * DNS'ten kaldırıldı; test ortamı adresi eLogo'dan alınıp config.wsdlUrl ile girilir.
 *
 * WSDL'e göre akış (2026-08-05'te canlı WSDL'den doğrulandı):
 *  - Login({ login: { userName, passWord, source, appStr, version } })
 *      → { LoginResult: boolean, sessionID: string }
 *  - getInvoiceList({ beginDate, endDate, opType: 'SEND'|'RECV', sessionID,
 *      dateBy: 'byCREATED'|'byISSUEDATE' }) → ArrayOfstring (fatura UUID listesi)
 *  - getInvoice({ invoiceID, sessionID }) → DocumentType { binaryData: { Value(b64),
 *      contentType }, fileName } — içerik düz UBL XML, gzip veya zip olabilir
 *  - Logout({ sessionID })
 *
 * Liste çağrısı yalnız UUID döndürdüğünden özet metadata boş bırakılır; sync
 * akışı zaten her fatura için fetchInvoiceXml + UblInvoiceParser ile gerçek
 * alanları çıkarır (SyncEInvoicesUseCase özetten uuid/direction/gibStatus kullanır).
 *
 * SOAP client dinamik (`strong-soap`); ambient declaration (src/types/strong-soap.d.ts)
 * yalnızca kullandığımız yüzeyi tipler. WSDL ~170KB olduğundan client wsdlUrl
 * başına cache'lenir. Bu adapter ağ gerektirdiği için birim testi MockProvider
 * ile yapılır; gerçek bağlantı kullanıcı ortamında doğrulanır.
 */
import { gunzipSync, inflateRawSync } from 'node:zlib';

import type { SoapClient, soap } from 'strong-soap';

type SoapNamespace = typeof soap;

import type {
  EInvoiceProvider,
  FetchInvoiceListParams,
  ProviderInvoicePdf,
  ProviderInvoiceSummary,
  ProviderTestResult,
} from '../../application/ports/EInvoiceProvider.js';
import type { CredentialConfig } from '../../domain/entities/EInvoiceCredential.js';
import { ProviderAuthError, ProviderFetchError } from '../../domain/errors/EInvoiceErrors.js';
import type { InvoiceDirection } from '../../domain/valueObjects/InvoiceDirection.js';

/** eLogo'nun herkese açık tek PostBox ucu; test hesap adresi eLogo'dan alınır. */
const DEFAULT_WSDL_URL = 'https://pb.elogo.com.tr/PostBoxService.svc?singleWsdl';

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

export class ELogoProvider implements EInvoiceProvider {
  readonly name = 'elogo';

  private readonly clients = new Map<string, Promise<SoapClient>>();

  private wsdlUrl(config: CredentialConfig): string {
    if (config.wsdlUrl !== undefined && config.wsdlUrl !== '') return config.wsdlUrl;
    return DEFAULT_WSDL_URL;
  }

  async testConnection(config: CredentialConfig): Promise<ProviderTestResult> {
    try {
      const client = await this.createClient(config);
      const sessionId = await this.login(client, config);
      await this.logout(client, sessionId);
      return { ok: true, message: 'Bağlantı başarılı. Oturum açılabiliyor.' };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async fetchInvoiceList(
    config: CredentialConfig,
    params: FetchInvoiceListParams,
  ): Promise<ProviderInvoiceSummary[]> {
    const client = await this.createClient(config);
    const sessionId = await this.login(client, config);
    try {
      const results: ProviderInvoiceSummary[] = [];
      if (params.direction === 'incoming' || params.direction === 'both') {
        results.push(...(await this.fetchListBySide(client, sessionId, params, 'incoming')));
      }
      if (params.direction === 'outgoing' || params.direction === 'both') {
        results.push(...(await this.fetchListBySide(client, sessionId, params, 'outgoing')));
      }
      return results;
    } finally {
      await this.logout(client, sessionId).catch(() => undefined);
    }
  }

  async fetchInvoiceXml(
    config: CredentialConfig,
    uuid: string,
    _direction: InvoiceDirection,
  ): Promise<string> {
    const client = await this.createClient(config);
    const sessionId = await this.login(client, config);
    try {
      const result = asObj(
        await callSoap(client, 'getInvoice', { invoiceID: uuid, sessionID: sessionId }),
      );
      const doc = asObj(result['getInvoiceResult']);
      const binary = asObj(doc['binaryData']);
      const b64 = str(binary['Value'] ?? binary['value']);
      if (b64 === '') {
        throw new ProviderFetchError(`getInvoice veri döndürmedi (UUID: ${uuid})`);
      }
      const buf = Buffer.from(b64.replace(/\s+/g, ''), 'base64');
      return payloadToXml(buf);
    } finally {
      await this.logout(client, sessionId).catch(() => undefined);
    }
  }

  /**
   * Fatura görselini (PDF) çeker — WSDL'deki tipli `getDocumentData` operasyonu
   * (küçük harfle başlayan; PascalCase `GetDocumentData` paramList'li legacy'dir).
   * Giden faturalarda e-arşiv olasılığına karşı EINVOICE → EARCHIVE sırayla denenir.
   */
  async fetchInvoicePdf(
    config: CredentialConfig,
    uuid: string,
    direction: InvoiceDirection,
  ): Promise<ProviderInvoicePdf> {
    const client = await this.createClient(config);
    const sessionId = await this.login(client, config);
    try {
      const docTypes = direction === 'outgoing' ? ['EINVOICE', 'EARCHIVE'] : ['EINVOICE'];
      let lastErr: unknown = null;
      for (const docType of docTypes) {
        try {
          const result = asObj(
            await callSoap(client, 'getDocumentData', {
              sessionID: sessionId,
              uuid,
              docType,
              dataType: 'PDF',
            }),
          );
          const doc = asObj(result['getDocumentDataResult']);
          const binary = asObj(doc['binaryData']);
          const b64 = str(binary['Value'] ?? binary['value']);
          if (b64 === '') {
            lastErr = new ProviderFetchError(
              `getDocumentData boş döndü (UUID: ${uuid}, docType: ${docType})`,
            );
            continue;
          }
          const buf = Buffer.from(b64.replace(/\s+/g, ''), 'base64');
          const normalized = pdfPayloadToBase64(buf);
          const finalBytes = Buffer.from(normalized, 'base64');
          // eLogo'nun contentType'ı güvenilmez (octet-stream/boş gelebiliyor) —
          // içerik %PDF sihriyle başlıyorsa tipi kesin application/pdf yap,
          // yoksa tarayıcı PDF'i düz metin olarak açıyor.
          const isPdf = finalBytes.subarray(0, 5).toString('latin1') === '%PDF-';
          return {
            fileName: str(doc['fileName']) || `${uuid}.pdf`,
            contentType: isPdf
              ? 'application/pdf'
              : str(binary['contentType']) || 'application/pdf',
            base64Data: normalized,
          };
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr instanceof Error
        ? lastErr
        : new ProviderFetchError(`PDF alınamadı (UUID: ${uuid})`);
    } finally {
      await this.logout(client, sessionId).catch(() => undefined);
    }
  }

  // --- SOAP iç akış --------------------------------------------------------
  private createClient(config: CredentialConfig): Promise<SoapClient> {
    const url = this.wsdlUrl(config);
    const cached = this.clients.get(url);
    if (cached !== undefined) return cached;
    const pending = loadSoap().then(
      (soap) =>
        new Promise<SoapClient>((resolve, reject) => {
          soap.createClient(url, { connection: 'keep-alive' }, (err, client) => {
            if (err) {
              // Başarısız denemeyi cache'te bırakma — sonraki çağrı yeniden dener.
              this.clients.delete(url);
              reject(new ProviderFetchError(`WSDL alınamadı (${url}): ${errMsg(err)}`));
              return;
            }
            resolve(client);
          });
        }),
    );
    this.clients.set(url, pending);
    pending.catch(() => this.clients.delete(url));
    return pending;
  }

  private async login(client: SoapClient, config: CredentialConfig): Promise<string> {
    const result = asObj(
      await callSoap(client, 'Login', {
        login: {
          userName: config.username,
          passWord: config.password,
          source: config.extras?.['source'] ?? 'MSUITE',
          appStr: config.extras?.['appStr'] ?? 'M Suite',
          version: config.extras?.['version'] ?? '1.0',
        },
      }).catch((err: unknown) => {
        // SOAP fault'un ham JSON detayı yerine servisin insan-okur mesajını göster.
        const fault = /faultstring:\s*([^\n]*?)\s+detail:/.exec(errMsg(err));
        if (fault !== null && fault[1] !== '') {
          throw new ProviderAuthError(`eLogo girişi reddedildi: ${fault[1]}`);
        }
        throw err;
      }),
    );
    const ok = result['LoginResult'] === true || str(result['LoginResult']) === 'true';
    const sessionId = str(result['sessionID'] ?? result['SessionID']);
    if (!ok || sessionId === '') {
      throw new ProviderAuthError(
        'eLogo oturumu açılamadı (kullanıcı adı/şifre hatalı olabilir ya da hesap bu ortamda tanımlı değil)',
      );
    }
    return sessionId;
  }

  private async logout(client: SoapClient, sessionId: string): Promise<void> {
    await callSoap(client, 'Logout', { sessionID: sessionId }).catch(() => undefined);
  }

  private async fetchListBySide(
    client: SoapClient,
    sessionId: string,
    params: FetchInvoiceListParams,
    direction: InvoiceDirection,
  ): Promise<ProviderInvoiceSummary[]> {
    const result = asObj(
      await callSoap(client, 'getInvoiceList', {
        beginDate: `${params.dateFrom}T00:00:00`,
        endDate: `${params.dateTo}T23:59:59`,
        opType: direction === 'incoming' ? 'RECV' : 'SEND',
        sessionID: sessionId,
        dateBy: 'byISSUEDATE',
      }),
    );
    const items = arr(asObj(result['getInvoiceListResult'])['string']);
    const summaries: ProviderInvoiceSummary[] = [];
    for (const raw of items) {
      const match = UUID_RE.exec(str(raw));
      if (match === null) continue;
      // eLogo listesi yalnız UUID döndürür; gerçek alanlar UBL XML'den parse edilir.
      summaries.push({
        uuid: match[0].toLowerCase(),
        invoiceNo: '',
        direction,
        invoiceType: null,
        scenario: null,
        issueDate: '',
        dueDate: null,
        partyVknTckn: '',
        partyName: '',
        currency: 'TRY',
        payableAmount: '0',
        gibStatus: null,
      });
    }
    return summaries;
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

/** getInvoice binaryData içeriğini UBL XML string'ine çevirir (düz / gzip / zip). */
function payloadToXml(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf).toString('utf-8');
  }
  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) {
    return unzipEntry(buf, '.xml').toString('utf-8');
  }
  return buf.toString('utf-8');
}

/** getDocumentData PDF içeriğini base64'e çevirir (düz PDF / gzip / zip toleranslı). */
function pdfPayloadToBase64(buf: Buffer): string {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    return buf.toString('base64');
  }
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return pdfPayloadToBase64(gunzipSync(buf));
  }
  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) {
    return pdfPayloadToBase64(unzipEntry(buf, '.pdf'));
  }
  // Bilinmeyen tip — olduğu gibi ilet; tarayıcı contentType'a göre karar verir.
  return buf.toString('base64');
}

/** Tek geçişli minimal ZIP okuyucu: central directory'den istenen uzantılı girdiyi çıkarır. */
function unzipEntry(buf: Buffer, preferredExt: string): Buffer {
  const eocd = findEndOfCentralDirectory(buf);
  const entryCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  let fallback: Buffer | null = null;
  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf-8', offset + 46, offset + 46 + nameLen);
    const data = readLocalZipEntry(buf, localHeaderOffset, compressedSize, method);
    if (data !== null) {
      if (name.toLowerCase().endsWith(preferredExt)) return data;
      if (fallback === null) fallback = data;
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  if (fallback !== null) return fallback;
  throw new ProviderFetchError(`eLogo ZIP paketinden ${preferredExt} girdisi çıkarılamadı`);
}

function findEndOfCentralDirectory(buf: Buffer): number {
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new ProviderFetchError('eLogo ZIP paketi okunamadı (EOCD bulunamadı)');
}

function readLocalZipEntry(
  buf: Buffer,
  localHeaderOffset: number,
  compressedSize: number,
  method: number,
): Buffer | null {
  if (localHeaderOffset + 30 > buf.length) return null;
  if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) return null;
  const nameLen = buf.readUInt16LE(localHeaderOffset + 26);
  const extraLen = buf.readUInt16LE(localHeaderOffset + 28);
  const start = localHeaderOffset + 30 + nameLen + extraLen;
  if (start + compressedSize > buf.length) return null;
  const data = buf.subarray(start, start + compressedSize);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  return null;
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

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') return JSON.stringify(err);
  return str(err);
}
